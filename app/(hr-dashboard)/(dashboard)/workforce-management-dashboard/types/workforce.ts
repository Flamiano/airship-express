// Core role type used throughout the app. Mirrors the role CHECK constraint in
// supabase/schema.sql. Roles are the employee's real position from the roster.
export type UserRole =
  // App-level roles (still used for the demo identity + RBAC fallbacks)
  | 'HR Admin'
  | 'Operations Manager'
  | 'Fleet Driver'
  // Real roster positions (employeelist.txt)
  | 'Hybrid/Rider'
  | 'Appraiser'
  | 'Appraiser/Rider'
  | 'Sales Representative'
  | 'Office Staff'
  | 'CSR/Marketing Staff'
  | 'Rider'
  | 'Project Coordinator'
  | 'Office-in-Charge'
  | 'Admin Assistant'
  | 'In-House Rider'
  | 'JNT Pick-Up Rider'
  | 'Airship Driver'
  | 'HR Generalist'
  | 'HR Officer'
  | 'Marketing/Admin Staff'
  | 'Drop-Off Pick-Up Rider'
  | 'Manila Rider';

// Attendance status enum
export type AttendanceStatus = 'On-Shift' | 'On-Break' | 'Tardy' | 'Absent' | 'Clocked Out';

// Shift status enum
export type ShiftStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Pending Driver';

// Shift priority
export type ShiftPriority = 'Normal' | 'High' | 'Critical';

// Timesheet status enum
export type TimesheetStatus = 'Pending Approval' | 'Approved' | 'Flagged Overtime' | 'Rejected';

// Performance doughnut segment interface
export interface PerformanceSegment {
  name: string;
  value: number;
  color: string;
}

// Leave request status enum
export type LeaveStatus = 'Pending HR Review' | 'Approved' | 'Rejected';

// Leave type enum
export type LeaveType = 'Mandatory Fatigue Rest' | 'Paid Time Off (PTO)' | 'Medical Leave' | 'Unpaid Leave';

// Employee/Profile interface
export interface Employee {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_initials: string;
  terminal: string;
  created_at: string;
  rfid_uid?: string | null;
}

// Attendance log interface (matches attendance_logs table)
export interface AttendanceLog {
  id: string;
  employee_id: string;
  action?: 'TIME_IN' | 'TIME_OUT';
  status: AttendanceStatus;
  time_in?: string | null;
  time_out?: string | null;
  shift_start: string;
  shift_end: string;
  terminal: string;
  last_scan: string;
  created_at: string;
  employee?: Employee; // Joined employee data
}

// Shift interface (matches shifts table)
export interface Shift {
  id: string;
  title: string;
  driver_id: string | null;
  vehicle: string;
  shift_date: string;
  shift_time: string;
  status: ShiftStatus;
  priority: ShiftPriority;
  created_at: string;
  driver?: Employee; // Joined driver data
}

// Timesheet interface (matches timesheets table)
export interface Timesheet {
  id: string;
  employee_id: string;
  week_start: string;
  week_end: string;
  total_hours: number;
  overtime_hours: number;
  load_ref: string | null;
  total_pay: number | null;
  status: TimesheetStatus;
  created_at: string;
  employee?: Employee;
}

// Leave request interface (matches hr2_leave_requests table)
export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  total_days?: number;
  reason: string;
  status: LeaveStatus;
  balance_remaining?: number | null;
  created_at: string;
  employee?: Employee;
}

// Performance metrics interface (matches performance_metrics table)
export interface PerformanceMetrics {
  id: string;
  snapshot_date: string;
  avg_rating: number;
  on_time_rate: number;
  task_completion_rate: number;
  active_courses: number;
  top_performers_pct?: number;
  steady_workers_pct?: number;
  needs_review_pct?: number;
  created_at: string;
}

// Workforce deficit forecast interface (matches hr2_workforce_forecast table)
export interface WorkforceForecast {
  id: string;
  month: string;
  freight_volume: number;
  current_staff: number;
  required_staff: number;
  deficit: number;
  forecast_month?: string;
  workforce_demand?: number;
  active_capacity?: number;
  created_at: string;
}


