// Simple script to fetch parcels from Supabase REST API
// Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from ../../.env.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_FTM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing environment variables. Please set NEXT_PUBLIC_FTM_SUPABASE_URL and NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY.');
  process.exit(1);
}

async function fetchParcels() {
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/parcels?select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Error response:', res.status, res.statusText, text);
      process.exit(2);
    }

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
    process.exit(1);
  }
}

fetchParcels();
