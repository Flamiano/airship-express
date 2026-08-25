-- ============================================================================
-- TIME & ATTENDANCE SYSTEM: TIME-IN / TIME-OUT SCHEMA
-- Run this in your Supabase SQL Editor (Project -> SQL Editor -> New query)
-- ============================================================================

-- 1. Ensure rfid_uid column exists on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rfid_uid text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_rfid_uid ON public.profiles(rfid_uid);

-- 2. Enhanced attendance_logs with dedicated time_in, time_out, and action columns
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'TIME_IN' CHECK (action IN ('TIME_IN', 'TIME_OUT')),
  status text NOT NULL DEFAULT 'On-Shift' CHECK (status IN ('On-Shift', 'On-Break', 'Tardy', 'Absent', 'Clocked Out')),
  time_in timestamptz DEFAULT now(),
  time_out timestamptz,
  shift_start text DEFAULT '06:00',
  shift_end text DEFAULT '14:30',
  terminal text NOT NULL DEFAULT 'ESP32-GATE-01',
  last_scan timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for maximum query performance
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_logs(status);
CREATE INDEX IF NOT EXISTS idx_attendance_last_scan ON public.attendance_logs(last_scan DESC);

-- 3. Enable RLS and public policies for full access
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated and anon select on attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow authenticated and anon select on attendance_logs"
  ON public.attendance_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full access to service_role and users on attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow full access to service_role and users on attendance_logs"
  ON public.attendance_logs FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable Realtime Replication for attendance_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
