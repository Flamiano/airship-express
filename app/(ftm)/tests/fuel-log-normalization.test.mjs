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

const helperPath = path.resolve(__dirname, '../lib/fuelLogNormalization.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const helperModule = { exports: {} };
const loadModule = vm.runInThisContext(`(function (exports, require, module) { ${outputText}\n})`, { filename: helperPath });
loadModule(helperModule.exports, cjsRequire, helperModule);

test('fuel normalization preserves recorded details stored in category metadata', () => {
  const [record] = helperModule.exports.normalizeFuelLogs([{
    id: 'cost-1',
    category_details: JSON.stringify({
      fuel_type: 'Diesel',
      fuel_station: 'North Depot',
      location: 'Quezon City',
      payment_method: 'Card',
      reference_number: 'INV-42',
    }),
    liters: 12,
    price_per_liter: 65,
    amount: 780,
  }], []);

  assert.equal(record.fuelType, 'Diesel');
  assert.equal(record.station, 'North Depot');
  assert.equal(record.location, 'Quezon City');
  assert.equal(record.payment_method, 'Card');
  assert.equal(record.reference_number, 'INV-42');
});

test('fuel normalization includes legacy fuel logs and avoids duplicate IDs', () => {
  const records = helperModule.exports.normalizeFuelLogs([
    { id: 'shared-id', liters: 10, amount: 700 },
  ], [
    { id: 'shared-id', liters: 10, cost: 700 },
    { id: 'legacy-id', liters: 8, cost: 560, logged_at: '2026-11-22T10:00:00Z' },
  ]);

  assert.equal(records.length, 2);
  assert.equal(records[0].isLegacyFuelLog, false);
  assert.equal(records[1].isLegacyFuelLog, true);
  assert.equal(records[1].loggedAt, '2026-11-22T10:00:00Z');
});
