import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getRequestProfileAppRouter } from '../../../lib/apiAuthAppRouter';
import { canCreateShifts } from '../../../utils/rbac';

const formatShift = (row: any) => {
  if (!row) return row;
  const emp = row.employee;
  const mappedEmployee = emp
    ? {
        id: emp.id,
        email: emp.email || '',
        full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee',
        role: emp.job_position?.title || emp.department || 'Staff',
        avatar_initials: `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase() || 'E',
        department: emp.department || 'HQ',
        created_at: emp.date_hired || row.created_at,
      }
    : undefined;
  return { ...row, employee: mappedEmployee };
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getRequestProfileAppRouter();
  if (!canCreateShifts(auth.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const body = await request.json();
  const { title, employee_id, shift_date, shift_time, break_time, status, override_reason, is_deleted, gate_in, gate_out } = body;
  
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (employee_id !== undefined) updates.employee_id = employee_id || null;
  if (shift_date !== undefined) updates.shift_date = shift_date;
  if (shift_time !== undefined) updates.shift_time = shift_time;
  if (break_time !== undefined) updates.break_time = break_time;
  if (status !== undefined) updates.status = status;
  if (override_reason !== undefined) updates.override_reason = override_reason;
  if (is_deleted !== undefined) updates.is_deleted = is_deleted;
  if (gate_in !== undefined) updates.gate_in = gate_in;
  if (gate_out !== undefined) updates.gate_out = gate_out;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_shifts')
    .update(updates)
    .eq('id', params.id)
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: formatShift(data) });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getRequestProfileAppRouter();
  if (!canCreateShifts(auth.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('hr2_shifts')
    .update({ is_deleted: true })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
