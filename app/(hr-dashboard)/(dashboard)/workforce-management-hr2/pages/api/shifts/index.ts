import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestProfile, forbidden } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canCreateShifts } from '@/utils/rbac';
import type { CreateShiftPayload } from '@/types/api';

/**
 * GET  /api/shifts  → list shifts (RLS-scoped)
 * POST /api/shifts → create a shift (HR Admin / Manager only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getRequestProfile(req, res);

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('shifts')
      .select('*, driver:profiles(*)')
      .order('shift_date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    if (!canCreateShifts(auth.role)) return forbidden(res);
    if (!req.body) return res.status(400).json({ error: 'Missing request body' });
    const payload = req.body as CreateShiftPayload;
    const { title, driver_id, vehicle, shift_date, shift_time, priority } = payload;
    if (!title || !vehicle || !shift_date || !shift_time || !priority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        title,
        driver_id,
        vehicle,
        shift_date,
        shift_time,
        status: 'Scheduled',
        priority,
      })
      .select('*, driver:profiles(*)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
