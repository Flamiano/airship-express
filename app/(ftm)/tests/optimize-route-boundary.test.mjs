import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

function loadTypeScriptModule(modulePath, dependencies) {
  const source = readFileSync(modulePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const targetModule = { exports: {} };
  const loadModule = runInThisContext(
    `(function (exports, require, module) { ${outputText}\n})`,
    { filename: modulePath }
  );
  loadModule(targetModule.exports, (name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, targetModule);
  return targetModule.exports;
}

const directory = path.dirname(fileURLToPath(import.meta.url));
const geoPath = path.resolve(directory, "../lib/metroManilaGeo.ts");
const { isWithinMetroManila } = loadTypeScriptModule(geoPath, {});
const optimizePath = path.resolve(directory, "../lib/optimize.ts");
const optimizeHelpers = loadTypeScriptModule(optimizePath, {});
let optimizerResult;
const routePath = path.resolve(directory, "../api/optimize-route/route.ts");
const { POST } = loadTypeScriptModule(routePath, {
  'next/server': {
    NextResponse: {
      json: (body, init = {}) => ({ body, status: init.status || 200 }),
    },
  },
  '../../lib/optimize': optimizeHelpers,
  '../../lib/metroManilaGeo': { isWithinMetroManila },
  '../../lib/heuristicSolver': { solveHeuristic: () => { throw new Error('Unexpected solver call'); } },
  '../../lib/server/ftmPythonOptimizer': {
    runFtmPythonOptimizer: async () => {
      if (!optimizerResult) throw new Error('Unexpected optimizer call');
      return optimizerResult;
    },
  },
});

const inArea = { lat: 14.5547, lng: 121.0244 };
const outsideArea = { lat: 14.82, lng: 121.04 };
const validPayload = {
  origin: inArea,
  destination: { lat: 14.676, lng: 121.0437 },
  stops: [{ id: 'stop-1', ...inArea }],
};

test("optimizer rejects origins, destinations, and stops outside Metro Manila", async (t) => {
  for (const [label, payload, expected] of [
    ["origin", { ...validPayload, origin: outsideArea }, "Origin"],
    ["destination", { ...validPayload, destination: outsideArea }, "Destination"],
    ["stop", { ...validPayload, stops: [{ id: "stop-1", ...outsideArea }] }, "Stop"],
  ]) {
    await t.test(label, async () => {
      const response = await POST({ json: async () => payload });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, `${expected} must be inside Metro Manila.`);
    });
  }
});

test("optimizer rejects parcel events without a pickup and delivery pair", async () => {
  const response = await POST({
    json: async () => ({
      ...validPayload,
      stops: [{
        id: "stop-1",
        ...inArea,
        parcelEvents: [{ parcelId: "parcel-1", kind: "pickup" }],
      }],
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.error,
    "Every parcel route needs exactly one pickup and one delivery stop."
  );
});

test("optimizer rejects cargo that exceeds the selected vehicle type capacity", async () => {
  const response = await POST({
    json: async () => ({
      ...validPayload,
      vehicleCount: 1,
      cargoWeightKg: 801,
      vehicleCapacityKg: 800,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.error,
    "Cargo load (801 kg) exceeds vehicle capacity (800 kg)."
  );
});

test("optimizer does not restore a parcel order that puts delivery before pickup", async () => {
  const origin = inArea;
  const destination = { lat: 14.676, lng: 121.0437 };
  const orderedStopIds = ["pickup", "delivery"];
  optimizerResult = {
    engine: "or-tools",
    orderedStopIds,
    routes: [{
      vehicleId: "vehicle-1",
      orderedStopIds,
      polyline: [origin, destination, origin, destination],
      distanceMi: 100,
      etaMinutes: 100,
    }],
    distanceMi: 100,
    etaMinutes: 100,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Network access disabled in test"); };

  try {
    const response = await POST({
      json: async () => ({
        origin,
        destination,
        vehicleCount: 1,
        optimizationMode: "shortest",
        stops: [
          {
            id: "delivery",
            ...origin,
            parcelEvents: [{ parcelId: "parcel-1", kind: "delivery", weightKg: 4 }],
          },
          {
            id: "pickup",
            ...destination,
            parcelEvents: [{ parcelId: "parcel-1", kind: "pickup", weightKg: 4 }],
          },
        ],
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.orderedStopIds, orderedStopIds);
  } finally {
    optimizerResult = undefined;
    globalThis.fetch = originalFetch;
  }
});
