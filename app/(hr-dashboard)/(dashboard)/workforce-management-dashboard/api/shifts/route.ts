import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { getRequestProfileAppRouter } from '../../lib/apiAuthAppRouter';
import { canCreateShifts } from '../../utils/rbac';

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
  
  // Note: fleet_data is not in DB anymore. It's simulated or fetched from fleet. We'll leave it undefined here for real data unless we fetch it from Fleet.
  return { ...row, employee: mappedEmployee };
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_shifts')
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
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
  const { title, employee_id, shift_date, shift_time, break_time, status, override_reason } = body;
  
  if (!shift_date || !shift_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('hr2_shifts')
    .insert({ 
      title, 
      employee_id: employee_id || null, 
      shift_date, 
      shift_time, 
      break_time,
      status: status || 'Scheduled', 
      override_reason 
    })
    .select('*, employee:hr1_employees(*, job_position:hr1_job_positions(title))')
    .single();
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: formatShift(data) }, { status: 201 });
}
