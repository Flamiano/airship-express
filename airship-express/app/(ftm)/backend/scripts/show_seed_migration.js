const path = require('path');
const fs = require('fs');

const migrationPath = path.resolve(__dirname, '..', 'migrations/20260817_seed_demo_drivers_vehicles.sql');
const sql = fs.readFileSync(migrationPath, 'utf-8');

console.log('📋 SQL to paste in Supabase Console:');
console.log('=====================================\n');
console.log(sql);
console.log('\n=====================================');
console.log('✅ Copy the SQL above and paste it into:');
console.log('   Supabase Studio → SQL Editor → New Query');
console.log('   Then click "Execute"');
