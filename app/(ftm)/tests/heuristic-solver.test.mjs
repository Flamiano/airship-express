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

const helperPath = path.resolve(__dirname, '../lib/heuristicSolver.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const optimizePath = path.resolve(__dirname, '../lib/optimize.ts');
const optimizeSource = fs.readFileSync(optimizePath, 'utf8');
const { outputText: optimizeOutputText } = ts.transpileModule(optimizeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const optimizeModule = { exports: {} };
const loadOptimizeModule = vm.runInThisContext(
  `(function (exports, require, module) { ${optimizeOutputText}\n})`,
  { filename: optimizePath }
);
loadOptimizeModule(optimizeModule.exports, cjsRequire, optimizeModule);
const helperModule = { exports: {} };
const loadModule = vm.runInThisContext(`(function (exports, require, module) { ${outputText}\n})`, { filename: helperPath });
loadModule(
  helperModule.exports,
  (specifier) => specifier === './optimize' ? optimizeModule.exports : cjsRequire(specifier),
  helperModule
);

test('local optimizer improves a greedy route using the supplied road costs', () => {
  const { solveHeuristic } = helperModule.exports;
  const result = solveHeuristic(
    { lat: 14.55, lng: 121.02 },
    { lat: 14.6, lng: 121.03 },
    [
      { id: 'a', lat: 14.56, lng: 121.02 },
      { id: 'b', lat: 14.57, lng: 121.02 },
    ],
    {
      optimizationMode: 'shortest',
      distanceMatrix: [
        [0, 2, 3, 100],
        [2, 0, 100, 1],
        [3, 1, 0, 100],
        [100, 1, 100, 0],
      ],
      durationMatrix: [
        [0, 4, 6, 200],
        [4, 0, 200, 2],
        [6, 2, 0, 200],
        [200, 2, 200, 0],
      ],
    }
  );

  assert.equal(result.engine, 'heuristic-fallback');
  assert.deepEqual(result.orderedStopIds, ['b', 'a']);
  assert.equal(result.distanceMi, 5);
  assert.equal(result.routes.length, 1);
});

test('local optimizer distributes every stop across requested vehicles', () => {
  const { solveHeuristic } = helperModule.exports;
  const stops = [
    { id: 'a', lat: 14.56, lng: 121.02 },
    { id: 'b', lat: 14.57, lng: 121.02 },
    { id: 'c', lat: 14.58, lng: 121.02 },
  ];
  const matrix = [
    [0, 1, 2, 3, 4],
    [1, 0, 1, 2, 3],
    [2, 1, 0, 1, 2],
    [3, 2, 1, 0, 1],
    [4, 3, 2, 1, 0],
  ];
  const result = solveHeuristic(
    { lat: 14.55, lng: 121.02 },
    { lat: 14.6, lng: 121.03 },
    stops,
    {
      vehicleCount: 2,
      distanceMatrix: matrix,
      durationMatrix: matrix,
    }
  );

  assert.equal(result.routes.length, 2);
  assert.deepEqual(new Set(result.orderedStopIds), new Set(['a', 'b', 'c']));
  assert.equal(result.orderedStopIds.length, stops.length);
});

test('local optimizer keeps each parcel pickup before its delivery', () => {
  const { solveHeuristic } = helperModule.exports;
  const result = solveHeuristic(
    { lat: 14.55, lng: 121.02 },
    { lat: 14.6, lng: 121.03 },
    [
      {
        id: 'delivery',
        lat: 14.56,
        lng: 121.02,
        parcelEvents: [{ parcelId: 'parcel-1', kind: 'delivery', weightKg: 4 }],
      },
      {
        id: 'pickup',
        lat: 14.57,
        lng: 121.02,
        parcelEvents: [{ parcelId: 'parcel-1', kind: 'pickup', weightKg: 4 }],
      },
    ],
    {
      distanceMatrix: [
        [0, 1, 2, 20],
        [1, 0, 1, 20],
        [2, 1, 0, 1],
        [20, 20, 1, 0],
      ],
      durationMatrix: [
        [0, 1, 2, 20],
        [1, 0, 1, 20],
        [2, 1, 0, 1],
        [20, 20, 1, 0],
      ],
    }
  );

  assert.deepEqual(result.orderedStopIds, ['pickup', 'delivery']);
});

test('local optimizer rejects incomplete parcel events and overweight cargo', () => {
  const { solveHeuristic } = helperModule.exports;
  const origin = { lat: 14.55, lng: 121.02 };
  const destination = { lat: 14.6, lng: 121.03 };
  const matrix = [
    [0, 1, 2],
    [1, 0, 1],
    [2, 1, 0],
  ];

  assert.throws(
    () => solveHeuristic(origin, destination, [
      {
        id: 'pickup',
        lat: 14.56,
        lng: 121.02,
        parcelEvents: [{ parcelId: 'parcel-1', kind: 'pickup' }],
      },
    ], { distanceMatrix: matrix, durationMatrix: matrix }),
    /exactly one pickup and one delivery/
  );

  assert.throws(
    () => solveHeuristic(origin, destination, [
      { id: 'stop', lat: 14.56, lng: 121.02 },
    ], {
      cargoWeightKg: 501,
      vehicleCapacityKg: 500,
      distanceMatrix: matrix,
      durationMatrix: matrix,
    }),
    /exceeds vehicle capacity/
  );
});
