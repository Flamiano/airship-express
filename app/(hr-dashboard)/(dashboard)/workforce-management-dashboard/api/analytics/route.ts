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
    supabase.from('hr2_skilling_progress').select('*'),
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

  const normalizedForecast = (forecast ?? []).map((f) => ({
    ...f,
    deficit:
      typeof f.deficit === 'number'
        ? f.deficit
        : (f.required_staff ?? 0) - (f.current_staff ?? 0),
  }));

  const normalizedSkilling = (skilling ?? [])
    .map((s) => {
      const completion_rate =
        typeof s.completion_rate === 'number'
          ? s.completion_rate
          : s.total_count > 0
          ? Math.round((s.certified_count / s.total_count) * 100)
          : 0;
      return {
        ...s,
        completion_rate,
        completion_pct: completion_rate,
      };
    })
    .sort((a, b) => b.completion_rate - a.completion_rate);

  return NextResponse.json({
    data: {
      forecast: normalizedForecast,
      skilling: normalizedSkilling,
      performance,
      workforce: workforce ?? 0,
    },
  });
}

