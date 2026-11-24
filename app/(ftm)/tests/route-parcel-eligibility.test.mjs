import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const cjsRequire = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const helperPath = path.resolve(__dirname, '../lib/routeParcelEligibility.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const helperModule = { exports: {} };
const loadModule = vm.runInThisContext(`(function (exports, require, module) { ${outputText}\n})`, { filename: helperPath });
loadModule(helperModule.exports, cjsRequire, helperModule);

const route = {
  id: 'route-1',
  status: 'scheduled',
  pickup_location: 'Route Depot',
  pickup_latitude: 14.6,
  pickup_longitude: 120.98,
  route_details: {
    origin: { name: 'Route Depot', address: 'Route Depot', lat: 14.6, lng: 120.98 },
    destination: { name: 'Destination', address: 'Destination', lat: 14.7, lng: 121.1 },
  },
};

test('pickup coordinates take precedence when an assigned parcel has no address', () => {
  const parcel = { id: 'parcel-1', route_plan_id: 'route-1', pickup_lat: 14.8, pickup_lng: 121.2 };

  assert.equal(helperModule.exports.isParcelPickupOnRoute(parcel, route), false);
  assert.equal(helperModule.exports.canCollectParcelOnRoute(parcel, route), false);
});

test('an assigned parcel with no recorded pickup still uses the route origin fallback', () => {
  const parcel = { id: 'parcel-2', route_plan_id: 'route-1' };

  assert.equal(helperModule.exports.canCollectParcelOnRoute(parcel, route), true);
});

test('collected parcels and parcels on closed routes are not eligible', () => {
  const parcel = { id: 'parcel-3', route_plan_id: 'route-1', status: 'picked_up' };

  assert.equal(helperModule.exports.canCollectParcelOnRoute(parcel, route), false);
  assert.equal(helperModule.exports.canCollectParcelOnRoute({ id: 'parcel-4', route_plan_id: 'route-1' }, { ...route, status: 'completed' }), false);
});
