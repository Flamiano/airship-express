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
import { Card, CardHeader } from '@/components/ui/Card';
import { CHART_COLORS } from '@/utils/constants';
import { topSkillGaps } from '@/lib/analytics';
import type { WorkforceForecast, SkillingProgress } from '@/types/workforce';

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
 Card 1: Predict Hiring Needs vs Freight Load
 <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
 AI Forecast
 </span>
 </>
 }
 subtitle="12-Month Projected Freight Volume vs. Staffing Levels"
 action={
 <button
 onClick={onRunAi}
 className="text-xs text-pink-600 font-bold hover:text-pink-800 flex items-center gap-1 bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-200"
 >
 <Sparkles size={13} />
 AI Insights
 </button>
 }
 />

 <div className="h-64 w-full">
 <ResponsiveContainer width="100%" height="100%">
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
 backgroundColor: '#fff',
 borderRadius: '12px',
 borderColor: CHART_COLORS.grid,
 fontSize: '12px',
 color: CHART_COLORS.axis,
 }}
 />
 <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
 <Line
 type="monotone"
 dataKey="current_staff"
 name="Current Staffing"
 stroke={CHART_COLORS.currentStaff}
 strokeWidth={2.5}
 dot={{ fill: CHART_COLORS.currentStaff, r: 3 }}
 />
 <Line
 type="monotone"
 dataKey="required_staff"
 name="Required Staffing"
 stroke={CHART_COLORS.requiredStaff}
 strokeWidth={2.5}
 strokeDasharray="4 4"
 dot={{ fill: CHART_COLORS.requiredStaff, r: 3 }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>

 {/* Metric overlays */}
 <div className="grid grid-cols-2 gap-3 pt-2">
 <div className="bg-pink-50 p-3 rounded-xl border border-pink-200">
 <p className="text-[11px] font-semibold text-pink-700">Predicted Headcount Deficit</p>
 <p className="text-xl font-bold text-rose-700 mt-0.5">
 {peak.deficit} Drivers ({peak.month})
 </p>
 <p className="text-[10px] text-pink-500 mt-1">Highest projected bottleneck month</p>
 </div>
  <div className="bg-pink-50 p-3 rounded-xl border border-pink-200">
    <p className="text-[11px] font-semibold text-pink-700">Top 3 Skill Deficit Gaps</p>
    <div className="flex flex-wrap gap-1 mt-1">
      {skillGaps.length === 0 ? (
        <span className="text-[10px] bg-white text-pink-400 border border-pink-200 px-2 py-0.5 rounded-full font-medium">
          No data
        </span>
      ) : (
        skillGaps.map((gap) => (
          <span
            key={gap.id}
            className="text-[10px] bg-white text-pink-900 border border-pink-200 px-2 py-0.5 rounded-full font-medium"
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
