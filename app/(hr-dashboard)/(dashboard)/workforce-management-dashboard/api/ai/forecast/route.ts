import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { generateStaffingForecast } from '../../../lib/gemini';
import { canUseAiForecast } from '../../../utils/rbac';
import { getRequestProfileAppRouter } from '../../../lib/apiAuthAppRouter';
import type { WorkforceForecast, SkillingProgress } from '../../../types/workforce';

export async function POST(request: NextRequest) {
  const auth = await getRequestProfileAppRouter();
  
  if (!canUseAiForecast(auth.role)) {
    return NextResponse.json({ error: 'Only HR staff and Managers can run AI forecasts' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const [{ data: forecast }, { data: skilling }] = await Promise.all([
    admin.from('hr2_workforce_forecast').select('*').order('created_at', { ascending: true }),
    admin.from('hr2_skilling_progress').select('*'),
  ]);

  const normalizedForecast = (forecast ?? []).map((f) => ({
    ...f,
    deficit:
      typeof f.deficit === 'number'
        ? f.deficit
        : (f.required_staff ?? 0) - (f.current_staff ?? 0),
  })) as WorkforceForecast[];

  const normalizedSkilling = (skilling ?? []).map((s) => ({
    ...s,
    completion_rate:
      typeof s.completion_rate === 'number'
        ? s.completion_rate
        : s.total_count > 0
        ? Math.round((s.certified_count / s.total_count) * 100)
        : 0,
  })) as SkillingProgress[];

  try {
    const result = await generateStaffingForecast(
      normalizedForecast,
      normalizedSkilling
    );

    return NextResponse.json({ analysis: result.text, source: result.source });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate forecast' }, { status: 500 });
  }
}
