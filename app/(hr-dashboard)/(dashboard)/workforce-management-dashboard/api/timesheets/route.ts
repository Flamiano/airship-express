import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { canApproveTimesheets } from '../../utils/rbac';
import { getRequestProfileAppRouter } from '../../lib/apiAuthAppRouter';
import type { UpdateTimesheetPayload } from '../../types/api';

const formatTimesheet = (row: any) => {
  if (!row) return row;
  const emp = row.employee;
  const mappedEmployee = emp
    ? {
        id: emp.id,
        email: emp.email || '',
        full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee',
        role: emp.job_position?.title || emp.department || 'Staff',
        avatar_initials: `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase() || 'E',
        terminal: emp.department || 'HQ',
        created_at: emp.date_hired || row.created_at,
        rfid_uid: null,
      }
    : undefined;

  return {
    ...row,
    employee: mappedEmployee,
  };
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_timesheets')
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .order('week_start', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []).map(formatTimesheet) });
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestProfileAppRouter();
  if (!canApproveTimesheets(auth.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { id, status } = body as UpdateTimesheetPayload;
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_timesheets')
    .update({ status })
    .eq('id', id)
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: formatTimesheet(data) });
}
