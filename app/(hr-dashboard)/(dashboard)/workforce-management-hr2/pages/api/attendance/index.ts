import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestProfile, forbidden } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageAttendance } from '@/utils/rbac';
import type { UpdateAttendancePayload } from '@/types/api';

/**
 * GET  /api/attendance  → list attendance logs (RLS-scoped to caller)
 * PATCH /api/attendance → update a status (HR Admin / Manager only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getRequestProfile(req, res);

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, employee:profiles(*)')
      .order('last_scan', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'PATCH') {
    if (!canManageAttendance(auth.role)) return forbidden(res);
    if (!req.body) return res.status(400).json({ error: 'Missing request body' });
    const { id, status } = req.body as UpdateAttendancePayload;
    if (!id || !status) return res.status(400).json({ error: 'Missing id or status' });

    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ status, last_scan: new Date().toISOString() })
      .eq('id', id)
      .select('*, employee:profiles(*)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
