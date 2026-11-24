export type MaintenanceRecord = {
  id: string;
  vehicle_id: string;
  maintenance_category?: string | null;
  maintenance_type: string;
  description?: string | null;
  reported_issue?: string | null;
  diagnosis?: string | null;
  work_performed?: string | null;
  inspection_results?: InspectionResult[] | null;
  replaced_parts?: ReplacedPart[] | null;
  odometer_reading?: number | null;
  mechanic?: string | null;
  performed_by?: string | null;
  priority?: string | null;
  cost?: number | null;
  labor_cost?: number | null;
  parts_cost?: number | null;
  cost_review_status?: "pending" | "approved" | "rejected" | null;
  cost_reviewed_by?: string | null;
  cost_reviewed_at?: string | null;
  cost_review_notes?: string | null;
  cost_reviewer_name?: string | null;
  source_cost_entry_id?: string | null;
  scheduled_at?: string | null;
  performed_at?: string | null;
  next_due_date?: string | null;
  next_due_mileage?: number | null;
  duration_minutes?: number | null;
  recurrence_rule?: string | null;
  recurrence_series_id?: string | null;
  notes?: string | null;
  status?: string | null;
  is_automated?: boolean | null;
  automation_key?: string | null;
  maintenance_source?: string | null;
  source_incident_id?: string | null;
  source_trip_id?: string | null;
  interval_days_snapshot?: number | null;
  interval_km_snapshot?: number | null;
  trigger_data?: Record<string, unknown> | null;
  created_at?: string | null;
  vehicle_status_warning?: string | null;
};

export type InspectionResult = {
  item: string;
  result: "pass" | "attention" | "not_checked";
  notes?: string;
};

export type ReplacedPart = {
  name: string;
  quantity: number;
  unit_cost?: number | null;
};

export type MaintenanceAuditEntry = {
  id: string;
  source: string;
  source_id?: string | null;
  previous_odometer_km?: number | null;
  current_odometer_km?: number | null;
  baseline_date?: string | null;
  baseline_odometer_km?: number | null;
  interval_days?: number | null;
  interval_km?: number | null;
  next_due_date?: string | null;
  next_due_mileage?: number | null;
  attention_status: string;
  details?: (Record<string, unknown> & { reason?: string | null }) | null;
  calculated_at: string;
};

export type MaintenanceVehicle = {
  id: string;
  plate_number?: string | null;
  vehicle_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  status?: string | null;
  mileage?: number | string | null;
  odometer?: number | string | null;
  maintenance_interval_days?: number | null;
  maintenance_interval_km?: number | null;
  maintenance_due_soon_km?: number | null;
  maintenance_recurring_fault_limit?: number | null;
  maintenance_base_date?: string | null;
  maintenance_base_odometer?: number | null;
  maintenance_attention_status?: string | null;
  maintenance_attention_reason?: string | null;
  maintenance_next_due_date?: string | null;
  maintenance_next_due_mileage?: number | null;
};

export type RecordStatus = "scheduled" | "in_progress" | "completed" | "overdue" | "cancelled";
export type CalendarView = "month" | "week" | "agenda";

export const MAINTENANCE_CATEGORIES = [
  "Preventive Maintenance",
  "Corrective Maintenance",
  "Emergency Maintenance",
  "Inspection and Safety Checks",
  "Parts Replacement",
] as const;

export const INSPECTION_ITEMS = [
  "Brakes",
  "Tires",
  "Lights",
  "Steering",
  "Suspension",
  "Fluids and leaks",
  "Battery and electrical",
  "Safety equipment",
] as const;

export const STATUS_LABEL: Record<RecordStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function getMaintenanceStatus(record: MaintenanceRecord, vehicle?: MaintenanceVehicle | null, now = new Date()): RecordStatus {
  const status = String(record.status || (record.performed_at ? "completed" : "scheduled")).toLowerCase().replace(/[ -]+/g, "_");
  if (["in_progress", "completed", "cancelled"].includes(status)) return status as RecordStatus;
  const mileage = Number(vehicle?.mileage ?? vehicle?.odometer);
  const dueMileage = Number(record.next_due_mileage);
  if (Number.isFinite(mileage) && Number.isFinite(dueMileage) && dueMileage > 0 && mileage >= dueMileage) return "overdue";
  const dueAt = record.next_due_date || record.scheduled_at;
  if (dueAt) {
    const date = new Date(dueAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (Number.isFinite(date.getTime()) && date < today) return "overdue";
  }
  return status === "overdue" ? "overdue" : "scheduled";
}

export function getFollowUpState(record: MaintenanceRecord, vehicle?: MaintenanceVehicle | null, now = new Date()) {
  if (String(record.status || "").toLowerCase() !== "completed") return null;
  const currentMileage = Number(vehicle?.mileage ?? vehicle?.odometer);
  const nextMileage = Number(record.next_due_mileage);
  if (Number.isFinite(currentMileage) && Number.isFinite(nextMileage) && nextMileage > 0 && currentMileage >= nextMileage) return "overdue" as const;
  if (record.next_due_date) {
    const dueDate = new Date(record.next_due_date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (Number.isFinite(dueDate.getTime())) {
      if (dueDate < today) return "overdue" as const;
      if (dueDate < new Date(today.getTime() + 8 * 86_400_000)) return "due_soon" as const;
    }
  }
  return null;
}
export function totalMaintenanceCost(record: MaintenanceRecord) {
  const hasBreakdown = record.labor_cost != null || record.parts_cost != null;
  if (hasBreakdown) return (Number(record.labor_cost) || 0) + (Number(record.parts_cost) || 0);
  return Number(record.cost) || 0;
}

export function vehicleLabel(vehicle?: MaintenanceVehicle | null, fallbackId = "") {
  if (!vehicle) return fallbackId || "Vehicle not linked";
  return vehicle.plate_number || [vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") || vehicle.id || fallbackId || "Vehicle not identified";
}

export function formatMaintenanceDate(value?: string | null, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-PH", options) : "Not recorded";
}

export function formatMaintenanceTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "";
}

export function formatMaintenanceCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

export function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  first.setDate(first.getDate() - first.getDay());
  return first;
}

export function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}