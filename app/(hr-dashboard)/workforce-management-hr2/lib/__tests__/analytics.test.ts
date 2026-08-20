import { describe, expect, it } from 'vitest';
import {
  computePeakDeficit,
  computeMomGrowthPct,
  computeCertificationStats,
  computeOnShiftUtilization,
  topSkillGaps,
} from '@/lib/analytics';
import type { WorkforceForecast, SkillingProgress, AttendanceLog } from '@/types/workforce';

function forecastRow(overrides: Partial<WorkforceForecast>): WorkforceForecast {
  return {
    id: 'f',
    month: 'Jan 2026',
    freight_volume: 100,
    current_staff: 10,
    required_staff: 20,
    deficit: 10,
    created_at: '2026-01-01',
    ...overrides,
  };
}

function skillingRow(overrides: Partial<SkillingProgress>): SkillingProgress {
  return {
    id: 's',
    department: 'Dept',
    certified_count: 5,
    total_count: 10,
    completion_rate: 50,
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function attendanceRow(status: AttendanceLog['status']): AttendanceLog {
  return {
    id: 'a',
    employee_id: 'e',
    status,
    shift_start: '06:00',
    shift_end: '14:30',
    terminal: 'North Hub Chicago',
    last_scan: '2026-01-01T06:00:00Z',
    created_at: '2026-01-01',
  };
}

describe('computePeakDeficit', () => {
  it('returns 0 for empty data', () => {
    expect(computePeakDeficit([])).toBe(0);
  });

  it('returns the largest deficit in the series', () => {
    const rows = [
      forecastRow({ deficit: 4 }),
      forecastRow({ deficit: 12 }),
      forecastRow({ deficit: 7 }),
    ];
    expect(computePeakDeficit(rows)).toBe(12);
  });
});

describe('computeMomGrowthPct', () => {
  it('returns null with fewer than two rows', () => {
    expect(computeMomGrowthPct([])).toBeNull();
    expect(computeMomGrowthPct([forecastRow({})])).toBeNull();
  });

  it('returns null when the prior headcount is zero', () => {
    const rows = [
      forecastRow({ current_staff: 0 }),
      forecastRow({ current_staff: 10 }),
    ];
    expect(computeMomGrowthPct(rows)).toBeNull();
  });

  it('computes a positive month-over-month change', () => {
    const rows = [
      forecastRow({ current_staff: 100 }),
      forecastRow({ current_staff: 120 }),
    ];
    expect(computeMomGrowthPct(rows)).toBeCloseTo(20);
  });

  it('computes a negative month-over-month change', () => {
    const rows = [
      forecastRow({ current_staff: 100 }),
      forecastRow({ current_staff: 90 }),
    ];
    expect(computeMomGrowthPct(rows)).toBeCloseTo(-10);
  });
});

describe('computeCertificationStats', () => {
  it('returns zeros and null for empty data', () => {
    expect(computeCertificationStats([])).toEqual({
      certifiedCount: 0,
      certifiedTotal: 0,
      compliancePct: null,
    });
  });

  it('weights certification across departments', () => {
    const rows = [
      skillingRow({ certified_count: 8, total_count: 10, completion_rate: 80 }),
      skillingRow({ certified_count: 2, total_count: 10, completion_rate: 20 }),
    ];
    const { certifiedCount, certifiedTotal, compliancePct } =
      computeCertificationStats(rows);
    expect(certifiedCount).toBe(10);
    expect(certifiedTotal).toBe(20);
    expect(compliancePct).toBe(50);
  });
});

describe('computeOnShiftUtilization', () => {
  it('returns "0" when there is no workforce', () => {
    expect(computeOnShiftUtilization([attendanceRow('On-Shift')], 0)).toBe('0');
  });

  it('returns a one-decimal percentage of On-Shift staff', () => {
    const rows = [
      attendanceRow('On-Shift'),
      attendanceRow('On-Shift'),
      attendanceRow('On-Break'),
      attendanceRow('Absent'),
    ];
    expect(computeOnShiftUtilization(rows, 4)).toBe('50.0');
  });
});

describe('topSkillGaps', () => {
  it('returns an empty array for no data', () => {
    expect(topSkillGaps([])).toEqual([]);
  });

  it('sorts ascending and returns the lowest completion departments', () => {
    const rows = [
      skillingRow({ id: 'a', department: 'A', completion_rate: 80 }),
      skillingRow({ id: 'b', department: 'B', completion_rate: 20 }),
      skillingRow({ id: 'c', department: 'C', completion_rate: 60 }),
      skillingRow({ id: 'd', department: 'D', completion_rate: 40 }),
    ];
    expect(topSkillGaps(rows).map((d) => d.department)).toEqual(['B', 'D', 'C']);
  });

  it('respects a custom count', () => {
    const rows = [
      skillingRow({ id: 'a', department: 'A', completion_rate: 80 }),
      skillingRow({ id: 'b', department: 'B', completion_rate: 20 }),
      skillingRow({ id: 'c', department: 'C', completion_rate: 60 }),
    ];
    expect(topSkillGaps(rows, 2).map((d) => d.department)).toEqual(['B', 'C']);
  });
});
