import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { Employee, UserRole } from '../types/workforce';

/**
 * The demo account the app runs as now that sign-in is removed. Points at a real
 * roster employee (HR Generalist) so approval/management powers still work.
 */
const DEFAULT_EMAIL = 'meliza.bangkok@airshipexpress.test';

/**
 * Resolves the profile used for every API route. Sign-in has been removed, so
 * this always returns the demo profile (fetched via the service-role client,
 * which bypasses RLS) instead of reading the cookie session. The DB now has the
 * correct role for the demo account (HR Generalist).
 */
export async function getRequestProfile(
  _req: NextApiRequest,
  _res: NextApiResponse
): Promise<{ userId: string; role: UserRole; profile: Employee }> {
  const admin = getSupabaseAdmin();

  // Try to find the demo/HR employee in hr1_employees
  const { data, error } = await admin
    .from('hr1_employees')
    .select('id, email, first_name, last_name, department, job_position:hr1_job_positions(title)')
    .eq('department', 'HR')
    .limit(1)
    .single();

  if (error || !data) {
    // Fallback demo employee if table is empty
    const fallbackProfile: Employee = {
      id: 'a9c8176c-a4d1-4aa9-8cd0-1e6efda85f2d',
      email: 'jose.ramos@airshipexpress.com',
      full_name: 'Jose Ramos',
      role: 'HR Generalist',
      avatar_initials: 'JR',
      terminal: 'HQ — Operations Center',
      created_at: new Date().toISOString(),
    };
    return { userId: fallbackProfile.id, role: fallbackProfile.role, profile: fallbackProfile };
  }

  const roleTitle = (data as any).job_position?.title || 'HR Generalist';
  const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'HR Admin';
  const initials = `${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`.toUpperCase() || 'HR';

  const profile: Employee = {
    id: data.id,
    email: data.email || 'hr@airshipexpress.com',
    full_name: fullName,
    role: 'HR Generalist', // Ensure HR permissions in RBAC
    avatar_initials: initials,
    terminal: data.department || 'HQ — Operations Center',
    created_at: new Date().toISOString(),
  };

  return { userId: profile.id, role: profile.role, profile };
}

/** Standard 401 helper. */
export function unauthorized(res: NextApiResponse) {
  return res.status(401).json({ error: 'Not authenticated' });
}

/** Standard 403 helper. */
export function forbidden(res: NextApiResponse, message = 'Insufficient permissions') {
  return res.status(403).json({ error: message });
}
