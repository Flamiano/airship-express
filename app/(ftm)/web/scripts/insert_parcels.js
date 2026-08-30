// Insert parcels into Supabase REST API
// Usage:
//   node web/scripts/insert_parcels.js path/to/parcels.json
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from ../../.env
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_FTM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing environment variables. Please set NEXT_PUBLIC_FTM_SUPABASE_URL and NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const fileArg = process.argv[2] || 'scripts/output.json';
const filePath = path.resolve(process.cwd(), fileArg);

if (!fs.existsSync(filePath)) {
  console.error('Data file not found:', filePath);
  console.error('Pass a JSON file path containing an array of parcel objects as the first argument.');
  process.exit(1);
}

let payload;
try {
  const raw = fs.readFileSync(filePath, 'utf8');
  payload = JSON.parse(raw);
} catch (err) {
  console.error('Failed to read/parse JSON file:', err.message);
  process.exit(1);
}

if (!Array.isArray(payload)) {
  console.error('Expected a JSON array of parcel objects.');
  process.exit(1);
}

async function insertParcels(parcels) {
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/parcels`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // return representation so we can inspect inserted rows
        Prefer: 'return=representation',
      },
      body: JSON.stringify(parcels),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('Insert failed:', res.status, res.statusText);
      console.error('Response body:', text);
      process.exit(2);
    }

    // parse JSON if any
    let result;
    try { result = JSON.parse(text); } catch (e) { result = text; }
    console.log('Inserted count:', Array.isArray(result) ? result.length : 1);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Network/insert error:', err);
    process.exit(1);
  }
}

insertParcels(payload);
