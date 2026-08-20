import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestProfile, forbidden } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canApproveLeave } from '@/utils/rbac';
import type { CreateLeavePayload, UpdateLeavePayload } from '@/types/api';

/** Whole-day inclusive difference between two ISO dates. */
function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

/**
 * GET   /api/leave  → list leave requests (RLS: employees see own, HR sees all)
 * POST  /api/leave  → create request for self (any authenticated user)
 * PATCH /api/leave  → approve / reject (HR Admin only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getRequestProfile(req, res);

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, employee:profiles(*)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    if (!req.body) return res.status(400).json({ error: 'Missing request body' });
    const { leave_type, start_date, end_date, reason } = req.body as CreateLeavePayload;
    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: auth.userId, // Always request for self
        leave_type,
        start_date,
        end_date,
        days_count: daysBetween(start_date, end_date),
        reason: reason ?? null,
        status: 'Pending HR Review',
      })
      .select('*, employee:profiles(*)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }

  if (req.method === 'PATCH') {
    if (!canApproveLeave(auth.role)) return forbidden(res);
    if (!req.body) return res.status(400).json({ error: 'Missing request body' });
    const { id, status } = req.body as UpdateLeavePayload;
    if (!id || !status) return res.status(400).json({ error: 'Missing id or status' });

    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', id)
      .select('*, employee:profiles(*)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
