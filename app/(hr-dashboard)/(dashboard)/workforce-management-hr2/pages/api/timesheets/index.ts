import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestProfile, forbidden } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canApproveTimesheets } from '@/utils/rbac';
import type { UpdateTimesheetPayload } from '@/types/api';

/**
 * GET   /api/timesheets  → list timesheets (RLS: employees see own, HR/Mgr see all)
 * PATCH /api/timesheets  → approve / flag / reject (HR Admin only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getRequestProfile(req, res);

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*, employee:profiles(*)')
      .order('week_start', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'PATCH') {
    if (!canApproveTimesheets(auth.role)) return forbidden(res);
    if (!req.body) return res.status(400).json({ error: 'Missing request body' });
    const { id, status } = req.body as UpdateTimesheetPayload;
    if (!id || !status) return res.status(400).json({ error: 'Missing id or status' });

    const { data, error } = await supabase
      .from('timesheets')
      .update({ status })
      .eq('id', id)
      .select('*, employee:profiles(*)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
