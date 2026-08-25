-- ============================================================================
-- RFID HARDWARE EXTENSION FOR WORKFORCE PROFILES
-- Run this in your Supabase SQL Editor (Project -> SQL Editor -> New query)
-- ============================================================================

-- 1. Add rfid_uid column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rfid_uid text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_rfid_uid ON public.profiles(rfid_uid);

-- 2. Optional demo assignments for testing:
-- UPDATE public.profiles SET rfid_uid = 'E34A12B9' WHERE email = 'krischen.cafe@airshipexpress.test';
