import type { WorkforceForecast, AttendanceLog } from '../types/workforce';

export function computePeakDeficit(forecast: WorkforceForecast[]): number {
  return forecast.reduce((max, d) => Math.max(max, d.deficit), 0);
}

export function computeMomGrowthPct(forecast: WorkforceForecast[]): number | null {
  if (forecast.length < 2) return null;
  const prior = forecast[forecast.length - 2].current_staff;
  const latest = forecast[forecast.length - 1].current_staff;

  if (!prior || !latest) return null;
  return ((latest - prior) / prior) * 100;
}

export function computeOnShiftUtilization(
  attendance: AttendanceLog[],
  totalWorkforce: number
): number {
  if (totalWorkforce === 0) return 0;
  const onShift = attendance.filter((a) => a.status === 'On-Shift').length;
  return Math.round((onShift / totalWorkforce) * 100);
}
