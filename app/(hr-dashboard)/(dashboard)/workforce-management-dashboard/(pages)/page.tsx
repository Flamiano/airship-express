'use client';

import React, { useState, useEffect } from 'react';
import { Users, Activity, AlertTriangle, Award, ArrowUpRight, ArrowDownRight, CheckCircle2, Sparkles, Download } from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card1HiringNeedsChart } from '../components/analytics/Card1HiringNeedsChart';
import { Card2PerformanceDoughnut } from '../components/analytics/Card2PerformanceDoughnut';
import { Card3SkillingProgress } from '../components/analytics/Card3SkillingProgress';
import { Card4RealtimeAttendance } from '../components/analytics/Card4RealtimeAttendance';
import { AiInsightsModal } from '../components/modals/AiInsightsModal';
import { Button } from '../components/ui/Button';
import { useRealtimeAttendance } from '../hooks/useRealtime';
import { useAiAnalysis } from '../hooks/useAiAnalysis';
import { apiFetch } from '../lib/apiFetch';
import {
  computePeakDeficit,
  computeMomGrowthPct,
  computeCertificationStats,
  computeOnShiftUtilization,
} from '../lib/analytics';
import type { WorkforceForecast, SkillingProgress, PerformanceMetrics } from '../types/workforce';

interface AnalyticsData {
  forecast: WorkforceForecast[];
  skilling: SkillingProgress[];
  performance: PerformanceMetrics | null;
  workforce: number;
}

export default function DashboardPage() {
 const { attendance, connected } = useRealtimeAttendance();
 const ai = useAiAnalysis();
 const [aiOpen, setAiOpen] = useState(false);
  const [data, setData] = useState<AnalyticsData>({
    forecast: [],
    skilling: [],
    performance: null,
    workforce: 0,
  });
 const [loadError, setLoadError] = useState<string | null>(null);

 useEffect(() => {
 apiFetch<AnalyticsData>('/api/analytics')
 .then(setData)
 .catch((err) => setLoadError(err.message));
 }, []);

 const runAi = () => {
 setAiOpen(true);
 ai.run();
 };

  const peakDeficit = computePeakDeficit(data.forecast);
  const totalWorkforce = data.workforce || attendance.length;

  // Month-over-month headcount growth from the forecast series (last vs prior).
  const growthPct = computeMomGrowthPct(data.forecast);

  // Overall certification rate weighted across departments (skilling data).
  const { certifiedCount: certCount, compliancePct } = computeCertificationStats(data.skilling);

  const onShift = attendance.filter((a) => a.status === 'On-Shift').length;
  const utilization = computeOnShiftUtilization(attendance, totalWorkforce);

  return (
    <DashboardLayout realtimeConnected={connected}>
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            Dashboard
            <span className="text-xs bg-accent/10 text-accent px-2.5 py-0.5 rounded-full font-medium border border-accent/20">
              Primary Admin Control
            </span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Integrated real-time workforce intelligence for freight load demand, driver retention,
            and certification balance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={runAi} variant="primary">
            <Sparkles size={15} />
            Predictive Hiring AI
          </Button>
          <Button variant="secondary" aria-label="Export">
            <Download size={16} />
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          Could not load analytics data: {loadError}. Ensure your Supabase tables are seeded.
        </div>
      )}

      {/* Quick metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricTile
          label="Total Active Workforce"
          value={String(totalWorkforce)}
          icon={<Users size={16} />}
          footer={
            growthPct === null ? (
              <span className="text-muted">Headcount across all terminals</span>
            ) : (
              <span
                className={`font-semibold flex items-center gap-1 ${
                  growthPct >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {growthPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{' '}
                {Math.abs(growthPct).toFixed(1)}% from last month
              </span>
            )
          }
        />
        <MetricTile
          label="On-Shift Utilization"
          value={`${utilization}%`}
          icon={<Activity size={16} />}
          footer={<span className="text-muted">{onShift} drivers dispatched now</span>}
        />
        <MetricTile
          label="Predicted Staff Deficit"
          value={`${peakDeficit} Drivers`}
          icon={<AlertTriangle size={16} />}
          danger
          footer={<span className="text-rose-500 font-semibold">Peak Q4 freight bottleneck</span>}
        />
        <MetricTile
          label="Compliance & Skilling"
          value={compliancePct === null ? '—' : `${compliancePct.toFixed(1)}%`}
          icon={<Award size={16} />}
          footer={
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 size={12} /> {certCount} DOT Certifications Valid
            </span>
          }
        />
      </div>

      {/* 4-card grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card1HiringNeedsChart data={data.forecast} skilling={data.skilling} onRunAi={runAi} />
        <Card2PerformanceDoughnut
          evaluatedCount={totalWorkforce}
          avgRating={data.performance?.avg_rating}
          onTimeRate={data.performance?.on_time_rate}
          taskCompletion={data.performance?.task_completion_rate}
        />
        <Card3SkillingProgress data={data.skilling} activeCourses={data.performance?.active_courses} />
        <Card4RealtimeAttendance attendance={attendance} connected={connected} />
      </div>

      <AiInsightsModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        loading={ai.loading}
        analysis={ai.analysis}
        source={ai.source}
        error={ai.error}
      />
    </DashboardLayout>
  );
}

function MetricTile({
  label,
  value,
  icon,
  footer,
  danger = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  footer: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="bg-paper p-4 rounded-2xl border border-line shadow-2xs hover:border-accent/30 transition">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <div className={`p-2 rounded-xl ${danger ? 'bg-rose-500/10 text-rose-500' : 'bg-accent/10 text-accent'}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold mt-2 ${danger ? 'text-rose-500' : 'text-ink'}`}>
        {value}
      </p>
      <p className="text-[11px] mt-1">{footer}</p>
    </div>
  );
}

