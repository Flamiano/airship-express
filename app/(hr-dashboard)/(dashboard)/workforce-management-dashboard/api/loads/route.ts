import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { canManageLoads } from '../../utils/rbac';
import { getRequestProfileAppRouter } from '../../lib/apiAuthAppRouter';
import { isMissingTableError } from '../../lib/supabaseErrors';
import type { CreateLoadPayload } from '../../types/api';

const MISSING_TABLE_HINT =
  'The freight_loads table is not set up yet. Run supabase/schema.sql in the SQL Editor, then npm run db:setup.';

const formatLoad = (row: any) => {
  if (!row) return row;
  const emp = row.driver;
  const mappedDriver = emp
    ? {
        id: emp.id,
        email: emp.email || '',
        full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Driver',
        role: emp.job_position?.title || emp.department || 'Fleet Driver',
        avatar_initials: `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase() || 'D',
        terminal: emp.department || 'HQ',
        created_at: emp.date_hired || row.created_at,
        rfid_uid: null,
      }
    : undefined;

  return {
    ...row,
    driver: mappedDriver,
  };
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_freight_loads')
    .select('*, driver:hr1_employees(*, job_position:hr1_job_positions(title))')
    .order('pickup_date', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ data: [], warning: MISSING_TABLE_HINT }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: (data || []).map(formatLoad) });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestProfileAppRouter();
  if (!canManageLoads(auth.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { load_ref, origin, destination, pickup_date, priority } = body as CreateLoadPayload;
  if (!load_ref || !origin || !destination || !pickup_date || !priority) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_freight_loads')
    .insert({
      load_ref,
      origin,
      destination,
      pickup_date,
      status: 'Pending Driver',
      priority,
    })
    .select('*, driver:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MISSING_TABLE_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: formatLoad(data) }, { status: 201 });
}
