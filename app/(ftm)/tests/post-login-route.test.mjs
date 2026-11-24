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

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const modulePath = path.resolve(__dirname, relativePath);
  const source = fs.readFileSync(modulePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const moduleInstance = { exports: {} };
  const require = (specifier) => dependencies[specifier] ?? cjsRequire(specifier);
  const loadModule = vm.runInThisContext(
    `(function (exports, require, module) { ${outputText}\n})`,
    { filename: modulePath }
  );
  loadModule(moduleInstance.exports, require, moduleInstance);
  return moduleInstance;
}

const permissions = loadTypeScriptModule("../lib/permissions.ts");
const roleAccess = loadTypeScriptModule("../lib/roleAccess.ts", {
  "./permissions": permissions.exports,
});

test("an authorized same-app next route is used after login", () => {
  assert.equal(
    roleAccess.exports.getPostLoginRoute("dispatcher", "/vrds/route-planning?view=map"),
    "/vrds/route-planning?view=map"
  );
});

test("inaccessible or external next routes fall back to the role dashboard", () => {
  assert.equal(roleAccess.exports.getPostLoginRoute("dispatcher", "/users"), "/vrds/dashboard");
  assert.equal(roleAccess.exports.getPostLoginRoute("dispatcher", "//outside.example"), "/vrds/dashboard");
  assert.equal(roleAccess.exports.getPostLoginRoute("dispatcher", "https://outside.example"), "/vrds/dashboard");
});

test("roles without a permitted FTM destination are rejected", () => {
  assert.equal(roleAccess.exports.getPostLoginRoute("customer", "/vrds/route-planning"), null);
});

test("the internal dashboard rewrite keeps the public dashboard's role access", () => {
  assert.equal(roleAccess.exports.hasPathAccess("admin", "/ftm-dashboard"), true);
  assert.equal(roleAccess.exports.hasPathAccess("fleet_manager", "/ftm-dashboard"), true);
  assert.equal(roleAccess.exports.hasPathAccess("dispatcher", "/ftm-dashboard"), false);
});
