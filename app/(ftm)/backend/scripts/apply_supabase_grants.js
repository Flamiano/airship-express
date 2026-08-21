const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not configured');
  process.exit(1);
}

const sql = `
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_device_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_gps_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_service_role_all_trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_service_role_all_vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_service_role_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_service_role_all_mobile_tracking" ON public.mobile_device_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_service_role_all_vehicle_gps" ON public.vehicle_gps_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_service_role_all_driver_tracking" ON public.driver_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_service_role_all_tracking_history" ON public.tracking_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_service_role_all_cost_entries" ON public.cost_entries FOR ALL USING (true) WITH CHECK (true);
`;

(async () => {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Grant script completed successfully');
  } catch (error) {
    console.error('Grant script failed', error);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
