const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const env = process.env;
const keys = ['FTM_SUPABASE_SERVICE_ROLE_KEY', 'FTM_SUPABASE_ANON_KEY', 'FTM_PARCELS_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'PARCELS_SUPABASE_ANON_KEY'];
for (const key of keys) {
  const value = env[key];
  console.log('---', key, '---');
  if (!value) { console.log('MISSING'); continue; }
  console.log('prefix', value.slice(0, 20));
  const parts = value.split('.');
  if (parts.length !== 3) { console.log('not JWT'); continue; }
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    console.log('payload', JSON.stringify(payload));
    if (payload.iat) console.log('iat', payload.iat, new Date(payload.iat * 1000).toISOString());
    if (payload.exp) console.log('exp', payload.exp, new Date(payload.exp * 1000).toISOString());
  } catch (e) {
    console.log('parse error', e.message);
  }
}
const now = Math.floor(Date.now() / 1000);
console.log('now', now, new Date(now * 1000).toISOString());
