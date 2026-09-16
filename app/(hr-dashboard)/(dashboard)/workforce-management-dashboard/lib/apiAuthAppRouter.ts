import { getSupabaseAdmin } from './supabaseAdmin';
import type { Employee, UserRole } from '../types/workforce';

/**
 * App Router version of getRequestProfile. Since sign-in has been removed,
 * this always returns the demo HR profile (same logic as the Pages Router
 * version in apiAuth.ts).
 */
export async function getRequestProfileAppRouter(): Promise<{
  userId: string;
  role: UserRole;
  profile: Employee;
}> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('hr1_employees')
    .select('id, email, first_name, last_name, department, job_position:hr1_job_positions(title)')
    .eq('department', 'HR')
    .limit(1)
    .single();

  if (error || !data) {
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

  const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'HR Admin';
  const initials = `${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`.toUpperCase() || 'HR';

  const profile: Employee = {
    id: data.id,
    email: data.email || 'hr@airshipexpress.com',
    full_name: fullName,
    role: 'HR Generalist',
    avatar_initials: initials,
    terminal: data.department || 'HQ — Operations Center',
    created_at: new Date().toISOString(),
  };

  return { userId: profile.id, role: profile.role, profile };
}
