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

const helperPath = path.resolve(__dirname, '../lib/costOptimization.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const helperModule = { exports: {} };
const loadModule = vm.runInThisContext(`(function (exports, require, module) { ${outputText}\n})`, { filename: helperPath });
loadModule(helperModule.exports, cjsRequire, helperModule);

test('optimization opportunities rank filtered vehicles above the fleet median', () => {
  const opportunities = helperModule.exports.getCostOptimizationOpportunities([
    { id: 'a', name: 'A', costPerKm: 10 },
    { id: 'b', name: 'B', costPerKm: 20 },
    { id: 'c', name: 'C', costPerKm: 30 },
    { id: 'd', name: 'D', costPerKm: 40 },
  ]);

  assert.deepEqual(opportunities.map(({ id }) => id), ['d', 'c']);
  assert.equal(opportunities[0].fleetMedianCostPerKm, 25);
  assert.equal(opportunities[0].percentAboveMedian, 60);
});

test('optimization does not invent a peer comparison for insufficient or invalid data', () => {
  assert.deepEqual(helperModule.exports.getCostOptimizationOpportunities([
    { id: 'a', name: 'A', costPerKm: 10 },
  ]), []);
  assert.deepEqual(helperModule.exports.getCostOptimizationOpportunities([
    { id: 'a', name: 'A', costPerKm: 0 },
    { id: 'b', name: 'B', costPerKm: null },
  ]), []);
});
