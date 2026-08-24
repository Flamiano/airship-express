import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sanitizeSearchQuery } from '@/lib/searchSanitize';
import type { SearchResult } from '@/types/api';

const PER_GROUP = 5;

/** Supabase returns a to-one embedded relation as an object (or null). */
type Named = { full_name: string | null } | null;
function nameOf(rel: Named): string {
  return rel?.full_name ?? 'Unassigned';
}

/**
 * GET /api/search?q=...
 *
 * Global command-palette search across People / Shifts / Timesheets / Leave /
 * Freight Loads.
 * Every query runs through the caller's cookie session, so Row-Level Security
 * scopes results automatically (e.g. a Fleet Driver only matches their own
 * timesheets / leave). Each entity group is capped at PER_GROUP hits.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q ?? '';
  const q = sanitizeSearchQuery(raw);
  if (q.length < 2) {
    return res.status(200).json({ data: [] as SearchResult[] });
  }

  const supabase = getSupabaseAdmin();
  const pat = `%${q}%`;

  // Each query is independent and error-tolerant: one failing table (or an RLS
  // block) must not sink the whole search.
  const [people, shifts, timesheets, leave, loads] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, terminal')
      .or(`full_name.ilike.${pat},role.ilike.${pat},terminal.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('shifts')
      .select('id, title, vehicle, status, driver:profiles(full_name)')
      .or(`title.ilike.${pat},vehicle.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('timesheets')
      .select('id, load_ref, status, week_start, week_end, employee:profiles(full_name)')
      .or(`load_ref.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('leave_requests')
      .select('id, leave_type, status, start_date, end_date, employee:profiles(full_name)')
      .or(`leave_type.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from('freight_loads')
      .select('id, load_ref, origin, destination, status, driver:profiles(full_name)')
      .or(`load_ref.ilike.${pat},origin.ilike.${pat},destination.ilike.${pat},status.ilike.${pat}`)
      .limit(PER_GROUP)
      .then((r) => r.data ?? [], () => []),
  ]);

  const results: SearchResult[] = [
    ...people.map(
      (p: any): SearchResult => ({
        id: p.id,
        type: 'person',
        title: p.full_name ?? 'Unknown',
        subtitle: [p.role, p.terminal].filter(Boolean).join(' • '),
        href: '/attendance',
      })
    ),
    ...shifts.map(
      (s: any): SearchResult => ({
        id: s.id,
        type: 'shift',
        title: s.title,
        subtitle: `${nameOf(s.driver)} • ${s.vehicle} • ${s.status}`,
        href: '/shifts',
      })
    ),
    ...timesheets.map(
      (t: any): SearchResult => ({
        id: t.id,
        type: 'timesheet',
        title: `${nameOf(t.employee)} — ${t.load_ref ?? 'No ref'}`,
        subtitle: `${t.week_start} → ${t.week_end} • ${t.status}`,
        href: '/timesheets',
      })
    ),
    ...leave.map(
      (l: any): SearchResult => ({
        id: l.id,
        type: 'leave',
        title: `${nameOf(l.employee)} — ${l.leave_type}`,
        subtitle: `${l.start_date} → ${l.end_date} • ${l.status}`,
        href: '/leave',
      })
    ),
    ...loads.map(
      (ld: any): SearchResult => ({
        id: ld.id,
        type: 'load',
        title: `${ld.load_ref} — ${ld.origin} → ${ld.destination}`,
        subtitle: `${nameOf(ld.driver)} • ${ld.status}`,
        href: '/loads',
      })
    ),
  ];

  return res.status(200).json({ data: results });
}
