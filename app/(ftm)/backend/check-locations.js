const { getServiceSupabase, initSupabase } = require('./config/db');

async function checkLocations() {
  initSupabase();
  const supabase = getServiceSupabase();
  
  if (!supabase) {
    console.error('❌ Supabase not initialized');
    return;
  }
  
  const { data, error } = await supabase
    .from('locations')
    .select('*');
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('📍 Available locations:');
    if (data && data.length > 0) {
      data.forEach(loc => {
        console.log(`  - ${loc.id}: ${loc.name}`);
      });
    } else {
      console.log('  (No locations found)');
    }
  }
}

checkLocations();
