import type {
  AttendanceStatus,
  ShiftPriority,
  TimesheetStatus,
  LeaveStatus,
  PerformanceSegment,
  LoadStatus,
} from '../types/workforce';

// ---- Status badges (harmonized with theme tokens) ----

export const ATTENDANCE_BADGE: Record<AttendanceStatus, string> = {
  'On-Shift': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'On-Break': 'bg-accent/10 text-accent border-accent/20',
  Tardy: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  Absent: 'bg-ink/[0.06] dark:bg-paper/[0.08] text-muted border-line',
  'Clocked Out': 'bg-ink/[0.06] dark:bg-paper/[0.08] text-muted border-line',
};

export const SHIFT_PRIORITY_BADGE: Record<ShiftPriority, string> = {
  Critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  High: 'bg-accent/10 text-accent border-accent/20',
  Normal: 'bg-ink/[0.06] dark:bg-paper/[0.08] text-muted border-line',
};

export const TIMESHEET_BADGE: Record<TimesheetStatus, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Flagged Overtime': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'Pending Approval': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Rejected: 'bg-ink/[0.06] dark:bg-paper/[0.08] text-muted border-line',
};

export const LEAVE_BADGE: Record<LeaveStatus, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Pending HR Review': 'bg-accent/10 text-accent border-accent/20',
  Rejected: 'bg-ink/[0.06] dark:bg-paper/[0.08] text-muted border-line',
};

// ---- Freight load badges ----
export const LOAD_STATUS_BADGE: Record<LoadStatus, string> = {
  'Pending Driver': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  Scheduled: 'bg-accent/10 text-accent border-accent/20',
  'In Transit': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  Delivered: 'bg-ink/[0.06] dark:bg-paper/[0.08] text-muted border-line',
  'On Hold': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Cancelled: 'bg-ink/[0.06] dark:bg-paper/[0.08] text-muted border-line',
};

export const LOAD_STATUSES: LoadStatus[] = [
  'Pending Driver',
  'Scheduled',
  'In Transit',
  'Delivered',
  'On Hold',
  'Cancelled',
];

// ---- Performance doughnut segments (Card 2) ----
export const PERFORMANCE_SEGMENTS: PerformanceSegment[] = [
  { name: 'Top Performers', value: 38, color: '#e5167e' },
  { name: 'Steady Workers', value: 48, color: '#b3115f' },
  { name: 'Needs Review', value: 14, color: '#f472b6' },
];

// Recharts color tokens for the workload chart (Card 1)
export const CHART_COLORS = {
  currentStaff: '#e5167e', // brand magenta
  requiredStaff: '#6b6b76', // muted gray
  grid: '#eaeaea', // line color
  axis: '#6b6b76', // secondary text
  bar: '#e5167e', // brand magenta
};

// Driver dropdown fallback options for the shift modal when the profiles
// table hasn't been populated yet.
export const LEAVE_TYPES = [
  'Mandatory Fatigue Rest',
  'Paid Time Off (PTO)',
  'Medical Leave',
  'Unpaid Leave',
] as const;

export const SHIFT_PRIORITIES = ['Normal', 'High', 'Critical'] as const;

