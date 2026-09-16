import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardHeader } from '../ui/Card';
import { PERFORMANCE_SEGMENTS } from '../../utils/constants';

interface Card2Props {
  evaluatedCount: number;
  avgRating?: number;
  onTimeRate?: number;
  taskCompletion?: number;
}

/**
 * Card 2: Employee Performance Overview.
 * Pink doughnut chart categorizing employees into Top Performers (darker pink),
 * Steady (vibrant pink), Needs Review (soft pink), with key metric readouts.
 */
export function Card2PerformanceDoughnut({
  evaluatedCount,
  avgRating,
  onTimeRate,
  taskCompletion,
}: Card2Props) {
 const needsReview = PERFORMANCE_SEGMENTS.find((s) => s.name === 'Needs Review');
 const needsReviewPct = needsReview?.value ?? 0;
 const needsReviewCount = Math.round((needsReviewPct / 100) * evaluatedCount);

  return (
    <Card className="p-5 space-y-4">
      <CardHeader
        title="Employee Performance Overview"
        subtitle="Categorized driver & dispatcher efficiency ratings"
        action={
          <span className="text-xs text-accent bg-accent/10 border border-accent/20 font-medium px-2.5 py-1 rounded-lg">
            {evaluatedCount} Evaluated
          </span>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 h-64">
        {/* Doughnut */}
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={PERFORMANCE_SEGMENTS}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {PERFORMANCE_SEGMENTS.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    stroke={entry.color}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--paper, #fff)',
                  borderRadius: '12px',
                  borderColor: 'var(--line, #eaeaea)',
                  fontSize: '12px',
                  color: 'var(--ink, #1c1b1f)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + metrics */}
        <div className="space-y-3">
          <div className="space-y-2">
            {PERFORMANCE_SEGMENTS.map((seg) => (
              <div key={seg.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-line"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="font-medium text-ink">{seg.name}</span>
                </div>
                <span className="font-bold text-ink">{seg.value}%</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-line space-y-2">
            <MetricRow label="Average Performance Rating" value={avgRating == null ? '—' : `${avgRating} / 5.0`} />
            <MetricRow label="On-Time Delivery Rate" value={onTimeRate == null ? '—' : `${onTimeRate}%`} positive />
            <MetricRow label="Average Task Completion" value={taskCompletion == null ? '—' : `${taskCompletion}%`} />
          </div>
        </div>
      </div>

      <div className="bg-accent/5 p-2.5 rounded-xl border border-accent/10 text-center">
        <p className="text-[11px] text-muted font-medium">
          💡 {needsReviewCount} employees in &quot;Needs Review&quot; are scheduled for refresher
          safety compliance.
        </p>
      </div>
    </Card>
  );
}

function MetricRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted font-medium">{label}:</span>
      <span
        className={`font-semibold px-2 py-0.5 rounded border text-[11px] ${
          positive
            ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
            : 'text-ink bg-ink/[0.04] dark:bg-paper/[0.06] border-line'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

