import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestProfile, forbidden } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateStaffingForecast } from '@/lib/gemini';
import { canUseAiForecast } from '@/utils/rbac';
import type { WorkforceForecast, SkillingProgress } from '@/types/workforce';

/**
 * POST /api/ai/forecast
 * Generates a staffing forecast via Gemini using real workforce_forecast +
 * skilling_progress data. HR staff (incl. HR Generalist) + Managers only. The
 * Gemini key stays on the server; falls back to a heuristic if no key is
 * configured.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await getRequestProfile(req, res);
  if (!canUseAiForecast(auth.role)) {
    return forbidden(res, 'Only HR staff and Managers can run AI forecasts');
  }

  // Use the admin client for the analytics reads (service-role, server-only).
  const admin = getSupabaseAdmin();

  const [{ data: forecast }, { data: skilling }] = await Promise.all([
    admin.from('workforce_forecast').select('*').order('created_at', { ascending: true }),
    admin.from('skilling_progress').select('*'),
  ]);

  const result = await generateStaffingForecast(
    (forecast ?? []) as WorkforceForecast[],
    (skilling ?? []) as SkillingProgress[]
  );

  return res.status(200).json({ analysis: result.text, source: result.source });
}
