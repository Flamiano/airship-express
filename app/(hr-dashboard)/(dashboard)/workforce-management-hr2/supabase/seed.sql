-- ============================================================================
-- Seed data for the Workforce Management sub-system.
-- Run AFTER schema.sql (and migration_fix.sql, if it was needed), in the
-- Supabase SQL Editor. This file mirrors what `npm run db:setup` seeds, so the
-- app behaves identically whichever path you use.
--
-- Part A (analytics) has no dependency on real users and powers Cards 1 & 3
-- immediately. Part B seeds attendance / shifts / timesheets / leave / loads
-- for whatever profiles already exist — so create the roster users FIRST (or
-- run scripts/setup-database.mjs), then run this file.
--
-- Safe to run more than once (deletes then re-inserts seed data).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Part A: Workforce forecast (Card 1) — 9 months
-- ---------------------------------------------------------------------------
delete from workforce_forecast;
insert into workforce_forecast (month, freight_volume, current_staff, required_staff) values
  ('Jan 2026', 4200, 120, 120),
  ('Feb 2026', 4550, 122, 125),
  ('Mar 2026', 5100, 125, 132),
  ('Apr 2026', 5400, 128, 138),
  ('May 2026', 6000, 130, 145),
  ('Jun 2026', 6600, 133, 152),
  ('Jul 2026', 7200, 135, 160),
  ('Aug 2026', 7900, 138, 169),
  ('Sep 2026', 8600, 140, 180);

-- ---------------------------------------------------------------------------
-- Part A: Skilling progress (Card 3) — 5 departments
-- ---------------------------------------------------------------------------
delete from skilling_progress;
insert into skilling_progress (department, certified_count, total_count) values
  ('Long-Haul Drivers', 84, 100),
  ('Regional Dispatch', 58,  72),
  ('Warehouse Ops',     45,  60),
  ('Hazmat Certified',  22,  40),
  ('New Recruits',      12,  35);

-- ---------------------------------------------------------------------------
-- Part A: Performance snapshot (Card 2 readouts + Card 3 course count)
-- ---------------------------------------------------------------------------
delete from performance_metrics;
insert into performance_metrics
  (snapshot_date, avg_rating, on_time_rate, task_completion_rate, active_courses)
values
  (current_date, 4.7, 96.4, 94.2, 12);

-- ---------------------------------------------------------------------------
-- Part B: Employee-dependent data (attendance / shifts / timesheets / leave)
-- Seeds one attendance row per existing profile (rotating statuses), plus
-- shifts, timesheets, leave requests, and freight loads tied to real drivers.
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
  i int := 0;
  statuses text[] := array['On-Shift', 'On-Break', 'Tardy', 'On-Shift', 'On-Shift', 'Absent'];
  terminals text[] := array['North Hub Chicago', 'Central Port Freight', 'East Logistics Bay', 'South Depot Texas'];
  drivers uuid[];
  d text[] := array['Fleet Driver', 'Hybrid/Rider', 'Appraiser/Rider', 'Rider', 'In-House Rider',
    'JNT Pick-Up Rider', 'Airship Driver', 'Drop-Off Pick-Up Rider', 'Manila Rider'];
begin
  -- Attendance: one live row per profile (replace on re-run).
  delete from attendance_logs;
  for p in select id from profiles loop
    insert into attendance_logs (employee_id, status, shift_start, shift_end, terminal, last_scan)
    values (
      p.id,
      statuses[(i % cardinality(statuses)) + 1],
      '06:00',
      '14:30',
      terminals[(i % cardinality(terminals)) + 1],
      now() - (i * 4 || ' minutes')::interval
    );
    i := i + 1;
  end loop;

  -- Up to 4 real driver positions for shift/timesheet/load seeding.
  select array_agg(id) into drivers from (
    select id from profiles where role = any (d) order by id limit 4
  ) x;

  if cardinality(drivers) >= 1 then
    -- Shifts (replace on re-run)
    delete from shifts;
    insert into shifts (title, driver_id, vehicle, shift_date, shift_time, status, priority) values
      ('Route 66 Express Haul', drivers[1], 'Freightliner Cascadia #902', current_date, '06:00 - 14:00', 'In Progress', 'High'),
      ('HazMat Tanker Relay',   drivers[2], 'Peterbilt 579 Tanker',       current_date, '14:00 - 22:00', 'Pending Driver', 'Critical'),
      ('Overnight Interstate',  drivers[3], 'Volvo VNL 860',              current_date + 1, '22:00 - 06:00', 'Scheduled', 'Normal'),
      ('Cold Chain Regional',   drivers[4], 'Kenworth T680 Reefer',       current_date + 1, '05:00 - 13:00', 'Scheduled', 'Normal'),
      ('Port Drayage Loop',     null,       'Mack Anthem #451',           current_date + 2, '08:00 - 16:00', 'Pending Driver', 'High');

    -- Timesheets (replace on re-run)
    delete from timesheets;
    insert into timesheets (employee_id, week_start, week_end, total_hours, overtime_hours, load_ref, total_pay, status) values
      (drivers[1], current_date - 7, current_date - 1, 44.5, 4.5, 'FL-9921', 1557.50, 'Pending Approval'),
      (drivers[2], current_date - 7, current_date - 1, 48.0, 8.0, 'HZ-4402', 1820.00, 'Flagged Overtime'),
      (drivers[3], current_date - 7, current_date - 1, 40.0, 0.0, 'CC-1180', 1400.00, 'Approved'),
      (drivers[4], current_date - 7, current_date - 1, 38.5, 0.0, 'PD-7731', 1347.50, 'Pending Approval');

    -- Leave requests (replace on re-run)
    delete from leave_requests;
    insert into leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status, balance_remaining) values
      (drivers[1], 'Mandatory Fatigue Rest', current_date + 2,  current_date + 4,  3, 'DOT-mandated rest after long-haul cycle', 'Approved', 12),
      (drivers[2], 'Paid Time Off (PTO)',    current_date + 9,  current_date + 13, 5, 'Family vacation', 'Pending HR Review', 8),
      (drivers[3], 'Medical Leave',          current_date + 1,  current_date + 2,  2, 'Scheduled medical appointment', 'Approved', 6);

    -- Freight loads (the wider-system hook; two left unassigned to dispatch)
    delete from freight_loads;
    insert into freight_loads (load_ref, origin, destination, pickup_date, status, priority, driver_id) values
      ('FL-7742', 'North Hub Chicago',    'Central Port Freight', current_date,     'In Transit',     'High',     drivers[1]),
      ('HZ-4402', 'East Logistics Bay',   'South Depot Texas',    current_date + 1, 'Scheduled',      'Critical', drivers[2]),
      ('CC-1180', 'Central Port Freight', 'North Hub Chicago',    current_date + 1, 'Scheduled',      'Normal',   drivers[3]),
      ('PD-7731', 'South Depot Texas',    'East Logistics Bay',   current_date + 2, 'Pending Driver', 'High',     null),
      ('CC-2390', 'North Hub Chicago',    'Central Port Freight', current_date + 3, 'Pending Driver', 'Normal',   null);
  end if;
end $$;
