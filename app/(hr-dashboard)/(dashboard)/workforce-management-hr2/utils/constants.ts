import type {
  AttendanceStatus,
  ShiftPriority,
  TimesheetStatus,
  LeaveStatus,
  PerformanceSegment,
  LoadStatus,
} from '@/types/workforce';

// ---- Tailwind class maps for status badges (pink/white palette) ----

export const ATTENDANCE_BADGE: Record<AttendanceStatus, string> = {
  'On-Shift': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'On-Break': 'bg-pink-100 text-pink-800 border-pink-300',
  Tardy: 'bg-rose-100 text-rose-800 border-rose-300',
  Absent: 'bg-slate-100 text-slate-600 border-slate-200',
  'Clocked Out': 'bg-slate-100 text-slate-600 border-slate-200',
};

export const SHIFT_PRIORITY_BADGE: Record<ShiftPriority, string> = {
  Critical: 'bg-rose-100 text-rose-800 border-rose-300',
  High: 'bg-pink-100 text-pink-800 border-pink-300',
  Normal: 'bg-pink-50 text-pink-700 border-pink-200',
};

export const TIMESHEET_BADGE: Record<TimesheetStatus, string> = {
  Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Flagged Overtime': 'bg-rose-100 text-rose-800 border-rose-300',
  'Pending Approval': 'bg-pink-100 text-pink-800 border-pink-300',
  Rejected: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const LEAVE_BADGE: Record<LeaveStatus, string> = {
  Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Pending HR Review': 'bg-pink-100 text-pink-800 border-pink-300',
  Rejected: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ---- Freight load badges (pink/white palette) ----
export const LOAD_STATUS_BADGE: Record<LoadStatus, string> = {
  'Pending Driver': 'bg-rose-100 text-rose-800 border-rose-300',
  Scheduled: 'bg-pink-100 text-pink-800 border-pink-300',
  'In Transit': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Delivered: 'bg-slate-100 text-slate-600 border-slate-200',
  'On Hold': 'bg-amber-100 text-amber-800 border-amber-300',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
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
// Brand magenta tones: darkest = Top Performers, vibrant = Steady,
// soft tint = Needs Review.
export const PERFORMANCE_SEGMENTS: PerformanceSegment[] = [
  { name: 'Top Performers', value: 38, color: '#D81B60' },
  { name: 'Steady Workers', value: 48, color: '#E6007A' },
  { name: 'Needs Review', value: 14, color: '#F5C9DE' },
];

// Recharts color tokens for the workload chart (Card 1)
export const CHART_COLORS = {
  currentStaff: '#E6007A', // brand magenta
  requiredStaff: '#D81B60', // deep brand magenta
  grid: '#E5E7EB', // divider gray
  axis: '#71717A', // secondary text
  bar: '#E6007A', // brand magenta
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
