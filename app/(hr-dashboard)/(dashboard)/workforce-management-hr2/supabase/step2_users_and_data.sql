-- ============================================================================
-- STEP 2 — Real roster users + all data   (Workforce Management / Airship Express)
--
-- HOW TO RUN (no terminal needed):
--   1. Open your Supabase project in the browser.
--   2. Left sidebar → SQL Editor → "+ New query".
--   3. Copy EVERYTHING in this file, paste it in, and click "Run".
--   4. When it finishes, the results panel lists your roster logins.
--
-- This is the SQL version of `npm run db:setup`. It:
--   • removes leftover @freightpulse.test + the old 6 demo accounts,
--   • creates one sign-in account per employee in employeelist.txt (61 people,
--     each with their real position as their role),
--   • fills the analytics charts (Cards 1 & 3),
--   • adds live attendance (Card 4), shifts, timesheets, and leave.
--
-- Password for EVERY account:  AirshipExpress#2026
--
-- Prerequisite: run supabase/schema.sql FIRST (that makes the tables). If you
-- haven't, this file stops with a clear message telling you so.
-- Safe to run more than once — it won't create duplicate users.
-- ============================================================================

-- ---- 0. Make sure the tables exist (friendly error if schema.sql not run) ---
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise exception
      'The "profiles" table does not exist yet. Run supabase/schema.sql first, then run this file.';
  end if;
end $$;

-- pgcrypto (for password hashing) ships pre-installed on Supabase; ensure it.
create extension if not exists pgcrypto with schema extensions;

-- ---- 1. Clean up leftover @freightpulse.test + old demo accounts ------------
do $$
declare
  old_uid uuid;
begin
  for old_uid in
    select id from auth.users
    where email like '%@freightpulse.test'
       or email in (
          'admin@airshipexpress.test',
          'manager@airshipexpress.test',
          'driver1@airshipexpress.test',
          'driver2@airshipexpress.test',
          'driver3@airshipexpress.test',
          'driver4@airshipexpress.test'
        )
  loop
    -- Remove auth identity first (FK constraint).
    delete from auth.identities where user_id = old_uid;
    -- Remove the auth account itself.
    delete from auth.users where id = old_uid;
    -- Profile cascade-deletes automatically via the FK, but explicit is fine too.
    delete from public.profiles where id = old_uid;
  end loop;
end $$;

-- ---- 2. Create the roster accounts + their profiles -------------------------
do $$
declare
  rec   record;
  uid   uuid;
begin
  for rec in
    select * from (values
      ('krischen.cafe@airshipexpress.test', 'Krischen Cafe', 'Hybrid/Rider', 'Manila Hub'),
      ('welberto.arriesgado@airshipexpress.test', 'Welberto Arriesgado', 'Appraiser', 'HQ — Operations Center'),
      ('joseph.batucan@airshipexpress.test', 'Joseph Batucan', 'Appraiser', 'HQ — Operations Center'),
      ('mark.batucan@airshipexpress.test', 'Mark Anthony Batucan', 'Appraiser/Rider', 'Manila Hub'),
      ('eric.damos@airshipexpress.test', 'Eric Damos', 'Appraiser', 'HQ — Operations Center'),
      ('gary.gorembalem@airshipexpress.test', 'Gary Gorembalem', 'Appraiser', 'HQ — Operations Center'),
      ('juan.perez@airshipexpress.test', 'Juan Pinoy Perez', 'Appraiser/Rider', 'Manila Hub'),
      ('richard.robilla@airshipexpress.test', 'Richard Robilla', 'Appraiser', 'HQ — Operations Center'),
      ('rolando.saren@airshipexpress.test', 'Rolando Saren', 'Appraiser', 'HQ — Operations Center'),
      ('elizabeth.meca@airshipexpress.test', 'Elizabeth Meca', 'Sales Representative', 'HQ — Operations Center'),
      ('chenchen.martinez@airshipexpress.test', 'Chenchen Martinez', 'Sales Representative', 'HQ — Operations Center'),
      ('shiela.quisay@airshipexpress.test', 'Shiela Quisay', 'Sales Representative', 'HQ — Operations Center'),
      ('ailen.robles@airshipexpress.test', 'Ailen Jade Robles', 'Sales Representative', 'HQ — Operations Center'),
      ('irene.singson@airshipexpress.test', 'Irene Singson', 'Sales Representative', 'HQ — Operations Center'),
      ('kirl.trinidad@airshipexpress.test', 'Kirl Patrick Trinidad', 'Office Staff', 'HQ — Operations Center'),
      ('klisy.torres@airshipexpress.test', 'Klisy Torres', 'CSR/Marketing Staff', 'HQ — Operations Center'),
      ('carl.fornis@airshipexpress.test', 'Carl Fornis', 'CSR/Marketing Staff', 'HQ — Operations Center'),
      ('john.francisco@airshipexpress.test', 'John Paul Francisco', 'Rider', 'Manila Hub'),
      ('dennis.mirasol@airshipexpress.test', 'Dennis Mirasol', 'Rider', 'Manila Hub'),
      ('merilou.reyes@airshipexpress.test', 'Merilou Reyes', 'Project Coordinator', 'HQ — Operations Center'),
      ('rome.salvador@airshipexpress.test', 'Rome Louis Salvador', 'Office-in-Charge', 'HQ — Operations Center'),
      ('tolentino.mentac@airshipexpress.test', 'Tolentino Mentac', 'Admin Assistant', 'HQ — Operations Center'),
      ('ace.arriola@airshipexpress.test', 'Ace Arriola', 'In-House Rider', 'Manila Hub'),
      ('nowei.altarejos@airshipexpress.test', 'Nowei Altarejos', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('mc.bernardo@airshipexpress.test', 'Mc Aldee Bernardo', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('wilbert.cabanayan@airshipexpress.test', 'Wilbert Cabanayan', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('humberto.cahilig@airshipexpress.test', 'Humberto Jr. Cahilig', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('wilfredo.canare@airshipexpress.test', 'Wilfredo Canare', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('daniel.catalan@airshipexpress.test', 'Daniel Catalan', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('ronel.costo@airshipexpress.test', 'Ronel Costo', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('james.dalmacio@airshipexpress.test', 'James Dalmacio', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('adrian.domingo@airshipexpress.test', 'Adrian Domingo', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('chris.halayahay@airshipexpress.test', 'Chris Jan Halayahay', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('jonathan.hife@airshipexpress.test', 'Jonathan Hife', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('jayson.lazaga@airshipexpress.test', 'Jayson Lazaga', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('clent.mirasol@airshipexpress.test', 'Clent Mirasol', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('reymart.moreno@airshipexpress.test', 'Reymart Moreno', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('josua.ogardo@airshipexpress.test', 'Josua Brazil Ogardo', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('gerald.punay@airshipexpress.test', 'Gerald Punay', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('joshua.tarnate@airshipexpress.test', 'Joshua Tarnate', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('john.timo@airshipexpress.test', 'John Paul Timo', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('mark.juego@airshipexpress.test', 'Mark Joseph Juego', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('bruce.esco@airshipexpress.test', 'Bruce Esco', 'Airship Driver', 'Manila Hub'),
      ('sherwin.pajarillo@airshipexpress.test', 'Sherwin Pajarillo', 'Airship Driver', 'Manila Hub'),
      ('angelo.egos@airshipexpress.test', 'Angelo Egos', 'Airship Driver', 'Manila Hub'),
      ('carlo.villapando@airshipexpress.test', 'Carlo Villapando', 'JNT Pick-Up Rider', 'Manila Hub'),
      ('meliza.bangkok@airshipexpress.test', 'Meliza Bangkok', 'HR Generalist', 'HQ — Operations Center'),
      ('ivie.temonio@airshipexpress.test', 'Ivie Temonio', 'HR Officer', 'HQ — Operations Center'),
      ('keanna.go@airshipexpress.test', 'Keanna Myiel Go', 'Admin Assistant', 'HQ — Operations Center'),
      ('sherlyn.manaois@airshipexpress.test', 'Sherlyn Jam Manaois', 'Admin Assistant', 'HQ — Operations Center'),
      ('edizon.prado@airshipexpress.test', 'Edizon Prado', 'Marketing/Admin Staff', 'HQ — Operations Center'),
      ('kimberly.ganace@airshipexpress.test', 'Kimberly Ganace', 'Admin Assistant', 'HQ — Operations Center'),
      ('rosant.magat@airshipexpress.test', 'Rosant Carlo Magat', 'Drop-Off Pick-Up Rider', 'Manila Hub'),
      ('anthony.manaay@airshipexpress.test', 'Anthony Manaay', 'Drop-Off Pick-Up Rider', 'Manila Hub'),
      ('james.melencion@airshipexpress.test', 'James Melencion', 'Drop-Off Pick-Up Rider', 'Manila Hub'),
      ('kenneth.nuevas@airshipexpress.test', 'Kenneth Nuevas', 'Drop-Off Pick-Up Rider', 'Manila Hub'),
      ('christopher.sollestre@airshipexpress.test', 'Christopher Sollestre', 'Manila Rider', 'Manila Hub'),
      ('christopher.villeza@airshipexpress.test', 'Christopher Villeza', 'Manila Rider', 'Manila Hub'),
      ('raymond.manozo@airshipexpress.test', 'Raymond Manozo', 'Manila Rider', 'Manila Hub'),
      ('jordan.tulid@airshipexpress.test', 'Jordan Tulid', 'Manila Rider', 'Manila Hub'),
      ('oscar.oliveros@airshipexpress.test', 'Oscar Oliveros', 'Manila Rider', 'Manila Hub')
    ) as t(email, fname, urole, terminal)
  loop
    -- Reuse the account if it already exists (keeps this re-runnable).
    select id into uid from auth.users where email = rec.email;

    if uid is null then
      uid := gen_random_uuid();

      -- The auth account itself (email pre-confirmed so login works right away).
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        rec.email, extensions.crypt('AirshipExpress#2026', extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', rec.fname),
        now(), now(), '', '', '', ''
      );

      -- The matching identity row (required for email/password sign-in).
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', rec.email), 'email',
        now(), now(), now()
      );
    end if;

    -- Create/patch the profile with the correct role + terminal. (The signup
    -- trigger may have already made a default 'Fleet Driver' row — this fixes it.)
    insert into public.profiles (id, email, full_name, role, avatar_initials, terminal)
    values (
      uid, rec.email, rec.fname, rec.urole,
      upper(substr(rec.fname, 1, 1) || coalesce(substr(split_part(rec.fname, ' ', 2), 1, 1), '')),
      rec.terminal
    )
    on conflict (id) do update set
      role            = excluded.role,
      terminal        = excluded.terminal,
      full_name       = excluded.full_name,
      avatar_initials = excluded.avatar_initials,
      email           = excluded.email;
  end loop;
end $$;

-- ---- 3. Card 1: Workforce forecast (freight volume vs. staffing) ------------
delete from public.workforce_forecast;
insert into public.workforce_forecast (month, freight_volume, current_staff, required_staff) values
  ('Jan 2026', 4200, 120, 120),
  ('Feb 2026', 4550, 122, 125),
  ('Mar 2026', 5100, 125, 132),
  ('Apr 2026', 5400, 128, 138),
  ('May 2026', 6000, 130, 145),
  ('Jun 2026', 6600, 133, 152),
  ('Jul 2026', 7200, 135, 160),
  ('Aug 2026', 7900, 138, 169),
  ('Sep 2026', 8600, 140, 180);  -- peak deficit = 40 drivers

-- ---- 4. Card 3: Skilling progress by department ----------------------------
delete from public.skilling_progress;
insert into public.skilling_progress (department, certified_count, total_count) values
  ('Long-Haul Drivers', 84, 100),
  ('Regional Dispatch', 58,  72),
  ('Warehouse Ops',     45,  60),
  ('Hazmat Certified',  22,  40),
  ('New Recruits',      12,  35);

-- ---- 4b. Card 2: Performance snapshot + Card 3 course count -----------------
delete from public.performance_metrics;
insert into public.performance_metrics
  (snapshot_date, avg_rating, on_time_rate, task_completion_rate, active_courses)
values
  (current_date, 4.7, 96.4, 94.2, 12);

-- ---- 5. Card 4: Live attendance (one row per roster user) -------------------
delete from public.attendance_logs
where employee_id in (select id from public.profiles where email like '%@airshipexpress.test');

insert into public.attendance_logs (employee_id, status, shift_start, shift_end, terminal, last_scan)
select p.id, v.status, '06:00', '14:30', p.terminal, now() - (v.mins || ' minutes')::interval
from (values
  ('krischen.cafe@airshipexpress.test', 'On-Shift', 0),
  ('mark.batucan@airshipexpress.test', 'On-Shift', 4),
  ('john.francisco@airshipexpress.test', 'On-Shift', 8),
  ('nowei.altarejos@airshipexpress.test', 'On-Break', 12),
  ('bruce.esco@airshipexpress.test', 'Tardy', 16),
  ('oscar.oliveros@airshipexpress.test', 'Absent', 20)
) as v(email, status, mins)
join public.profiles p on p.email = v.email;

-- ---- 6. Shifts / timesheets / leave / loads (rebuilt for the real roster) --
do $$
begin
  insert into public.shifts (title, driver_id, vehicle, shift_date, shift_time, status, priority)
  select * from (values
    ('Route 66 Express Haul', (select id from public.profiles where email='krischen.cafe@airshipexpress.test'), 'Freightliner Cascadia #902', current_date,     '06:00 - 14:00', 'In Progress',    'High'),
    ('HazMat Tanker Relay',   (select id from public.profiles where email='mark.batucan@airshipexpress.test'), 'Peterbilt 579 Tanker',       current_date,     '14:00 - 22:00', 'Pending Driver', 'Critical'),
    ('Overnight Interstate',  (select id from public.profiles where email='john.francisco@airshipexpress.test'), 'Volvo VNL 860',              current_date + 1, '22:00 - 06:00', 'Scheduled',      'Normal'),
    ('Cold Chain Regional',   (select id from public.profiles where email='nowei.altarejos@airshipexpress.test'), 'Kenworth T680 Reefer',       current_date + 1, '05:00 - 13:00', 'Scheduled',      'Normal'),
    ('Port Drayage Loop',     null,                                                                       'Mack Anthem #451',           current_date + 2, '08:00 - 16:00', 'Pending Driver', 'High')
  ) as t(title, driver_id, vehicle, shift_date, shift_time, status, priority)
  where not exists (select 1 from public.shifts);

  insert into public.timesheets (employee_id, week_start, week_end, total_hours, overtime_hours, load_ref, total_pay, status)
  select * from (values
    ((select id from public.profiles where email='krischen.cafe@airshipexpress.test'), current_date - 7, current_date - 1, 44.5, 4.5, 'FL-9921', 1557.50, 'Pending Approval'),
    ((select id from public.profiles where email='mark.batucan@airshipexpress.test'), current_date - 7, current_date - 1, 48.0, 8.0, 'HZ-4402', 1820.00, 'Flagged Overtime'),
    ((select id from public.profiles where email='john.francisco@airshipexpress.test'), current_date - 7, current_date - 1, 40.0, 0.0, 'CC-1180', 1400.00, 'Approved'),
    ((select id from public.profiles where email='nowei.altarejos@airshipexpress.test'), current_date - 7, current_date - 1, 38.5, 0.0, 'PD-7731', 1347.50, 'Pending Approval')
  ) as t(employee_id, week_start, week_end, total_hours, overtime_hours, load_ref, total_pay, status)
  where not exists (select 1 from public.timesheets);

  insert into public.leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status, balance_remaining)
  select * from (values
    ((select id from public.profiles where email='krischen.cafe@airshipexpress.test'), 'Mandatory Fatigue Rest', current_date + 2, current_date + 4, 3, 'DOT-mandated rest after long-haul cycle', 'Approved',          12),
    ((select id from public.profiles where email='mark.batucan@airshipexpress.test'), 'Paid Time Off (PTO)',    current_date + 9, current_date + 13, 5, 'Family vacation',                          'Pending HR Review',  8),
    ((select id from public.profiles where email='john.francisco@airshipexpress.test'), 'Medical Leave',          current_date + 1, current_date + 2, 2, 'Scheduled medical appointment',            'Approved',           6)
  ) as t(employee_id, leave_type, start_date, end_date, days_count, reason, status, balance_remaining)
  where not exists (select 1 from public.leave_requests);

  -- Freight loads (the wider-system hook; two left unassigned to dispatch)
  insert into public.freight_loads (load_ref, origin, destination, pickup_date, status, priority, driver_id)
  select * from (values
    ('FL-7742', 'North Hub Chicago',    'Central Port Freight', current_date,     'In Transit',     'High',     (select id from public.profiles where email='krischen.cafe@airshipexpress.test')),
    ('HZ-4402', 'East Logistics Bay',   'South Depot Texas',    current_date + 1, 'Scheduled',      'Critical', null),
    ('CC-1180', 'Central Port Freight', 'North Hub Chicago',    current_date + 1, 'Scheduled',      'Normal',   (select id from public.profiles where email='mark.batucan@airshipexpress.test')),
    ('PD-7731', 'South Depot Texas',    'East Logistics Bay',   current_date + 2, 'Pending Driver', 'High',     null),
    ('CC-2390', 'North Hub Chicago',    'Central Port Freight', current_date + 3, 'Pending Driver', 'Normal',   null)
  ) as t(load_ref, origin, destination, pickup_date, status, priority, driver_id)
  where not exists (select 1 from public.freight_loads);
end $$;

-- ---- 7. Show the logins you can now use ------------------------------------
select
  role                 as "Role",
  email                as "Email",
  'AirshipExpress#2026'  as "Password"
from public.profiles
where email like '%@airshipexpress.test'
order by
  case
    when role in ('HR Admin', 'HR Generalist', 'HR Officer') then 1
    when role = 'Operations Manager' or role = 'Office-in-Charge' then 2
    else 3
  end,
  email;
