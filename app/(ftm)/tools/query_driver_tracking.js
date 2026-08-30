const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.FTM_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.FTM_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('FTM_SUPABASE_URL and FTM_SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const driverId = process.argv[2] || '88657e7d-166f-4bb1-84a9-d7eee51d22c8';
  try {
    const { data, error } = await supabase
      .from('driver_tracking')
      .select('*')
      .eq('driver_id', driverId)
      .order('recorded_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Query failed:', error.message || error);
    process.exitCode = 1;
  }
}

run();const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.FTM_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.FTM_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('FTM_SUPABASE_URL and FTM_SUPABASE_SERVICE_ROLE_KEY are required.');
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const driverId = process.argv[2] || '88657e7d-166f-4bb1-84a9-d7eee51d22c8';
  try {
    const { data, error } = await supabase
      .from('driver_tracking')
      .select('*')
      .eq('driver_id', driverId)
      .order('recorded_at', { ascending: false })
      .limit(10);
    if (error) {
      console.error('Query error:', error.message || error);
      process.exit(1);
    }
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Exception:', e.message || e);
    process.exit(1);
  }
}

run();
