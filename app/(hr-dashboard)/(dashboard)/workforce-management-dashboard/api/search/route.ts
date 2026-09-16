import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { sanitizeSearchQuery } from '../../lib/searchSanitize';
import type { SearchResult } from '../../types/api';

const PER_GROUP = 5;

type Named = { full_name: string | null } | null;
function nameOf(rel: any): string {
  if (!rel) return 'Unassigned';
  if (rel.full_name) return rel.full_name;
  const name = `${rel.first_name || ''} ${rel.last_name || ''}`.trim();
  return name || 'Unassigned';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const raw = searchParams.get('q') || '';
  const q = sanitizeSearchQuery(raw);
  
  if (q.length < 2) {
    return NextResponse.json({ data: [] as SearchResult[] });
  }

  const supabase = getSupabaseAdmin();
  const pat = `%${q}%`;

  const [people, shifts, timesheets, leave, loads] = await Promise.all([
    supabase
      .from('hr1_employees')
      .select('id, first_name, last_name, department, job_position:hr1_job_positions(title)')
      .or(`first_name.ilike.${pat},last_name.ilike.${pat},department.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('hr2_shifts')
      .select('id, title, vehicle, status, driver:hr1_employees(first_name, last_name)')
      .or(`title.ilike.${pat},vehicle.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('hr2_timesheets')
      .select('id, load_ref, status, week_start, week_end, employee:hr1_employees(first_name, last_name)')
      .or(`load_ref.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('hr2_leave_requests')
      .select('id, leave_type, status, start_date, end_date, employee:hr1_employees(first_name, last_name)')
      .or(`leave_type.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('hr2_freight_loads')
      .select('id, load_ref, origin, destination, status, driver:hr1_employees(first_name, last_name)')
      .or(`load_ref.ilike.${pat},origin.ilike.${pat},destination.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
  ]);

  const results: SearchResult[] = [
    ...people.map(
      (p: any): SearchResult => {
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';
        const role = p.job_position?.title || p.department || 'Staff';
        return {
          id: p.id,
          type: 'person',
          title: fullName,
          subtitle: [role, p.department].filter(Boolean).join(' • '),
          href: '/workforce-management-dashboard/attendance',
        };
      }
    ),
    ...shifts.map(
      (s: any): SearchResult => ({
        id: s.id,
        type: 'shift',
        title: s.title,
        subtitle: `${nameOf(s.driver)} • ${s.vehicle} • ${s.status}`,
        href: '/workforce-management-dashboard/shifts',
      })
    ),
    ...timesheets.map(
      (t: any): SearchResult => ({
        id: t.id,
        type: 'timesheet',
        title: `${nameOf(t.employee)} — ${t.load_ref ?? 'No ref'}`,
        subtitle: `${t.week_start} → ${t.week_end} • ${t.status}`,
        href: '/workforce-management-dashboard/timesheets',
      })
    ),
    ...leave.map(
      (l: any): SearchResult => ({
        id: l.id,
        type: 'leave',
        title: `${nameOf(l.employee)} — ${l.leave_type}`,
        subtitle: `${l.start_date} → ${l.end_date} • ${l.status}`,
        href: '/workforce-management-dashboard/leave',
      })
    ),
    ...loads.map(
      (ld: any): SearchResult => ({
        id: ld.id,
        type: 'load',
        title: `${ld.load_ref} — ${ld.origin} → ${ld.destination}`,
        subtitle: `${nameOf(ld.driver)} • ${ld.status}`,
        href: '/workforce-management-dashboard/loads',
      })
    ),
  ];

  return NextResponse.json({ data: results });
}
