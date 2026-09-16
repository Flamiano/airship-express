import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { canApproveLeave } from '../../utils/rbac';
import { getRequestProfileAppRouter } from '../../lib/apiAuthAppRouter';
import type { CreateLeavePayload, UpdateLeavePayload } from '../../types/api';

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

const formatLeave = (row: any) => {
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
    .from('hr2_leave_requests')
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []).map(formatLeave) });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestProfileAppRouter();
  const body = await request.json();
  const { leave_type, start_date, end_date, reason } = body as CreateLeavePayload;
  if (!leave_type || !start_date || !end_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_leave_requests')
    .insert({
      employee_id: auth.userId,
      leave_type,
      start_date,
      end_date,
      days_count: daysBetween(start_date, end_date),
      reason: reason ?? null,
      status: 'Pending HR Review',
    })
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: formatLeave(data) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestProfileAppRouter();
  if (!canApproveLeave(auth.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { id, status } = body as UpdateLeavePayload;
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_leave_requests')
    .update({ status })
    .eq('id', id)
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: formatLeave(data) });
}
