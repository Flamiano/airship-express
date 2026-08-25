import type { UserRole } from '@/types/workforce';

/**
 * Role-Based Access Control helpers.
 *
 * These are used both client-side (to conditionally render actions) and
 * server-side (to authorize API routes). RLS in Postgres is the ultimate
 * enforcement layer — these helpers are the application-level gate.
 *
 * The roster stores each employee's real position as their `role`. The app-level
 * HR Admin / Operations Manager / Fleet Driver roles are kept for the demo
 * identity and as fallbacks; the real positions map onto them like so:
 *   - HR Admin power:   HR Admin, HR Generalist, HR Officer
 *   - Manager power:    Operations Manager, Office-in-Charge
 *   - Driver view:      all rider/driver positions + Fleet Driver
 */

export const HR_ROLES = ['HR Admin', 'HR Generalist', 'HR Officer'] as const;
export const MANAGER_ROLES = ['Operations Manager', 'Office-in-Charge'] as const;
export const DRIVER_ROLES = [
  'Fleet Driver',
  'Hybrid/Rider',
  'Appraiser/Rider',
  'Rider',
  'In-House Rider',
  'JNT Pick-Up Rider',
  'Airship Driver',
  'Drop-Off Pick-Up Rider',
  'Manila Rider',
] as const;

const isOneOf = (role: UserRole | null | undefined, roles: readonly string[]): boolean =>
  role != null && (roles as readonly string[]).includes(role);

export function isHRAdmin(role: UserRole | null | undefined): boolean {
  return isOneOf(role, HR_ROLES);
}

export function isManager(role: UserRole | null | undefined): boolean {
  return isOneOf(role, MANAGER_ROLES);
}

// HR Admin (incl. HR Generalist / HR Officer) only
export function canApproveTimesheets(role: UserRole | null | undefined): boolean {
  return isHRAdmin(role);
}

// HR Admin (incl. HR Generalist / HR Officer) only
export function canApproveLeave(role: UserRole | null | undefined): boolean {
  return isHRAdmin(role);
}

// HR Admin + Managers can build the schedule
export function canCreateShifts(role: UserRole | null | undefined): boolean {
  return isHRAdmin(role) || isManager(role);
}

// HR Admin + Managers can create loads and assign drivers
export function canManageLoads(role: UserRole | null | undefined): boolean {
  return isHRAdmin(role) || isManager(role);
}

// HR Admin + Managers can see the full analytics dashboard;
// drivers get a reduced personal view.
export function canViewFullAnalytics(role: UserRole | null | undefined): boolean {
  return isHRAdmin(role) || isManager(role);
}

// Anyone authenticated can request leave for themselves
export function canRequestLeave(role: UserRole | null | undefined): boolean {
  return role != null;
}

// HR Admin + Managers can edit/override attendance records
export function canManageAttendance(role: UserRole | null | undefined): boolean {
  return isHRAdmin(role) || isManager(role);
}

// Gemini AI staffing forecast — available to HR staff (incl. HR Generalist /
// HR Officer) and Managers. Mirrors the /api/ai/forecast gate.
export function canUseAiForecast(role: UserRole | null | undefined): boolean {
  return isHRAdmin(role) || isManager(role);
}
