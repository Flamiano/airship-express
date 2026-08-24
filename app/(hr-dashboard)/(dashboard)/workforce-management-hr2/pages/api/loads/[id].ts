import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestProfile, forbidden } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageLoads } from '@/utils/rbac';
import type { UpdateLoadPayload } from '@/types/api';

/**
 * PATCH /api/loads/[id] → assign a driver and/or update status (HR / Manager only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getRequestProfile(req, res);
  if (!canManageLoads(auth.role)) return forbidden(res);

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();
  const { id } = req.query as { id: string };
  if (!req.body) return res.status(400).json({ error: 'Missing request body' });
  const { driver_id, status } = req.body as UpdateLoadPayload;

  const patch: { driver_id?: string | null; status?: string } = {};
  if (driver_id !== undefined) patch.driver_id = driver_id;
  if (status !== undefined) patch.status = status;
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const { data, error } = await supabase
    .from('freight_loads')
    .update(patch)
    .eq('id', id)
    .select('*, driver:profiles(*)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
