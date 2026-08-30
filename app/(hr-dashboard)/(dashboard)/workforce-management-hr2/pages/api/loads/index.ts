import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestProfile, forbidden } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageLoads } from '@/utils/rbac';
import { isMissingTableError } from '@/lib/supabaseErrors';
import type { CreateLoadPayload } from '@/types/api';

const MISSING_TABLE_HINT =
  'The freight_loads table is not set up yet. Run supabase/schema.sql in the SQL Editor, then npm run db:setup.';

/**
 * GET  /api/loads  → list freight loads (RLS-scoped)
 * POST /api/loads  → create a load (HR Admin / Manager only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await getRequestProfile(req, res);

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('freight_loads')
      .select('*, driver:profiles(*)')
      .order('pickup_date', { ascending: true });
    if (error) {
      if (isMissingTableError(error)) {
        return res.status(200).json({ data: [], warning: MISSING_TABLE_HINT });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    if (!canManageLoads(auth.role)) return forbidden(res);
    const { load_ref, origin, destination, pickup_date, priority } = req.body as CreateLoadPayload;
    if (!load_ref || !origin || !destination || !pickup_date || !priority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('freight_loads')
      .insert({
        load_ref,
        origin,
        destination,
        pickup_date,
        status: 'Pending Driver',
        priority,
      })
      .select('*, driver:profiles(*)')
      .single();
    if (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({ error: MISSING_TABLE_HINT });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
