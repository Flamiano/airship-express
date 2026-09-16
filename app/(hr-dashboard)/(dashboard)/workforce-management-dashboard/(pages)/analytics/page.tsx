'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  Users,
  Clock,
  Download,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';

// In-depth sample analytics data for Workforce Full Analytics
const STAFFING_PROJECTIONS = [
  { month: 'Jan 2026', freight_volume: 4200, current_staff: 120, required_staff: 120, deficit: 0, status: 'Optimal' },
  { month: 'Feb 2026', freight_volume: 4550, current_staff: 122, required_staff: 125, deficit: 3, status: 'Moderate Deficit' },
  { month: 'Mar 2026', freight_volume: 5100, current_staff: 125, required_staff: 132, deficit: 7, status: 'Moderate Deficit' },
  { month: 'Apr 2026', freight_volume: 5400, current_staff: 128, required_staff: 138, deficit: 10, status: 'Critical Deficit' },
  { month: 'May 2026', freight_volume: 6000, current_staff: 130, required_staff: 145, deficit: 15, status: 'Critical Deficit' },
  { month: 'Jun 2026', freight_volume: 6600, current_staff: 133, required_staff: 152, deficit: 19, status: 'Critical Deficit' },
  { month: 'Jul 2026', freight_volume: 7200, current_staff: 135, required_staff: 160, deficit: 25, status: 'Critical Deficit' },
  { month: 'Aug 2026', freight_volume: 7900, current_staff: 138, required_staff: 169, deficit: 31, status: 'Critical Deficit' },
  { month: 'Sep 2026', freight_volume: 8600, current_staff: 140, required_staff: 180, deficit: 40, status: 'Peak Deficit' },
];

const DEPARTMENT_SKILLING = [
  { department: 'Long-Haul Drivers', total: 100, certified: 84, rate: 84, gap: 16, riskLevel: 'Low' },
  { department: 'Regional Dispatch', total: 72, certified: 58, rate: 80.5, gap: 14, riskLevel: 'Low' },
  { department: 'Warehouse Ops', total: 60, certified: 45, rate: 75, gap: 15, riskLevel: 'Medium' },
  { department: 'Hazmat Certified Handlers', total: 40, certified: 22, rate: 55, gap: 18, riskLevel: 'High' },
  { department: 'New Driver Recruits', total: 35, certified: 12, rate: 34.3, gap: 23, riskLevel: 'Critical' },
];

const TERMINAL_EFFICIENCY = [
  { terminal: 'North Hub Chicago', drivers: 48, onTime: 98.2, avgRating: 4.85, overtimePct: 4.2 },
  { terminal: 'Central Port Freight', drivers: 36, onTime: 96.5, avgRating: 4.72, overtimePct: 6.1 },
  { terminal: 'East Logistics Bay', drivers: 32, onTime: 95.1, avgRating: 4.68, overtimePct: 5.8 },
  { terminal: 'South Depot Texas', drivers: 24, onTime: 95.8, avgRating: 4.65, overtimePct: 7.0 },
];

export default function WorkforceFullAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'q1' | 'q2' | 'q3'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'hiring' | 'skilling' | 'terminals'>('hiring');

  const exportData = () => {
    alert('Exporting Workforce Full Analytics Report (CSV)...');
  };

  return (
    <DashboardLayout>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-5 rounded-2xl border border-line shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            Workforce Full Analytics
            <span className="text-xs bg-accent/10 text-accent px-2.5 py-0.5 rounded-full font-medium border border-accent/20">
              Deep-Dive Report
            </span>
          </h1>
          <p className="text-xs text-muted mt-1">
            In-depth analytics for staffing projections, department certifications, terminal performance, and compliance audits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportData} variant="secondary" className="flex items-center gap-1.5 text-xs py-2 px-3">
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-muted uppercase tracking-wider">
            <span>Peak Staffing Deficit</span>
            <AlertTriangle size={15} className="text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-500 mt-1">40 Drivers</p>
          <p className="text-[11px] text-muted">Projected spike in September 2026</p>
        </div>

        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-muted uppercase tracking-wider">
            <span>Avg Training Coverage</span>
            <Award size={15} className="text-accent" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">71.8%</p>
          <p className="text-[11px] text-muted">161 of 307 roster personnel certified</p>
        </div>

        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-muted uppercase tracking-wider">
            <span>On-Time Dispatch Rate</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">96.4%</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Above DOT standard benchmark</p>
        </div>

        <div className="bg-paper border border-line p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-muted uppercase tracking-wider">
            <span>Overtime Allocation</span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">5.8%</p>
          <p className="text-[11px] text-muted">Controlled fatigue rest compliance</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <Card className="p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('hiring')}
              className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                activeSubTab === 'hiring'
                  ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                  : 'text-muted hover:text-ink hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06]'
              }`}
            >
              📈 Staffing & Load Projections
            </button>
            <button
              onClick={() => setActiveSubTab('skilling')}
              className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                activeSubTab === 'skilling'
                  ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                  : 'text-muted hover:text-ink hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06]'
              }`}
            >
              🎓 Department Skilling Matrix
            </button>
            <button
              onClick={() => setActiveSubTab('terminals')}
              className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                activeSubTab === 'terminals'
                  ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                  : 'text-muted hover:text-ink hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06]'
              }`}
            >
              🏢 Terminal Operational Efficiency
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted font-medium">Filter:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="bg-ink/[0.03] dark:bg-paper/[0.05] border border-line text-ink rounded-xl px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            >
              <option value="all">Full 9 Months (2026)</option>
              <option value="q1">Q1 (Jan - Mar)</option>
              <option value="q2">Q2 (Apr - Jun)</option>
              <option value="q3">Q3 (Jul - Sep)</option>
            </select>
          </div>
        </div>

        {/* Tab 1: Staffing & Hiring Projections */}
        {activeSubTab === 'hiring' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-ink">12-Month Projected Headcount vs Demand</h3>
                <p className="text-xs text-muted">Comparison of projected freight loads, active driver capacity, and calculated deficit.</p>
              </div>
            </div>

            <Table>
              <THead>
                <TR header>
                  <TH>Forecast Month</TH>
                  <TH>Projected Freight Volume</TH>
                  <TH>Active Drivers</TH>
                  <TH>Required Drivers</TH>
                  <TH>Headcount Deficit</TH>
                  <TH>Status Assessment</TH>
                </TR>
              </THead>
              <TBody>
                {STAFFING_PROJECTIONS.map((row) => (
                  <TR key={row.month}>
                    <TD className="font-semibold text-ink">{row.month}</TD>
                    <TD className="font-mono text-ink">{row.freight_volume.toLocaleString()} loads</TD>
                    <TD className="font-mono text-muted">{row.current_staff}</TD>
                    <TD className="font-mono text-muted">{row.required_staff}</TD>
                    <TD className="font-mono font-semibold">
                      {row.deficit === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">0 drivers</span>
                      ) : (
                        <span className="text-rose-500">-{row.deficit} drivers</span>
                      )}
                    </TD>
                    <TD>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          row.status === 'Optimal'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : row.status === 'Moderate Deficit'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {row.status}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        {/* Tab 2: Department Skilling Matrix */}
        {activeSubTab === 'skilling' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-ink">Department Mandatory Certification & Training Matrix</h3>
                <p className="text-xs text-muted">Detailed compliance breakdown by role, highlighting priority skill gaps.</p>
              </div>
            </div>

            <Table>
              <THead>
                <TR header>
                  <TH>Department / Unit</TH>
                  <TH>Certified Count</TH>
                  <TH>Total Headcount</TH>
                  <TH>Completion Rate</TH>
                  <TH>Remaining Skill Gap</TH>
                  <TH>Risk Level</TH>
                </TR>
              </THead>
              <TBody>
                {DEPARTMENT_SKILLING.map((dept) => (
                  <TR key={dept.department}>
                    <TD className="font-semibold text-ink">{dept.department}</TD>
                    <TD className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{dept.certified}</TD>
                    <TD className="font-mono text-muted">{dept.total}</TD>
                    <TD>
                      <div className="w-full max-w-[140px] space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-ink">
                          <span>{dept.rate}%</span>
                        </div>
                        <div className="w-full bg-ink/[0.06] dark:bg-paper/[0.08] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              dept.rate >= 80
                                ? 'bg-accent'
                                : dept.rate >= 60
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${dept.rate}%` }}
                          />
                        </div>
                      </div>
                    </TD>
                    <TD className="font-mono text-rose-500 font-semibold">{dept.gap} uncertified</TD>
                    <TD>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          dept.riskLevel === 'Low'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : dept.riskLevel === 'Medium'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {dept.riskLevel} Priority
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        {/* Tab 3: Terminal Operational Efficiency */}
        {activeSubTab === 'terminals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-ink">Terminal Hub Performance & Ratings</h3>
                <p className="text-xs text-muted">On-time dispatch performance, driver ratings, and overtime percentages across hubs.</p>
              </div>
            </div>

            <Table>
              <THead>
                <TR header>
                  <TH>Terminal Location</TH>
                  <TH>Active Drivers</TH>
                  <TH>On-Time Delivery %</TH>
                  <TH>Average Driver Rating</TH>
                  <TH>Overtime Ratio</TH>
                  <TH>Operational Status</TH>
                </TR>
              </THead>
              <TBody>
                {TERMINAL_EFFICIENCY.map((term) => (
                  <TR key={term.terminal}>
                    <TD className="font-semibold text-ink">{term.terminal}</TD>
                    <TD className="font-mono text-muted">{term.drivers}</TD>
                    <TD className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{term.onTime}%</TD>
                    <TD className="font-mono text-amber-500 font-semibold">★ {term.avgRating} / 5.0</TD>
                    <TD className="font-mono text-muted">{term.overtimePct}%</TD>
                    <TD>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Operational
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </DashboardLayout>

  );
}
