import type { WorkforceForecast, SkillingProgress, AttendanceLog } from '@/types/workforce';

export function computePeakDeficit(forecast: WorkforceForecast[]): number {
  return forecast.reduce((max, d) => Math.max(max, d.deficit), 0);
}

export function computeMomGrowthPct(forecast: WorkforceForecast[]): number | null {
  if (forecast.length < 2) return null;
  const prior = forecast[forecast.length - 2].current_staff;
  const latest = forecast[forecast.length - 1].current_staff;
  if (!prior) return null;
  return ((latest - prior) / prior) * 100;
}

export function computeCertificationStats(skilling: SkillingProgress[]): {
  certifiedCount: number;
  certifiedTotal: number;
  compliancePct: number | null;
} {
  const certifiedCount = skilling.reduce((sum, d) => sum + d.certified_count, 0);
  const certifiedTotal = skilling.reduce((sum, d) => sum + d.total_count, 0);
  return {
    certifiedCount,
    certifiedTotal,
    compliancePct: certifiedTotal ? (certifiedCount / certifiedTotal) * 100 : null,
  };
}

export function computeOnShiftUtilization(attendance: AttendanceLog[], workforce: number): string {
  const onShift = attendance.filter((a) => a.status === 'On-Shift').length;
  return workforce ? ((onShift / workforce) * 100).toFixed(1) : '0';
}

export function topSkillGaps(skilling: SkillingProgress[], count = 3): SkillingProgress[] {
  return [...skilling]
    .sort((a, b) => a.completion_rate - b.completion_rate)
    .slice(0, count);
}
