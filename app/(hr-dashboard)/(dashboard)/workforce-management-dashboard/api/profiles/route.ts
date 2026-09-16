import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('hr1_employees')
      .select('id, employee_id_number, first_name, last_name, email, department, date_hired, status, job_position:hr1_job_positions(title), rfid:hr2_rfid_bind(rfid_uid, card_status)')
      .order('first_name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (data || []).map((emp: any) => {
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unnamed';
      const initials = `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase() || 'E';
      const role = emp.job_position?.title || emp.department || 'Staff';

      let rfidUid: string | null = null;
      if (Array.isArray(emp.rfid) && emp.rfid.length > 0) {
        rfidUid = emp.rfid[0]?.rfid_uid || null;
      } else if (emp.rfid && typeof emp.rfid === 'object') {
        rfidUid = emp.rfid.rfid_uid || null;
      }

      return {
        id: emp.id,
        email: emp.email || '',
        full_name: fullName,
        role,
        avatar_initials: initials,
        terminal: emp.department || 'HQ — Operations',
        created_at: emp.date_hired || new Date().toISOString(),
        rfid_uid: rfidUid,
      };
    });

    return NextResponse.json({ data: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Database error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');

    if (!employeeId) {
      return NextResponse.json({ error: 'employee_id parameter is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('hr2_rfid_bind')
      .delete()
      .eq('employee_id', employeeId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Card unbound successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to unbind card' }, { status: 500 });
  }
}

