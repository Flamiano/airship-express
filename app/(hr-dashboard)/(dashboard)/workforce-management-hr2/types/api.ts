// Standard API response envelope used by all /api routes.
// Every route returns either { data } on success or { error } on failure.
export type ApiResponse<T> = { data: T } | { error: string };

// Payload for creating a shift (POST /api/shifts)
export interface CreateShiftPayload {
  title: string;
  driver_id: string | null;
  vehicle: string;
  shift_date: string;
  shift_time: string;
  priority: 'Normal' | 'High' | 'Critical';
}

// Payload for creating a freight load (POST /api/loads)
export interface CreateLoadPayload {
  load_ref: string;
  origin: string;
  destination: string;
  pickup_date: string;
  priority: 'Normal' | 'High' | 'Critical';
}

// Payload for updating a freight load (PATCH /api/loads/[id])
export interface UpdateLoadPayload {
  driver_id?: string | null;
  status?: 'Pending Driver' | 'Scheduled' | 'In Transit' | 'Delivered' | 'On Hold' | 'Cancelled';
}

// Payload for creating a leave request (POST /api/leave)
export interface CreateLeavePayload {
  leave_type: 'Mandatory Fatigue Rest' | 'Paid Time Off (PTO)' | 'Medical Leave' | 'Unpaid Leave';
  start_date: string;
  end_date: string;
  reason?: string;
}

// Payload for updating a timesheet status (PATCH /api/timesheets)
export interface UpdateTimesheetPayload {
  id: string;
  status: 'Pending Approval' | 'Approved' | 'Flagged Overtime' | 'Rejected';
}

// Payload for updating a leave request status (PATCH /api/leave)
export interface UpdateLeavePayload {
  id: string;
  status: 'Pending HR Review' | 'Approved' | 'Rejected';
}

// Payload for updating attendance status (PATCH /api/attendance)
export interface UpdateAttendancePayload {
  id: string;
  status: 'On-Shift' | 'On-Break' | 'Tardy' | 'Absent' | 'Clocked Out';
}

// Response from the AI forecast endpoint (POST /api/ai/forecast)
export interface AiForecastResponse {
  analysis: string;
  source: 'gemini' | 'heuristic';
}

// ---- Global search (GET /api/search?q=) ----

// The kind of entity a search result points at. Drives the icon + grouping in
// the TopNav command palette.
export type SearchResultType = 'person' | 'shift' | 'timesheet' | 'leave' | 'load';

// A single normalized, RBAC-scoped search hit. `href` is the route to navigate
// to when the result is selected.
export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
}
