import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isMissingTableError } from '@/lib/supabaseErrors';
import type { PerformanceMetrics } from '@/types/workforce';

/**
 * GET /api/analytics
 * Returns the datasets that power the dashboard charts:
 *   - workforce_forecast (Card 1)
 *   - skilling_progress  (Card 3)
 *   - performance        (Card 2 readouts + Card 3 course count, latest snapshot)
 *   - workforce          (total profiles count, powers the metric tiles)
 * Attendance (Card 4) is fetched separately via the realtime hook.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();

  const [
    { data: forecast, error: fErr },
    { data: skilling, error: sErr },
    { data: performanceRows, error: pErr },
    { count: workforce, error: wErr },
  ] = await Promise.all([
    supabase.from('workforce_forecast').select('*').order('created_at', { ascending: true }),
    supabase.from('skilling_progress').select('*').order('completion_rate', { ascending: false }),
    supabase
      .from('performance_metrics')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  if (fErr || sErr || wErr) {
    return res
      .status(500)
      .json({ error: fErr?.message || sErr?.message || wErr?.message });
  }

  // The performance_metrics table may not be applied yet (schema.sql not run
  // since it was added). Degrade gracefully instead of failing the dashboard:
  // Card 2 / Card 3 render "—" placeholders until it exists.
  const perfMissing = isMissingTableError(pErr);
  if (pErr && !perfMissing) {
    return res.status(500).json({ error: pErr.message });
  }

  const performance = perfMissing
    ? null
    : (performanceRows?.[0] as PerformanceMetrics | undefined) ?? null;

  return res.status(200).json({
    data: {
      forecast: forecast ?? [],
      skilling: skilling ?? [],
      performance,
      workforce: workforce ?? 0,
    },
  });
}
