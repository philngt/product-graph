import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { once } from "node:events";
import { saveGraph, loadGraph, writeJson } from "../src/io.ts";
import { LocalError } from "../src/local-files.ts";
import { loadImplementation, saveImplementation } from "../src/implementation-targets.ts";
import { buildTaskContext } from "../src/task-context.ts";
import { buildImplementationContext } from "../src/implementation-context.ts";
import { handleImplementationRequest } from "../src/implementation-api.ts";

function fixture(t: { after: (fn: () => void) => void }, projectId = "demo") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pg-target-context-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  saveGraph(root, { manifest: { framework: "1", schemaVersion: "1", projectId, name: projectId },
    nodes: [{ id: "feature:rotation", type: "feature", region: "product", title: "Rotation" }, { id: "constraint:local", type: "constraint", region: "intent", title: "No account" },
      { id: "test:cooldown", type: "acceptance-criterion", region: "quality", title: "Verify cooldown" }, { id: "feature:other", type: "feature", region: "product", title: "Unrelated" }],
    edges: [{ from: "feature:rotation", to: "test:cooldown", kind: "verified-by" }],
    documents: [{ id: "doc:rotation", title: "Rotation rules", path: "documents/rotation.md", links: ["feature:rotation"] }] });
  fs.mkdirSync(path.join(root, "documents")); fs.writeFileSync(path.join(root, "documents/rotation.md"), "# Rotation\n\n## Rules\nRetain accepted business meaning.\n");
  const snap = loadImplementation(root);
  saveImplementation(root, { expectedRevision: snap.revision, config: { ...snap.config, targets: [
    { id: "web", name: "Web", role: "interface", environment: "browser", language: "TypeScript", framework: "React", storage: "local", notes: "Web only notes", template: null,
      bindings: [{ nodeId: "feature:rotation", mode: "custom", slot: "", reference: "src/rotation.ts" }, { nodeId: "feature:other", mode: "custom", slot: "", reference: "secret-outside-task.ts" }] },
    { id: "ios", name: "Phone", role: "interface", environment: "iOS", language: "Swift", framework: "SwiftUI", storage: "SwiftData", notes: "Private mobile guidance", template: null,
      bindings: [{ nodeId: "feature:rotation", mode: "custom", slot: "", reference: "Rotation.swift" }] },
  ] } });
  return root;
}
const task = { task: "Implement rotation", rootIds: ["feature:rotation"] };
const request = (root: string, targetId = "web", context: unknown = task) => ({ targetId, expectedRevision: loadImplementation(root).revision, context });

test("target context reuses actual task selection and keeps mandatory product constraints", t => {
  const root = fixture(t), base = buildTaskContext(root, task), result = buildImplementationContext(root, request(root), buildTaskContext);
  assert.deepEqual(result.artifact.model, base.artifact.model); assert.deepEqual(result.artifact.sources, base.artifact.sources);
  assert.equal(result.artifact.productTaskBuildId, base.artifact.buildId);
  assert.ok(result.artifact.model.nodes.some(n => n.id === "constraint:local"));
  assert.equal(result.artifact.implementation.target.framework, "React");
  assert.equal(result.artifact.implementation.bindings.length, 1);
  assert.equal(result.artifact.implementation.omittedBindings[0].nodeId, "feature:other");
  assert.ok(!result.markdown.includes("Rotation.swift")); assert.ok(!result.markdown.includes("Private mobile guidance"));
  assert.ok(!result.markdown.includes("secret-outside-task.ts"));
});
test("normal product-only context stays unchanged; no target is implicitly selected", t => {
  const root = fixture(t), before = buildTaskContext(root, task);
  buildImplementationContext(root, request(root), buildTaskContext);
  assert.deepEqual(buildTaskContext(root, task), before); assert.ok(!("implementation" in before.artifact));
});
test("selection of another target changes context identity, never domain identity", t => {
  const root = fixture(t), web = buildImplementationContext(root, request(root), buildTaskContext), ios = buildImplementationContext(root, request(root, "ios"), buildTaskContext);
  assert.deepEqual(web.artifact.model, ios.artifact.model); assert.notEqual(web.artifact.buildId, ios.artifact.buildId);
  assert.equal(ios.artifact.implementation.target.framework, "SwiftUI");
  assert.equal(web.artifact.permissions.execute, false); assert.equal(ios.artifact.implementation.generation.available, false);
});
test("identical inputs reproduce context; changing source Markdown or target configuration invalidates it", t => {
  const root = fixture(t), first = buildImplementationContext(root, request(root), buildTaskContext);
  assert.deepEqual(buildImplementationContext(root, request(root), buildTaskContext), first);
  fs.appendFileSync(path.join(root, "documents/rotation.md"), "New rule.\n");
  const second = buildImplementationContext(root, request(root), buildTaskContext); assert.notEqual(second.artifact.buildId, first.artifact.buildId);
  const snap = loadImplementation(root); snap.config.targets[0].notes = "Changed target decision";
  saveImplementation(root, { expectedRevision: snap.revision, config: snap.config });
  assert.notEqual(buildImplementationContext(root, request(root), buildTaskContext).artifact.buildId, second.artifact.buildId);
});
test("unknown target, stale revision and empty product scope fail before a handoff", t => {
  const root = fixture(t);
  assert.throws(() => buildImplementationContext(root, request(root, "other-project"), buildTaskContext), /does not belong/);
  assert.throws(() => buildImplementationContext(root, { ...request(root), expectedRevision: "old" }, buildTaskContext), /Refresh/);
  assert.throws(() => buildImplementationContext(root, request(root, "web", { ...task, rootIds: [] }), buildTaskContext), /explicit task root/);
});
test("source changes during composition are refused instead of mixing graph revisions", t => {
  const root = fixture(t);
  assert.throws(() => buildImplementationContext(root, request(root), (r, i) => {
    const result = buildTaskContext(r, i), graph = loadGraph(r); graph.nodes[0].title = "Changed"; saveGraph(r, graph); return result;
  }), /Sources changed/);
});
test("implementation metadata is counted and never silently trimmed at the source-character budget", t => {
  const root = fixture(t), snap = loadImplementation(root); snap.config.targets[0].notes = "x".repeat(3000);
  saveImplementation(root, { expectedRevision: snap.revision, config: snap.config });
  const result = buildImplementationContext(root, request(root, "web", { ...task, maxCharacters: 1000 }), buildTaskContext);
  assert.equal(result.artifact.budget.overBudget, true); assert.equal(result.artifact.implementation.target.notes.length, 3000);
  assert.equal(result.artifact.status, "incomplete"); assert.equal(result.artifact.budget.tokenizerMeasured, false);
});
test("matching a template is declared support only and drift is included as a context gap", t => {
  const root = fixture(t);
  writeJson(path.join(root, "templates/web.json"), { id: "web", version: "1", implementation: { schemaVersion: "productgraph.template-contract.v1", roles: ["interface"], environments: ["browser"], slots: [{ id: "feature", nodeTypes: ["feature"] }] } });
  const snap = loadImplementation(root), template = snap.templates[0];
  snap.config.targets[0].template = { id: template.id, version: template.version, definitionHash: template.definitionHash };
  snap.config.targets[0].bindings[0] = { nodeId: "feature:rotation", mode: "template", slot: "feature", reference: "" };
  saveImplementation(root, { expectedRevision: snap.revision, config: snap.config });
  const first = buildImplementationContext(root, request(root), buildTaskContext);
  assert.equal(first.artifact.implementation.bindings[0].status, "mapped-declaration");
  assert.equal(first.artifact.implementation.generation.available, false);
  fs.appendFileSync(path.join(root, "templates/web.json"), "\n");
  const drifted = buildImplementationContext(root, request(root), buildTaskContext).artifact;
  assert.ok(drifted.gaps.some(g => g.includes("Pinned definition changed")));
  assert.equal(drifted.implementation.template, null);
  assert.equal(drifted.implementation.observedTemplate?.reason, "unreviewed-definition-drift; content omitted");
});
test("Markdown contains exactly the retained artifact and safe fences even for hostile source strings", t => {
  const root = fixture(t), snap = loadImplementation(root); snap.config.targets[0].notes = "```\n<script>alert(1)</script>\n```";
  saveImplementation(root, { expectedRevision: snap.revision, config: snap.config });
  const result = buildImplementationContext(root, request(root), buildTaskContext);
  assert.ok(result.markdown.includes(JSON.stringify(result.artifact, null, 2))); assert.ok(result.markdown.includes("````json"));
});

async function httpFixture(t: any) {
  const a = fixture(t, "a"), b = fixture(t, "b");
  // The exact new handler, mounted with the same per-request root contract as Workspace.
  const server = http.createServer(async (req, res) => {
    try {
      const match = req.url?.match(/^\/api\/projects\/(a|b)(\/implementation(?:\/context)?)$/);
      if (!match) { res.writeHead(404); res.end(); return; }
      req.url = `/api${match[2]}`;
      await handleImplementationRequest(match[1] === "a" ? a : b, req, res);
    } catch (e) { res.writeHead(e instanceof LocalError ? e.status : e instanceof SyntaxError ? 400 : 500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ message: (e as Error).message })); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => { server.closeAllConnections(); server.close(); });
  const port = (server.address() as any).port;
  const call = (project: string, suffix = "", body?: unknown, headers = {}) => fetch(`http://127.0.0.1:${port}/api/projects/${project}/implementation${suffix}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { a, b, call };
}
test("real HTTP handler reads/writes one project, refuses stale/foreign snapshots and survives reopen", async t => {
  const { a, b, call } = await httpFixture(t), oldA = await (await call("a")).json(), oldB = await (await call("b")).json();
  oldA.config.targets[0].name = "Updated web";
  assert.equal((await call("a", "", { expectedRevision: oldA.revision, config: oldA.config })).status, 200);
  assert.equal((await call("a", "", { expectedRevision: oldA.revision, config: oldA.config })).status, 409);
  assert.equal((await call("b", "", { expectedRevision: oldB.revision, config: oldA.config })).status, 409);
  assert.equal(loadImplementation(a).config.targets[0].name, "Updated web"); assert.equal(loadImplementation(b).config.targets[0].name, "Web");
});
test("real HTTP target-context uses source body but has no implicit target or side effects", async t => {
  const { a, call } = await httpFixture(t), before = fs.readFileSync(path.join(a, "implementation/targets.json"), "utf8");
  const response = await call("a", "/context", request(a)); assert.equal(response.status, 200);
  const result = await response.json(); assert.match(result.artifact.sources[0].content, /Retain accepted/);
  assert.equal(result.artifact.implementation.target.id, "web"); assert.equal(fs.readFileSync(path.join(a, "implementation/targets.json"), "utf8"), before);
  assert.equal((await call("a", "/context", { context: task })).status, 400);
});
test("local HTTP origin boundary and config shape checks are enforced", async t => {
  const { a, call } = await httpFixture(t);
  assert.equal((await call("a", "", {}, { Origin: "https://other.example" })).status, 403);
  assert.equal((await call("a", "", {})).status, 428);
  assert.equal((await call("a", "/context", { ...request(a), execute: true })).status, 400);
});

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
test("target CLI uses the same builder and writes only its retained artifact to stdout", t => {
  const root = fixture(t), before = fs.readFileSync(path.join(root, "implementation/targets.json"), "utf8");
  const cli = fileURLToPath(new URL("../src/implementation-context-cli.ts", import.meta.url));
  const run = spawnSync(process.execPath, ["--experimental-strip-types", cli, root, "web", "feature:rotation", "Implement rotation", "json"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), JSON.parse(JSON.stringify(buildImplementationContext(root, request(root), buildTaskContext).artifact)));
  assert.equal(fs.readFileSync(path.join(root, "implementation/targets.json"), "utf8"), before);
});
test("target CLI rejects unknown target and unsupported output format", t => {
  const root = fixture(t), cli = fileURLToPath(new URL("../src/implementation-context-cli.ts", import.meta.url));
  const unknown = spawnSync(process.execPath, ["--experimental-strip-types", cli, root, "missing", "feature:rotation", "Task"], { encoding: "utf8" });
  assert.equal(unknown.status, 1); assert.equal(unknown.stdout, "");
  const format = spawnSync(process.execPath, ["--experimental-strip-types", cli, root, "web", "feature:rotation", "Task", "swift"], { encoding: "utf8" });
  assert.equal(format.status, 2); assert.equal(format.stdout, "");
});
