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

const helperPath = path.resolve(__dirname, '../lib/driverPerformanceMetrics.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const helperModule = { exports: {} };
const loadModule = vm.runInThisContext(`(function (exports, require, module) { ${outputText}\n})`, { filename: helperPath });
loadModule(helperModule.exports, cjsRequire, helperModule);

test('driver-linked completion cohorts use trip creation dates and exclude unassigned or cancelled trips', () => {
  const start = new Date('2026-11-01T00:00:00.000Z');
  const end = new Date('2026-11-30T23:59:59.999Z');
  const cohort = helperModule.exports.getDriverLinkedTripCohort([
    { id: 'created-and-completed', driver_id: 'driver-1', status: 'completed', created_at: '2026-11-02T10:00:00Z' },
    { id: 'created-and-active', driverId: 'driver-1', status: 'in_progress', createdAt: '2026-11-03T10:00:00Z' },
    { id: 'unassigned', status: 'completed', created_at: '2026-11-04T10:00:00Z' },
    { id: 'cancelled', driver_id: 'driver-1', status: 'cancelled', created_at: '2026-11-05T10:00:00Z' },
    { id: 'outside-range', driver_id: 'driver-1', status: 'assigned', created_at: '2026-10-31T23:59:59Z' },
  ], start, end);

  assert.deepEqual(cohort.map(({ id }) => id), ['created-and-completed', 'created-and-active']);
});

test('on-time performance uses the delivery window end, then expected arrival as fallback', () => {
  assert.equal(helperModule.exports.getTripDeliveryDeadline({
    routePlan: { routeDetails: { schedule: { window_end: '2026-11-22T12:00:00Z', expected_arrival: '2026-11-22T11:00:00Z' } } },
  }), '2026-11-22T12:00:00Z');
  assert.equal(helperModule.exports.getTripDeliveryDeadline({
    routePlan: { routeDetails: { schedule: { expected_arrival: '2026-11-22T11:00:00Z' } } },
  }), '2026-11-22T11:00:00Z');
});
