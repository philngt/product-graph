import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadGraph, saveGraph, writeJson } from "../src/io.ts";
import { normalizeProductGraph } from "../src/compiler.ts";
import { IMPLEMENTATION_SCHEMA, inspectTarget, loadImplementation, saveImplementation, validateImplementation } from "../src/implementation-targets.ts";
import type { Graph } from "../src/types.ts";
import type { ImplementationTarget } from "../src/implementation-targets.ts";

const graph = (id = "demo"): Graph => ({ manifest: { framework: "0.1.0", schemaVersion: "1.0.0", projectId: id, name: id },
  nodes: [{ id: "entity:bottle", region: "domain", type: "entity", title: "Bottle" }, { id: "feature:usage", region: "product", type: "feature", title: "Usage" }],
  edges: [{ id: "uses", kind: "uses", from: "feature:usage", to: "entity:bottle" }],
  documents: [{ id: "brief", path: "documents/brief.md", title: "Brief", links: ["feature:usage"] }] });
function fixture(t: { after: (fn: () => void) => void }, projectId = "demo") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pg-target-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); saveGraph(root, graph(projectId));
  return root;
}
const target = (id = "web"): ImplementationTarget => ({ id, name: `${id} target`, role: "interface", environment: "browser", language: "TypeScript", framework: "React", storage: "", notes: "", template: null,
  bindings: [{ nodeId: "entity:bottle", mode: "custom", slot: "", reference: "src/bottle.ts" }] });
const template = () => ({ id: "web-catalog", version: "1.0.0", title: "Web catalog", implementation: { schemaVersion: "productgraph.template-contract.v1", roles: ["interface"], environments: ["browser"], languages: ["TypeScript"], frameworks: ["React"], slots: [{ id: "item", nodeTypes: ["entity"] }] } });
function setTargets(root: string, targets: ImplementationTarget[]) {
  const snap = loadImplementation(root);
  return saveImplementation(root, { expectedRevision: snap.revision, config: { ...snap.config, targets } });
}
function pin(root: string) { const t = loadImplementation(root).templates[0]; return { id: t.id, version: t.version, definitionHash: t.definitionHash }; }

test("legacy project has no implicit Swift target and GET does not create configuration", t => {
  const root = fixture(t), result = loadImplementation(root);
  assert.equal(result.config.schemaVersion, IMPLEMENTATION_SCHEMA); assert.deepEqual(result.config.targets, []);
  assert.equal(fs.existsSync(path.join(root, "implementation")), false);
});
test("mobile, web, backend, worker and CLI share semantic IDs without rewriting product data", t => {
  const root = fixture(t), before = JSON.stringify(loadGraph(root));
  const targets = [target(), { ...target("mobile"), environment: "iOS", language: "Swift", framework: "SwiftUI" },
    { ...target("api"), role: "backend" as const, environment: "server", language: "Java", framework: "Spring Boot" },
    { ...target("worker"), role: "worker" as const, environment: "server", language: "Python", framework: "" },
    { ...target("cli"), role: "cli" as const, environment: "terminal", language: "Go", framework: "" }];
  const saved = setTargets(root, targets); assert.equal(saved.config.targets.length, 5);
  assert.equal(JSON.stringify(loadGraph(root)), before); assert.deepEqual(loadImplementation(root).config, saved.config);
  assert.equal(saved.inspection.every(r => !r.generation.available), true);
});
test("target deletion only changes configuration, not graph, files or custom code", t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, "src")); fs.writeFileSync(path.join(root, "src/bottle.ts"), "do not delete");
  setTargets(root, [target()]); setTargets(root, []);
  assert.equal(fs.readFileSync(path.join(root, "src/bottle.ts"), "utf8"), "do not delete"); assert.equal(loadGraph(root).nodes.length, 2);
});
test("stale writer and template/model drift preserve the saved configuration", t => {
  const root = fixture(t), old = loadImplementation(root); setTargets(root, [target()]);
  assert.throws(() => saveImplementation(root, { expectedRevision: old.revision, config: old.config }), /changed/);
  const snap = loadImplementation(root); writeJson(path.join(root, "templates/web.json"), template());
  assert.throws(() => saveImplementation(root, { expectedRevision: snap.revision, config: snap.config }), /changed/);
  const next = loadImplementation(root), changed = loadGraph(root); changed.nodes[0].title = "Bottle revised"; saveGraph(root, changed);
  assert.throws(() => saveImplementation(root, { expectedRevision: next.revision, config: next.config }), /changed/);
  assert.equal(loadImplementation(root).config.targets.length, 1);
});
test("project identity and location are bound; one project cannot bless another's write", t => {
  const a = fixture(t, "a"), b = fixture(t, "b"), sa = loadImplementation(a), sb = loadImplementation(b);
  assert.throws(() => saveImplementation(b, { expectedRevision: sa.revision, config: sa.config }), /changed/);
  assert.throws(() => saveImplementation(b, { expectedRevision: sb.revision, config: sa.config }), /different product/);
  assert.equal(fs.existsSync(path.join(b, "implementation/targets.json")), false);
});
test("missing revision and concurrent cooperating writer are rejected", t => {
  const root = fixture(t), snap = loadImplementation(root);
  assert.throws(() => saveImplementation(root, { config: snap.config }), /before saving/);
  fs.mkdirSync(path.join(root, "implementation")); fs.writeFileSync(path.join(root, "implementation/write.lock"), "held");
  assert.throws(() => saveImplementation(root, { expectedRevision: snap.revision, config: snap.config }), /busy/);
});
test("template contracts produce declarations, never executable support", t => {
  const root = fixture(t); writeJson(path.join(root, "templates/web.json"), { ...template(), executable: true });
  const result = setTargets(root, [{ ...target(), template: pin(root), bindings: [{ nodeId: "entity:bottle", mode: "template", slot: "item", reference: "" }] }]);
  assert.equal(result.inspection[0].bindings[0].status, "mapped-declaration"); assert.equal(result.inspection[0].generation.available, false);
});
test("template compatibility checks environment, role, language and framework", t => {
  const root = fixture(t); writeJson(path.join(root, "templates/web.json"), template()); const snap = loadImplementation(root);
  for (const patch of [{ environment: "iOS" }, { role: "backend" }, { language: "Swift" }, { framework: "SwiftUI" }]) {
    const report = inspectTarget({ ...target(), ...patch, template: pin(root) } as ImplementationTarget, loadGraph(root), snap.templates);
    assert.equal(report.compatible, false); assert.ok(report.findings.some(f => f.code === "target-mismatch"));
  }
});
test("template IDs/versions are pinned, duplicate identities and drift remain visible", t => {
  const root = fixture(t); writeJson(path.join(root, "templates/web.json"), template());
  setTargets(root, [{ ...target(), template: pin(root) }]);
  writeJson(path.join(root, "templates/web.json"), { ...template(), title: "Changed without version bump" });
  assert.ok(loadImplementation(root).inspection[0].findings.some(f => f.code === "template-drift"));
  writeJson(path.join(root, "templates/duplicate.json"), template());
  assert.ok(loadImplementation(root).inspection[0].findings.some(f => f.code === "template-unresolved"));
});
test("legacy/unversioned/invalid template metadata is inspectable but not advertised as support", t => {
  const root = fixture(t); writeJson(path.join(root, "templates/old.json"), { id: "old", version: "1", target: "ios-swiftui" });
  writeJson(path.join(root, "templates/unversioned.json"), { title: "Metadata" });
  const snap = loadImplementation(root); assert.equal(snap.templates.length, 2); assert.ok(snap.templates.every(t => t.issue && !t.contract));
});
test("unsupported/missing mapping inputs and deleted model objects are findings, not silent fixes", t => {
  const root = fixture(t), result = setTargets(root, [{ ...target(), bindings: [{ nodeId: "unknown", mode: "custom", reference: "", slot: "" }, { nodeId: "entity:bottle", mode: "deferred", reference: "", slot: "" }] }]);
  assert.deepEqual(result.inspection[0].bindings.map(b => b.status), ["missing-object", "deferred"]);
  assert.equal(result.config.targets[0].bindings[0].nodeId, "unknown");
});
test("reject duplicate targets/bindings, unsupported schema and attempted executable flags", () => {
  const config = { schemaVersion: IMPLEMENTATION_SCHEMA, projectId: "demo", targets: [target()] };
  for (const invalid of [{ ...config, targets: [target(), target()] }, { ...config, schemaVersion: "next" },
    { ...config, targets: [{ ...target(), bindings: [...target().bindings, ...target().bindings] }] },
    { ...config, execute: true }, { ...config, targets: [{ ...target(), generator: "shell" }] }]) assert.throws(() => validateImplementation(invalid, "demo"));
});
test("unsafe paths and symlinked configuration/templates are not followed", t => {
  const root = fixture(t), other = fixture(t, "other");
  fs.symlinkSync(other, path.join(root, "implementation"), "dir"); assert.throws(() => loadImplementation(root), /Symbolic/);
  fs.unlinkSync(path.join(root, "implementation")); fs.mkdirSync(path.join(root, "templates"));
  fs.symlinkSync(path.join(other, "project.json"), path.join(root, "templates/escape.json")); assert.throws(() => loadImplementation(root), /Symbolic/);
});
test("size and field limits fail before configuration is changed", t => {
  const root = fixture(t), snap = loadImplementation(root);
  assert.throws(() => saveImplementation(root, { expectedRevision: snap.revision, config: { ...snap.config, targets: [{ ...target(), notes: "x".repeat(4001) }] } }), /notes/);
  assert.deepEqual(loadImplementation(root).config, snap.config);
});
test("IR preserves edges and document records and does not alias the product graph", () => {
  const original = graph(), ir = normalizeProductGraph(original);
  assert.deepEqual(ir.edges, original.edges); assert.deepEqual(ir.documents, original.documents);
  ir.nodes[0].title = "edited"; ir.edges[0].kind = "changed";
  assert.equal(original.nodes[0].title, "Bottle"); assert.equal(original.edges[0].kind, "uses");
  assert.ok(!("target" in ir));
});
