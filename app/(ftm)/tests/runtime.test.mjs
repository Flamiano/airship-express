import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const cjsRequire = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(__dirname, '../lib/server/backend');

test('all restored backend modules load, including their exports', async () => {
  for (const folder of ['config', 'models', 'routes', 'services']) {
    for (const name of fs.readdirSync(path.join(backend, folder)).filter(n => /\.(js|mjs)$/.test(n))) {
      const file = path.join(backend, folder, name);
      const loaded = name.endsWith('.mjs')
        ? await import(pathToFileURL(file).href)
        : cjsRequire(file);
      assert.ok(loaded, `${folder}/${name}`);
    }
  }
});

test('parcel database helper always reuses the FTM Supabase client', () => {
  const moduleUrl = pathToFileURL(path.join(backend, 'config/db.mjs')).href;
  const script = `
    const db = await import(${JSON.stringify(moduleUrl)});
    db.initSupabase();
    if (db.getParcelsSupabase() !== db.getSupabase()) process.exit(1);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FTM_SUPABASE_URL: 'https://ftm.example.test',
      FTM_SUPABASE_SERVICE_ROLE_KEY: 'test-ftm-service-role-key',
      FTM_PARCELS_SUPABASE_URL: 'https://separate-parcels.example.test',
      FTM_PARCELS_SUPABASE_SERVICE_ROLE_KEY: 'test-parcels-service-role-key',
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('pickup router preserves dynamic URL matching', async () => {
  const { findPickupHandler } = await import(pathToFileURL(path.join(backend, 'routes/pickupRoutes.mjs')).href);
  const match = findPickupHandler('POST', '/route-plans/route-123/assign-driver');
  assert.ok(match);
  assert.equal(match.params.id, 'route-123');
  assert.equal(typeof match.handler, 'function');
  assert.equal(findPickupHandler('GET', '/not-a-route'), null);
});

test('standalone Node adapter executes Python and keeps the legacy response contract', async () => {
  const { runOptimizer } = await import(pathToFileURL(path.join(backend, 'services/routeOptimizer.mjs')).href);
  const result = await runOptimizer(
    { name: 'Depot', lat: 14.59, lng: 120.98 },
    [{ name: 'A', lat: 14.60, lng: 120.99 }, { name: 'B', lat: 14.61, lng: 121.00 }],
    { useRoadDistance: false, timeLimitSecs: 1 },
  );
  assert.equal(result.used_ortools, true);
  assert.deepEqual([...result.order].sort(), ['A', 'B']);
  assert.equal(result.routes.length, 1);
  assert.ok(result.distance_km > 0);
  assert.match(result.distance_source, /haversine/);
});

test('standalone Node adapter rejects invalid requests before launching Python', async () => {
  const { runOptimizer } = await import(pathToFileURL(path.join(backend, 'services/routeOptimizer.mjs')).href);
  await assert.rejects(runOptimizer({ name: 'Depot', lat: 14.59, lng: 120.98 }, [], { useRoadDistance: false }), /At least one stop and a depot are required/);
});
