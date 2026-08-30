import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Employee, UserRole } from '@/types/workforce';

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

  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('email', DEFAULT_EMAIL)
    .single();

  if (error || !data) {
    throw new Error(`No default profile available: ${error?.message ?? 'not found'}`);
  }

  const profile = data as Employee;
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
