// ============================================================================
// scripts/setup-database.mjs
//
// One-command demo populate for the Workforce Management sub-system.
//
// Run this from YOUR machine (it needs internet + your Supabase service-role
// key from .env.local):
//
//     node scripts/setup-database.mjs
//
// What it does, using the service-role key (bypasses RLS):
//   1. Removes leftover @freightpulse.test accounts and the old 6 demo accounts.
//   2. Creates one auth user per employee in employeelist.txt (61 people),
//      email pre-confirmed so you can log in immediately.
//   3. Upserts their `profiles` rows with their real position (role) / terminal.
//   4. Seeds workforce_forecast (Card 1), skilling_progress (Card 3), and the
//      performance_metrics snapshot (Card 2 readouts).
//   5. Seeds one live attendance_logs row per user (Card 4).
//   6. Seeds shifts, timesheets, leave_requests, and freight_loads tied to real
//      riders (loads include two unassigned, ready to dispatch).
//
// PREREQUISITE: run supabase/schema.sql in the Supabase SQL Editor FIRST so the
// tables, trigger, and RLS exist. This script fills data; it does not create
// tables (DDL over the API isn't supported — that's what the SQL Editor is for).
//
// Safe to re-run: stale demo accounts are removed, users are matched by email
// (not duplicated), analytics + attendance + shifts / timesheets / leave / loads
// are rebuilt each run against the current employeelist.txt roster.
// ============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---- tiny .env.local loader (no dependency on --env-file) ------------------
function loadEnv() {
  const env = {};
  let raw;
  try {
    raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  } catch {
    fail('Could not read .env.local. Create it (see README) before running.');
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const log = (...a) => console.log(...a);
const ok = (m) => console.log(`  ✓ ${m}`);
const info = (m) => console.log(`  → ${m}`);
function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// ---- date helpers (script runs on a real machine, so Date is available) -----
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// ---- real roster (employeelist.txt) -----------------------------------------
const DEMO_PASSWORD = 'AirshipExpress#2026';

// Position strings exactly as they appear in employeelist.txt (longest first so
// multi-word positions match before their shorter substrings).
const ROSTER_POSITIONS = [
  'DROP-OFF PICK-UP RIDER',
  'SALES REPRESENTATIVE',
  'PROJECT COORDINATOR',
  'JNT PICK-UP RIDER',
  'JNT PICK-UP RIDE', // typo in the source file — normalised to JNT Pick-Up Rider
  'MARKETING/ADMIN STAFF',
  'APPRAISER/RIDER',
  'HYBRID/RIDER',
  'IN-HOUSE RIDER',
  'OFFICE-IN-CHARGE',
  'AIRSHIP DRIVER',
  'ADMIN ASSISTANT',
  'HR GENERALIST',
  'HR OFFICER',
  'MANILA RIDER',
  'OFFICE STAFF',
  'CSR/MKTG STAFF',
  'APPRAISER',
  'RIDER',
];

// Normalise a raw roster position into the UserRole label stored in the DB.
const ROLE_OF_POSITION = {
  'HYBRID/RIDER': 'Hybrid/Rider',
  'APPRAISER': 'Appraiser',
  'APPRAISER/RIDER': 'Appraiser/Rider',
  'SALES REPRESENTATIVE': 'Sales Representative',
  'OFFICE STAFF': 'Office Staff',
  'CSR/MKTG STAFF': 'CSR/Marketing Staff',
  'RIDER': 'Rider',
  'PROJECT COORDINATOR': 'Project Coordinator',
  'OFFICE-IN-CHARGE': 'Office-in-Charge',
  'ADMIN ASSISTANT': 'Admin Assistant',
  'IN-HOUSE RIDER': 'In-House Rider',
  'JNT PICK-UP RIDER': 'JNT Pick-Up Rider',
  'JNT PICK-UP RIDE': 'JNT Pick-Up Rider',
  'AIRSHIP DRIVER': 'Airship Driver',
  'HR GENERALIST': 'HR Generalist',
  'HR OFFICER': 'HR Officer',
  'MARKETING/ADMIN STAFF': 'Marketing/Admin Staff',
  'DROP-OFF PICK-UP RIDER': 'Drop-Off Pick-Up Rider',
  'MANILA RIDER': 'Manila Rider',
};

// Positions that count as rider/driver roles (drivers dropdown, shift /
// timesheet / load seeding, and the Manila Hub terminal assignment).
const RIDER_ROLES = new Set([
  'Hybrid/Rider',
  'Appraiser/Rider',
  'Rider',
  'In-House Rider',
  'JNT Pick-Up Rider',
  'Airship Driver',
  'Drop-Off Pick-Up Rider',
  'Manila Rider',
]);

const titleCase = (s) =>
  s.split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');

// Parse employeelist.txt -> [{ email, full_name, role, terminal }]
function parseRoster() {
  const rows = [];
  const raw = readFileSync(join(ROOT, 'employeelist.txt'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const comma = trimmed.indexOf(',');
    if (comma === -1) fail(`Could not parse roster line: "${trimmed}"`);
    const last = trimmed.slice(0, comma).trim();
    const rest = trimmed.slice(comma + 1).trim();
    const upper = rest.toUpperCase();
    let position = null;
    for (const p of ROSTER_POSITIONS) {
      if (upper.endsWith(p)) {
        position = p;
        break;
      }
    }
    if (!position) fail(`Could not find position on roster line: "${trimmed}"`);
    const given = rest.slice(0, rest.length - position.length).trim();
    const role = ROLE_OF_POSITION[position];
    const first = given.split(/\s+/)[0].replace(/[^A-Za-z]/g, '').toLowerCase();
    const lname = last.replace(/[^A-Za-z]/g, '').toLowerCase();
    rows.push({
      email: `${first}.${lname}@airshipexpress.test`,
      full_name: `${titleCase(given)} ${titleCase(last)}`,
      role,
      terminal: RIDER_ROLES.has(role) ? 'Manila Hub' : 'HQ — Operations Center',
    });
  }
  if (rows.length === 0) fail('No employees parsed from employeelist.txt');
  const seen = new Set(rows.map((r) => r.email));
  if (seen.size !== rows.length) fail('Duplicate emails generated from employeelist.txt');
  return rows;
}

const USERS = parseRoster();

const initialsOf = (name) =>
  name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

// ---- create-or-find an auth user by email -----------------------------------
async function findUserByEmail(admin, email) {
  // listUsers is paginated; walk pages until we find it or run out.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break; // last page
  }
  return null;
}

async function ensureUser(admin, u) {
  const created = await admin.auth.admin.createUser({
    email: u.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });

  if (created.data?.user) {
    ok(`created ${u.email}  (${u.role})`);
    return created.data.user.id;
  }

  // Already exists (or a transient error) — look it up instead.
  const existing = await findUserByEmail(admin, u.email);
  if (existing) {
    info(`exists  ${u.email}  (${u.role}) — reusing`);
    return existing.id;
  }
  fail(`Could not create or find ${u.email}: ${created.error?.message ?? 'unknown error'}`);
}

// ---- remove leftover demo accounts (old brand + the previous 6 demo users) ---
const LEGACY_DEMO_EMAILS = [
  'admin@airshipexpress.test',
  'manager@airshipexpress.test',
  'driver1@airshipexpress.test',
  'driver2@airshipexpress.test',
  'driver3@airshipexpress.test',
  'driver4@airshipexpress.test',
];

async function cleanupOldAccounts(admin) {
  const stale = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers failed during cleanup: ${error.message}`);
    for (const u of data.users) {
      const email = u.email?.toLowerCase() ?? '';
      if (
        email.endsWith('@freightpulse.test') ||
        LEGACY_DEMO_EMAILS.includes(email)
      ) {
        stale.push(u);
      }
    }
    if (data.users.length < 200) break; // last page
  }
  if (stale.length === 0) {
    info('no stale accounts found — nothing to remove');
    return;
  }
  for (const u of stale) {
    // Deleting the auth user cascades to profiles + attendance / timesheets /
    // leave; shifts.driver_id is set null by the schema FK.
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) fail(`could not delete ${u.email}: ${error.message}`);
    ok(`removed old ${u.email}`);
  }
}

// ---- main -------------------------------------------------------------------
async function main() {
  log('\n── Airship Express Workforce — database setup ──\n');

  const env = loadEnv();
  let url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local');
  if (!serviceKey || serviceKey.includes('XXX')) {
    fail('SUPABASE_SERVICE_ROLE_KEY is missing or a placeholder in .env.local');
  }
  // Defensive: the client appends /rest/v1 etc. itself — a trailing /rest/v1/
  // would double the path and break every call.
  url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  info(`target: ${url}`);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fail fast with a clear message if the schema hasn't been applied yet.
  const probe = await admin.from('profiles').select('id').limit(1);
  if (probe.error) {
    fail(
      `Cannot read the "profiles" table (${probe.error.message}).\n` +
        '  Did you run supabase/schema.sql in the Supabase SQL Editor first?'
    );
  }

  // 1. Remove stale demo accounts (old brand + previous demo users) ---------
  log('\n[1/6] Removing stale demo accounts (if any)');
  await cleanupOldAccounts(admin);

  // 2. Users and profiles ----------------------------------------------------
  log(`\n[2/6] Creating ${USERS.length} users + profiles (from employeelist.txt)`);
  const ids = {};
  for (const u of USERS) {
    const id = await ensureUser(admin, u);
    ids[u.email] = id;
  }
  const profileRows = USERS.map((u) => ({
    id: ids[u.email],
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    avatar_initials: initialsOf(u.full_name),
    terminal: u.terminal,
  }));
  {
    const { error } = await admin.from('profiles').upsert(profileRows, { onConflict: 'id' });
    if (error) fail(`profiles upsert failed: ${error.message}`);
    ok(`${profileRows.length} profiles upserted with correct roles`);
  }

  const drivers = USERS.filter((u) => RIDER_ROLES.has(u.role)).map((u) => ids[u.email]);
  const allIds = USERS.map((u) => ids[u.email]);

  // 3. Analytics: forecast (Card 1) + skilling (Card 3) ----------------------
  log('\n[3/6] Seeding analytics (Cards 1 & 3)');
  await resetAndInsert(admin, 'workforce_forecast', [
    { month: 'Jan 2026', freight_volume: 4200, current_staff: 120, required_staff: 120 },
    { month: 'Feb 2026', freight_volume: 4550, current_staff: 122, required_staff: 125 },
    { month: 'Mar 2026', freight_volume: 5100, current_staff: 125, required_staff: 132 },
    { month: 'Apr 2026', freight_volume: 5400, current_staff: 128, required_staff: 138 },
    { month: 'May 2026', freight_volume: 6000, current_staff: 130, required_staff: 145 },
    { month: 'Jun 2026', freight_volume: 6600, current_staff: 133, required_staff: 152 },
    { month: 'Jul 2026', freight_volume: 7200, current_staff: 135, required_staff: 160 },
    { month: 'Aug 2026', freight_volume: 7900, current_staff: 138, required_staff: 169 },
    { month: 'Sep 2026', freight_volume: 8600, current_staff: 140, required_staff: 180 },
  ], 'workforce_forecast: 9 months (peak deficit 40 drivers in Sep)');

  await resetAndInsert(admin, 'skilling_progress', [
    { department: 'Long-Haul Drivers', certified_count: 84, total_count: 100 },
    { department: 'Regional Dispatch', certified_count: 58, total_count: 72 },
    { department: 'Warehouse Ops', certified_count: 45, total_count: 60 },
    { department: 'Hazmat Certified', certified_count: 22, total_count: 40 },
    { department: 'New Recruits', certified_count: 12, total_count: 35 },
  ], 'skilling_progress: 5 departments');

  await resetAndInsert(admin, 'performance_metrics', [
    {
      snapshot_date: iso(new Date()),
      avg_rating: 4.7,
      on_time_rate: 96.4,
      task_completion_rate: 94.2,
      active_courses: 12,
    },
  ], 'performance_metrics: 1 snapshot row (Card 2 + Card 3 course count)');

  // 4. Attendance (Card 4) — one live row per user, replace on re-run --------
  log('\n[4/6] Seeding live attendance (Card 4)');
  const STATUSES = ['On-Shift', 'On-Break', 'Tardy', 'On-Shift', 'On-Shift', 'Absent'];
  const now = new Date();
  const attendanceRows = USERS.map((u, i) => ({
    employee_id: ids[u.email],
    status: STATUSES[i % STATUSES.length],
    shift_start: '06:00',
    shift_end: '14:30',
    terminal: u.terminal,
    last_scan: new Date(now.getTime() - i * 4 * 60000).toISOString(),
  }));
  {
    const { error: delErr } = await admin
      .from('attendance_logs')
      .delete()
      .in('employee_id', allIds);
    if (delErr) fail(`attendance reset failed: ${delErr.message}`);
    const { error } = await admin.from('attendance_logs').insert(attendanceRows);
    if (error) fail(`attendance insert failed: ${error.message}`);
    const live = attendanceRows.filter((r) => r.status === 'On-Shift').length;
    ok(`${attendanceRows.length} attendance rows (${live} On-Shift now)`);
  }

  // 5. Shifts / timesheets / leave / loads — rebuilt against the real roster -
  log('\n[5/6] Seeding shifts / timesheets / leave / freight loads');
  const today = new Date();

  await resetAndInsert(admin, 'shifts', [
    { title: 'Route 66 Express Haul', driver_id: drivers[0], vehicle: 'Freightliner Cascadia #902', shift_date: iso(today), shift_time: '06:00 - 14:00', status: 'In Progress', priority: 'High' },
    { title: 'HazMat Tanker Relay', driver_id: drivers[1], vehicle: 'Peterbilt 579 Tanker', shift_date: iso(today), shift_time: '14:00 - 22:00', status: 'Pending Driver', priority: 'Critical' },
    { title: 'Overnight Interstate', driver_id: drivers[2], vehicle: 'Volvo VNL 860', shift_date: iso(addDays(today, 1)), shift_time: '22:00 - 06:00', status: 'Scheduled', priority: 'Normal' },
    { title: 'Cold Chain Regional', driver_id: drivers[3], vehicle: 'Kenworth T680 Reefer', shift_date: iso(addDays(today, 1)), shift_time: '05:00 - 13:00', status: 'Scheduled', priority: 'Normal' },
    { title: 'Port Drayage Loop', driver_id: null, vehicle: 'Mack Anthem #451', shift_date: iso(addDays(today, 2)), shift_time: '08:00 - 16:00', status: 'Pending Driver', priority: 'High' },
  ], 'shifts: 5 shifts');

  await resetAndInsert(admin, 'timesheets', [
    { employee_id: drivers[0], week_start: iso(addDays(today, -7)), week_end: iso(addDays(today, -1)), total_hours: 44.5, overtime_hours: 4.5, load_ref: 'FL-9921', total_pay: 1557.5, status: 'Pending Approval' },
    { employee_id: drivers[1], week_start: iso(addDays(today, -7)), week_end: iso(addDays(today, -1)), total_hours: 48.0, overtime_hours: 8.0, load_ref: 'HZ-4402', total_pay: 1820.0, status: 'Flagged Overtime' },
    { employee_id: drivers[2], week_start: iso(addDays(today, -7)), week_end: iso(addDays(today, -1)), total_hours: 40.0, overtime_hours: 0.0, load_ref: 'CC-1180', total_pay: 1400.0, status: 'Approved' },
    { employee_id: drivers[3], week_start: iso(addDays(today, -7)), week_end: iso(addDays(today, -1)), total_hours: 38.5, overtime_hours: 0.0, load_ref: 'PD-7731', total_pay: 1347.5, status: 'Pending Approval' },
  ], 'timesheets: 4 sheets');

  await resetAndInsert(admin, 'leave_requests', [
    { employee_id: drivers[0], leave_type: 'Mandatory Fatigue Rest', start_date: iso(addDays(today, 2)), end_date: iso(addDays(today, 4)), days_count: 3, reason: 'DOT-mandated rest after long-haul cycle', status: 'Approved', balance_remaining: 12 },
    { employee_id: drivers[1], leave_type: 'Paid Time Off (PTO)', start_date: iso(addDays(today, 9)), end_date: iso(addDays(today, 13)), days_count: 5, reason: 'Family vacation', status: 'Pending HR Review', balance_remaining: 8 },
    { employee_id: drivers[2], leave_type: 'Medical Leave', start_date: iso(addDays(today, 1)), end_date: iso(addDays(today, 2)), days_count: 2, reason: 'Scheduled medical appointment', status: 'Approved', balance_remaining: 6 },
  ], 'leave_requests: 3 requests');

  await resetAndInsert(admin, 'freight_loads', [
    { load_ref: 'FL-7742', origin: 'North Hub Chicago', destination: 'Central Port Freight', pickup_date: iso(today), status: 'In Transit', priority: 'High', driver_id: drivers[0] },
    { load_ref: 'HZ-4402', origin: 'East Logistics Bay', destination: 'South Depot Texas', pickup_date: iso(addDays(today, 1)), status: 'Scheduled', priority: 'Critical', driver_id: drivers[1] },
    { load_ref: 'CC-1180', origin: 'Central Port Freight', destination: 'North Hub Chicago', pickup_date: iso(addDays(today, 1)), status: 'Scheduled', priority: 'Normal', driver_id: drivers[2] },
    { load_ref: 'PD-7731', origin: 'South Depot Texas', destination: 'East Logistics Bay', pickup_date: iso(addDays(today, 2)), status: 'Pending Driver', priority: 'High', driver_id: null },
    { load_ref: 'CC-2390', origin: 'North Hub Chicago', destination: 'Central Port Freight', pickup_date: iso(addDays(today, 3)), status: 'Pending Driver', priority: 'Normal', driver_id: null },
  ], 'freight_loads: 5 loads (2 unassigned, ready to dispatch)');

  // Done ---------------------------------------------------------------------
  log('\n[6/6] Done.\n');
  log('── Roster accounts (password for all: ' + DEMO_PASSWORD + ') ──');
  log(`   ${USERS.length} employees from employeelist.txt`);
  for (const u of USERS) log(`   ${u.role.padEnd(18)}  ${u.email}`);
  log('\nStart the app with:  npm run dev   →  http://localhost:3000/dashboard\n');
}

// ---- table helpers ----------------------------------------------------------
const MISSING_TABLE_NOTE =
  'table not created yet — apply the latest supabase/schema.sql in the SQL Editor, then re-run npm run db:setup';

function isMissingTable(error) {
  return (
    error?.code === 'PGRST205' ||
    typeof error?.message === 'string' && error.message.includes('Could not find the table')
  );
}

async function resetAndInsert(admin, table, rows, label) {
  const { error: delErr } = await admin.from(table).delete().not('id', 'is', null);
  if (delErr) {
    if (isMissingTable(delErr)) return info(`${table}: ${MISSING_TABLE_NOTE}`);
    fail(`${table} reset failed: ${delErr.message}`);
  }
  const { error } = await admin.from(table).insert(rows);
  if (error) {
    if (isMissingTable(error)) return info(`${table}: ${MISSING_TABLE_NOTE}`);
    fail(`${table} insert failed: ${error.message}`);
  }
  ok(label ?? `${table}: ${rows.length} rows seeded`);
}

main().catch((e) => fail(e?.message ?? String(e)));
