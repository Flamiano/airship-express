import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DRIVER_ROLES } from '@/utils/rbac';

/**
 * GET /api/drivers
 * Returns driver profiles (id, full_name, role, terminal) for every rider /
 * driver position in the roster with a live `on_shift` flag from the attendance
 * feed. Used to populate driver dropdowns on the shifts and loads pages. Runs
 * on the admin client so it works without a signed-in session.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = getSupabaseAdmin();

  const [
    { data: drivers, error: dErr },
    { data: attendance, error: aErr },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, role, terminal')
      .in('role', [...DRIVER_ROLES])
      .order('full_name'),
    admin.from('attendance_logs').select('employee_id').eq('status', 'On-Shift'),
  ]);

  if (dErr || aErr) {
    return res.status(500).json({ error: dErr?.message ?? aErr?.message });
  }

  const onShift = new Set((attendance ?? []).map((r) => r.employee_id));

  return res.status(200).json({
    data: (drivers ?? []).map((d) => ({ ...d, on_shift: onShift.has(d.id) })),
  });
}
