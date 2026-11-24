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

const helperPath = path.resolve(__dirname, '../lib/fuelConsumptionMeasurement.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const helperModule = { exports: {} };
const loadModule = vm.runInThisContext(`(function (exports, require, module) { ${outputText}\n})`, { filename: helperPath });
loadModule(helperModule.exports, cjsRequire, helperModule);

test('measured fuel input accepts only finite positive liters', () => {
  assert.equal(helperModule.exports.parseMeasuredFuelLiters('12.75'), 12.75);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters('1.23456'), 1.235);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters(3), 3);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters(''), null);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters(0), null);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters(-1), null);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters('unknown'), null);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters('1000000000'), null);
  assert.equal(helperModule.exports.parseMeasuredFuelLiters({ liters: 4 }), null);
});
