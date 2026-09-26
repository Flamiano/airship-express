import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { canManageAttendance } from '../../utils/rbac';
import { getRequestProfileAppRouter } from '../../lib/apiAuthAppRouter';

const formatAttendance = (row: any) => {
  if (!row) return row;
  const emp = row.employee;
  const rfidUid = Array.isArray(emp.rfid) ? emp.rfid[0]?.rfid_uid : emp.rfid?.rfid_uid;
  const mappedEmployee = emp
    ? {
        id: emp.id,
        email: emp.email || '',
        full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee',
        role: emp.job_position?.title || emp.department || 'Staff',
        department: emp.department || 'Unassigned',
        avatar_initials: `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase() || 'E',
        terminal: emp.department || row.terminal || 'HQ',
        created_at: emp.date_hired || row.created_at,
        rfid_uid: rfidUid || null,
      }
    : undefined;
  return { ...row, employee: mappedEmployee };
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_attendance_logs')
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title), rfid:hr2_rfid_bind(rfid_uid))')
    .order('last_scan', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []).map(formatAttendance) });
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestProfileAppRouter();
  if (!canManageAttendance(auth.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const body = await request.json();
  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_attendance_logs')
    .update({ status, last_scan: new Date().toISOString() })
    .eq('id', id)
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: formatAttendance(data) });
}
