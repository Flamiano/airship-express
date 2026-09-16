import React from 'react';
import {
 ResponsiveContainer,
 LineChart,
 Line,
 Tooltip,
 XAxis,
 YAxis,
 CartesianGrid,
 Legend,
} from 'recharts';
import { Sparkles } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { CHART_COLORS } from '../../utils/constants';
import { topSkillGaps } from '../../lib/analytics';
import type { WorkforceForecast, SkillingProgress } from '../../types/workforce';

interface Card1Props {
  data: WorkforceForecast[];
  skilling?: SkillingProgress[];
  onRunAi: () => void;
}

/**
 * Card 1: Predict Hiring Needs.
 * Multi-line chart comparing current vs required staffing over 12 months,
 * derived from projected freight volume. Highlights the peak deficit and
 * top skill gaps as metric overlays.
 */
export function Card1HiringNeedsChart({ data, skilling, onRunAi }: Card1Props) {
  // Compute peak deficit for the metric overlay.
  const peak = data.reduce(
    (max, d) => (d.deficit > max.deficit ? d : max),
    data[0] ?? { deficit: 0, month: '—' }
  );

  // Top skill gaps = the departments with the lowest certification completion.
  const skillGaps = topSkillGaps(skilling ?? []);

  return (
    <Card className="p-5 space-y-4">
      <CardHeader
        title={
          <>
            Predict Hiring Needs vs Freight Load
            <span className="text-[10px] bg-rose-500/10 text-rose-500 dark:text-rose-400 px-2 py-0.5 rounded-full font-medium border border-rose-500/20">
              AI Forecast
            </span>
          </>
        }
        subtitle="12-Month Projected Freight Volume vs. Staffing Levels"
        action={
          <button
            onClick={onRunAi}
            className="text-xs text-accent font-medium hover:text-accent-dark flex items-center gap-1.5 bg-accent/10 px-2.5 py-1 rounded-lg border border-accent/20 transition-colors"
          >
            <Sparkles size={13} />
            AI Insights
          </button>
        }
      />

      <div className="h-64 w-full overflow-hidden">
        <ResponsiveContainer width="100%" height="100%" debounce={150}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={false}
            />
            <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--paper, #fff)',
                borderRadius: '12px',
                borderColor: 'var(--line, #eaeaea)',
                fontSize: '12px',
                color: 'var(--ink, #1c1b1f)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            <Line
              type="monotone"
              dataKey="current_staff"
              name="Current Staffing"
              stroke={CHART_COLORS.currentStaff}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={{ fill: CHART_COLORS.currentStaff, r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="required_staff"
              name="Required Staffing"
              stroke={CHART_COLORS.requiredStaff}
              strokeWidth={2.5}
              isAnimationActive={false}
              strokeDasharray="4 4"
              dot={{ fill: CHART_COLORS.requiredStaff, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Metric overlays */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-ink/[0.02] dark:bg-paper/[0.04] p-3 rounded-xl border border-line">
          <p className="text-[11px] font-medium text-muted">Predicted Headcount Deficit</p>
          <p className="text-xl font-bold text-rose-500 mt-0.5">
            {peak.deficit} Drivers ({peak.month})
          </p>
          <p className="text-[10px] text-muted mt-1">Highest projected bottleneck month</p>
        </div>
        <div className="bg-ink/[0.02] dark:bg-paper/[0.04] p-3 rounded-xl border border-line">
          <p className="text-[11px] font-medium text-muted">Top 3 Skill Deficit Gaps</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {skillGaps.length === 0 ? (
              <span className="text-[10px] bg-paper text-muted border border-line px-2 py-0.5 rounded-full font-medium">
                No data
              </span>
            ) : (
              skillGaps.map((gap) => (
                <span
                  key={gap.id}
                  className="text-[10px] bg-paper text-ink border border-line px-2 py-0.5 rounded-full font-medium"
                >
                  {gap.department}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

