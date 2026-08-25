import React from 'react';
import { ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Award, ShieldCheck } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { CHART_COLORS } from '@/utils/constants';
import type { SkillingProgress } from '@/types/workforce';

interface Card3Props {
  data: SkillingProgress[];
  activeCourses?: number;
}

/**
 * Card 3: Address Skilling & Certification Progress.
 * Pink horizontal bar chart showing department-by-department mandatory training
 * completion rates, with metric overlays for total active courses and certified count.
 */
export function Card3SkillingProgress({ data, activeCourses }: Card3Props) {
  const totalCertified = data.reduce((sum, d) => sum + d.certified_count, 0);

 return (
 <Card className="p-5 space-y-4">
 <CardHeader
 title="Card 3: Address Skilling & Certification Progress"
 subtitle="Departmental mandatory training completion"
 action={
 <button className="text-xs text-pink-600 font-bold hover:bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-200">
 Manage Courses
 </button>
 }
 />

 <div className="h-60 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart
 layout="vertical"
 data={data}
 margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
 >
 <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
 <XAxis
 type="number"
 domain={[0, 100]}
 tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
 unit="%"
 />
 <YAxis
 dataKey="department"
 type="category"
 tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
 width={110}
 />
 <Tooltip
 contentStyle={{
 backgroundColor: '#fff',
 borderRadius: '12px',
 borderColor: CHART_COLORS.grid,
 fontSize: '12px',
 }}
 />
 <Bar
 dataKey="completion_rate"
 name="Completion Rate %"
 fill={CHART_COLORS.bar}
 radius={[0, 8, 8, 0]}
 barSize={18}
 />
 </BarChart>
 </ResponsiveContainer>
 </div>

 {/* Metrics row */}
 <div className="grid grid-cols-2 gap-3 pt-1">
 <div className="bg-pink-50 p-3 rounded-xl border border-pink-200 flex items-center gap-3">
 <div className="p-2 bg-white rounded-lg text-pink-600 border border-pink-200">
 <Award size={18} />
 </div>
 <div>
  <p className="text-[10px] text-pink-600 font-bold uppercase">Active Courses</p>
  <p className="text-base font-bold text-pink-950">{activeCourses ?? '—'} Specialized Modules</p>
 </div>
 </div>

 <div className="bg-pink-50 p-3 rounded-xl border border-pink-200 flex items-center gap-3">
 <div className="p-2 bg-white rounded-lg text-emerald-600 border border-pink-200">
 <ShieldCheck size={18} />
 </div>
 <div>
 <p className="text-[10px] text-pink-600 font-bold uppercase">Total Certified</p>
 <p className="text-base font-bold text-pink-950">{totalCertified} Active Badges</p>
 </div>
 </div>
 </div>
 </Card>
 );
}
