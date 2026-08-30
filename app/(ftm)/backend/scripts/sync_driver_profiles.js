/*
  Sync driver profiles from Supabase Auth to public.users
  - Uses SUPABASE_SERVICE_ROLE_KEY from ../../.env
  - Creates missing rows in public.users for auth users with user_metadata.role === 'driver'
  Run: node backend/scripts/sync_driver_profiles.js
*/

const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ../../.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAllAuthUsers() {
  const all = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    if (!data || !data.users || data.users.length === 0) break;
    all.push(...data.users);
    if (data.users.length < 100) break;
    page += 1;
  }
  return all;
}

async function ensureProfile(user) {
  try {
    const { id, email, user_metadata = {}, created_at, updated_at } = user;
    const role = user_metadata.role || 'driver';
    if (role !== 'driver') return { skipped: true };

    const { data: existing, error: selErr } = await supabase.from('users').select('id,email,role').eq('id', id).maybeSingle();
    if (selErr) return { error: selErr };

    const full_name = user_metadata.full_name || email?.split('@')[0] || 'Driver';
    const phone = user_metadata.phone || null;
    const timestamp = new Date().toISOString();

    const insertPayload = {
      id,
      email,
      full_name,
      phone,
      role,
      created_at: created_at || timestamp,
      updated_at: updated_at || timestamp,
    };

    if (existing) {
      if (existing.role === role) {
        return { existed: true };
      }
      const { data: upd, error: updErr } = await supabase.from('users').update({ role, full_name, phone, updated_at: timestamp }).eq('id', id);
      if (updErr) return { error: updErr };
      return { updated: true, id };
    }

    const { data: ins, error: insErr } = await supabase.from('users').insert([insertPayload]);
    if (insErr) return { error: insErr };
    return { created: true, id };
  } catch (e) {
    return { error: e };
  }
}

(async () => {
  try {
    console.log('Listing auth users...');
    const users = await listAllAuthUsers();
    console.log(`Found ${users.length} auth users`);

    let created = 0;
    let existed = 0;
    let skipped = 0;
    for (const u of users) {
      const res = await ensureProfile(u);
      if (res.created) created += 1;
      else if (res.existed) existed += 1;
      else if (res.skipped) skipped += 1;
      else if (res.error) console.error('Error ensuring profile for', u.id, res.error);
    }

    console.log(`Sync complete. created=${created}, existed=${existed}, skipped=${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(2);
  }
})();
