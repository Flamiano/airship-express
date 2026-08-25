import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET  /api/profiles → list all employees in the roster with their RFID UID
 * POST /api/profiles/pair → assign an RFID UID to an employee
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Database error' });
    }
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).json({ error: 'Method not allowed' });
}
