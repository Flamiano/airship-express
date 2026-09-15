import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { isMissingTableError } from '../../lib/supabaseErrors';
import type { PerformanceMetrics } from '../../types/workforce';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [
    { data: forecast, error: fErr },
    { data: skilling, error: sErr },
    { data: performanceRows, error: pErr },
    { count: workforce, error: wErr },
  ] = await Promise.all([
    supabase.from('hr2_workforce_forecast').select('*').order('created_at', { ascending: true }),
    supabase.from('hr2_skilling_progress').select('*').order('completion_rate', { ascending: false }),
    supabase
      .from('hr2_performance_metrics')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1),
    supabase.from('hr1_employees').select('id', { count: 'exact', head: true }),
  ]);

  if (fErr || sErr || wErr) {
    return NextResponse.json(
      { error: fErr?.message || sErr?.message || wErr?.message },
      { status: 500 }
    );
  }

  const perfMissing = isMissingTableError(pErr);
  if (pErr && !perfMissing) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const performance = perfMissing
    ? null
    : (performanceRows?.[0] as PerformanceMetrics | undefined) ?? null;

  return NextResponse.json({
    data: {
      forecast: forecast ?? [],
      skilling: skilling ?? [],
      performance,
      workforce: workforce ?? 0,
    },
  });
}
