import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { getRequestProfileAppRouter } from '../../lib/apiAuthAppRouter';
import { canCreateShifts } from '../../utils/rbac';

const formatShift = (row: any) => {
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
  return { ...row, employee: mappedDriver, employee_id: row.driver_id };
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_shifts')
    .select('*, driver:hr1_employees(*, job_position:hr1_job_positions(title))')
    .order('shift_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []).map(formatShift) });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestProfileAppRouter();
  if (!canCreateShifts(auth.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const body = await request.json();
  const { title, driver_id, vehicle, shift_date, shift_time, priority } = body;
  if (!title || !vehicle || !shift_date || !shift_time || !priority) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_shifts')
    .insert({ title, driver_id, vehicle, shift_date, shift_time, status: 'Scheduled', priority })
    .select('*, driver:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: formatShift(data) }, { status: 201 });
}
