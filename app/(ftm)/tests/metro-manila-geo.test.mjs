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

const helperPath = path.resolve(__dirname, '../lib/metroManilaGeo.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const helperModule = { exports: {} };
const loadModule = vm.runInThisContext(`(function (exports, require, module) { ${outputText}\n})`, { filename: helperPath });
loadModule(helperModule.exports, cjsRequire, helperModule);

test('Metro Manila service validation uses coordinates and the administrative polygon', () => {
  const { isWithinMetroManila } = helperModule.exports;
  assert.equal(isWithinMetroManila(14.5547, 121.0244), true);
  assert.equal(isWithinMetroManila(14.676, 121.0437), true);
  assert.equal(isWithinMetroManila(14.82, 121.04), false);
  assert.equal(isWithinMetroManila(14.75, 121.13), false);
  assert.equal(isWithinMetroManila(14.55, 121.2), false);
  assert.equal(isWithinMetroManila(null, 121.02), false);
});

test('route location coordinates accept common latitude and longitude field names', () => {
  const { getRouteLocationCoordinates } = helperModule.exports;
  assert.deepEqual(getRouteLocationCoordinates({ lat: "14.55", lng: "121.02" }), { lat: 14.55, lng: 121.02 });
  assert.deepEqual(getRouteLocationCoordinates({ latitude: 14.55, longitude: 121.02 }), { lat: 14.55, lng: 121.02 });
  assert.equal(getRouteLocationCoordinates({ lat: 14.55 }), null);
});
