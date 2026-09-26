-- Seed demo drivers and vehicles into Supabase
-- This migration adds demo data for testing the route planning and bookings features
-- The existing users table in this project includes password_hash and is_active, and does not have email_confirmed_at.

-- Insert demo drivers into the users table
INSERT INTO public.users (id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'marco.reyes@airship.local', 'managed-by-supabase-auth', 'Marco Reyes', '09171234567', 'driver', TRUE, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'alicia.santos@airship.local', 'managed-by-supabase-auth', 'Alicia Santos', '09172234567', 'driver', TRUE, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'daniel.cruz@airship.local', 'managed-by-supabase-auth', 'Daniel Cruz', '09173234567', 'driver', TRUE, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'rina.gomez@airship.local', 'managed-by-supabase-auth', 'Rina Gomez', '09174234567', 'driver', TRUE, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', 'leo.bautista@airship.local', 'managed-by-supabase-auth', 'Leo Bautista', '09175234567', 'driver', TRUE, NOW(), NOW()),
  ('66666666-6666-6666-6666-666666666666', 'nina.mendoza@airship.local', 'managed-by-supabase-auth', 'Nina Mendoza', '09176234567', 'driver', TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert or update demo vehicles without colliding with existing plate numbers.
INSERT INTO public.vehicles (id, plate_number, vehicle_type, capacity_kg, created_at, updated_at)
VALUES
  ('VEH-003', 'LMN-8901', 'Pickup', 1100, NOW(), NOW()),
  ('VEH-004', 'QRS-1123', 'Van', 900, NOW(), NOW()),
  ('VEH-005', 'TUV-3345', 'Truck', 1800, NOW(), NOW()),
  ('VEH-006', 'WXY-7788', 'Box Truck', 2000, NOW(), NOW())
ON CONFLICT (plate_number) DO UPDATE SET
  vehicle_type = EXCLUDED.vehicle_type,
  capacity_kg = EXCLUDED.capacity_kg,
  updated_at = NOW();
