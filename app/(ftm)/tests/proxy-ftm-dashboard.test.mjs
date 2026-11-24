import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const cjsRequire = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proxyPath = path.resolve(__dirname, "../../../proxy.ts");
const source = fs.readFileSync(proxyPath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const proxyModule = { exports: {} };
const loadModule = vm.runInThisContext(
  `(function (exports, require, module) { ${outputText}\n})`,
  { filename: proxyPath }
);
loadModule(proxyModule.exports, cjsRequire, proxyModule);
const { NextRequest } = cjsRequire("next/server");

function runProxy(url, marked = false) {
  const headers = marked ? { "x-airship-ftm-embedded": "1" } : undefined;
  return proxyModule.exports.proxy(new NextRequest(url, { headers }));
}

test("marked internal FTM dashboard rewrites pass through", () => {
  const response = runProxy("https://ftm.localhost:3000/ftm-dashboard", true);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("the internal FTM dashboard bypass does not apply to other portals", () => {
  const response = runProxy("https://fms.localhost:3000/ftm-dashboard", true);
  assert.notEqual(response.headers.get("x-middleware-next"), "1");
  assert.ok(response.headers.get("location"));
  assert.equal(new URL(response.headers.get("location")).hostname, "fms.localhost");
});

test("unmarked direct requests do not receive the internal FTM bypass", () => {
  const response = runProxy("https://ftm.localhost:3000/ftm-dashboard");
  assert.notEqual(response.headers.get("x-middleware-next"), "1");
});

test("the FMS dashboard remains on FMS when its path is also an FTM route", () => {
  const response = runProxy("https://fms.localhost:3000/dashboard");
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("location"), null);
});

test("FTM legacy routes rewrite to their current routes and preserve queries", () => {
  const cases = [
    ["/dashboard/route-planning?next=1", "/ftm-dashboard/route-planning", "?next=1"],
    ["/passkey-enroll?next=1", "/ftmAuth/passkey-enroll", "?next=1"],
    ["/bookings?tab=active", "/vrds/bookings", "?tab=active"],
    ["/api/health?x=1", "/api/ftm-health", "?x=1"],
  ];

  for (const [source, expectedPath, expectedSearch] of cases) {
    const response = runProxy(`https://ftm.localhost:3000${source}`);
    const rewrite = response.headers.get("x-middleware-rewrite");
    assert.ok(rewrite, `${source} should rewrite`);
    const target = new URL(rewrite);
    assert.equal(target.pathname, expectedPath);
    assert.equal(target.search, expectedSearch);
  }
});

test("FTM-specific health rewrites do not affect other portals", () => {
  const response = runProxy("https://fms.localhost:3000/api/health");
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("x-middleware-rewrite"), null);
});

test("a Supply Chain-owned route remains on its portal", () => {
  const response = runProxy("https://sc.localhost:3000/inventory");
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("location"), null);
});
