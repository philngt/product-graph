import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createWorkspaceHandler } from "../src/workspace-server.ts";
import { loadGraph } from "../src/io.ts";
import { fixture } from "./helpers/authoring-fixture.ts";

async function serverFixture(t: any) {
  const f = fixture(t), server = http.createServer(createWorkspaceHandler(f.home));
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = async (path: string, input?: unknown, revision?: string, headers = {}) => {
    const response = await fetch(url + path, { method: input === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(revision ? { "X-Product-Graph-Revision": revision } : {}), ...headers }, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) });
    return { status: response.status, data: await response.json() as any };
  };
  return { ...f, call, prefix: `/api/projects/${f.project.id}` };
}
test("HTTP golden path: sketch → explicit proposal → review/apply → context", async t => {
  const f = await serverFixture(t), before = loadGraph(f.root);
  const w = await f.call(`${f.prefix}/workspace`), s = await f.call(`${f.prefix}/authoring`);
  assert.equal(s.status, 200); assert.equal(s.data.board.notes.length, 3);
  const p = await f.call(`${f.prefix}/authoring/proposal`, f.input(), w.data.workspaceRevision);
  assert.equal(p.status, 201); assert.deepEqual(loadGraph(f.root), before);
  const base = `${f.prefix}/proposals/${p.data.proposal.id}`;
  const preview = await f.call(`${base}/preview`, {});
  assert.equal(preview.data.canApply, true);
  const applied = await f.call(`${base}/apply`, {}, w.data.workspaceRevision, { "X-Product-Graph-Proposal-Revision": preview.data.proposalRevision });
  assert.equal(applied.status, 200); assert.equal(loadGraph(f.root).nodes.length, before.nodes.length + 1);
  assert.equal((await f.call(`${base}/apply`, {}, applied.data.workspaceRevision)).status, 409);
  const context = await f.call(`${f.prefix}/task-context`, { task: "Implement cooldown", rootIds: ["domain:sketch-rule-note"] });
  assert.equal(context.status, 200); assert.ok(context.data.artifact.model.nodes.some((n: any) => n.id === "constraint:offline"));
  assert.ok(context.data.artifact.sources.some((s: any) => s.content.includes("Avoid recently used")));
  assert.equal(context.data.artifact.permissions.execute, false);
});
test("HTTP cannot apply stale source or stale model, nor write without revision", async t => {
  const f = await serverFixture(t), w = await f.call(`${f.prefix}/workspace`);
  assert.equal((await f.call(`${f.prefix}/authoring/proposal`, f.input())).status, 428);
  const p = await f.call(`${f.prefix}/authoring/proposal`, f.input(), w.data.workspaceRevision);
  const s = await f.call(`${f.prefix}/authoring`); s.data.board.notes[0].text = "Changed after review";
  assert.equal((await f.call(`${f.prefix}/authoring/board`, { expectedRevision: s.data.boardRevision, board: s.data.board })).status, 200);
  const base = `${f.prefix}/proposals/${p.data.proposal.id}`;
  assert.equal((await f.call(`${base}/preview`, {})).data.canApply, false);
  assert.equal((await f.call(`${base}/apply`, {}, w.data.workspaceRevision)).status, 409);
});
test("project routes isolate notes, proposals and context", async t => {
  const f = await serverFixture(t), p2 = f.registry.create("Other product"), prefix = `/api/projects/${p2.id}`;
  assert.equal((await f.call(`${prefix}/authoring`)).data.board.notes.length, 0);
  assert.equal((await f.call(`${prefix}/task-context`, { task: "Read rotation", rootIds: ["feature:rotation"] })).status, 400);
  assert.equal((await f.call('/api/authoring')).status, 404);
  assert.equal((await f.call(`${f.prefix}/task-context`, { task: "task", rootIds: ["feature:rotation"] }, undefined, { Origin: "https://evil.example" })).status, 403);
});
test("rejected proposal and malformed input leave semantic data unchanged", async t => {
  const f = await serverFixture(t), before = loadGraph(f.root), w = await f.call(`${f.prefix}/workspace`);
  assert.equal((await f.call(`${f.prefix}/authoring/board`, { board: null })).status, 400);
  const p = await f.call(`${f.prefix}/authoring/proposal`, f.input(), w.data.workspaceRevision);
  const base = `${f.prefix}/proposals/${p.data.proposal.id}`;
  assert.equal((await f.call(`${base}/reject`, {})).status, 200);
  assert.equal((await f.call(`${base}/apply`, {}, w.data.workspaceRevision)).status, 409);
  assert.deepEqual(loadGraph(f.root), before);
});

test("review binds exact proposal bytes, not just a proposal ID", async t => {
  const f = await serverFixture(t), before = loadGraph(f.root), w = await f.call(`${f.prefix}/workspace`);
  const p = await f.call(`${f.prefix}/authoring/proposal`, f.input(), w.data.workspaceRevision);
  const base = `${f.prefix}/proposals/${p.data.proposal.id}`;
  assert.equal((await f.call(`${base}/apply`, {}, w.data.workspaceRevision)).status, 428);
  const preview = await f.call(`${base}/preview`, {});
  const { saveProposal } = await import("../src/io.ts");
  const changed = p.data.proposal;
  changed.commands.find((command: any) => command.type === "create-node").node.title = "Changed after review";
  saveProposal(f.root, changed);
  const applied = await f.call(`${base}/apply`, {}, w.data.workspaceRevision, { "X-Product-Graph-Proposal-Revision": preview.data.proposalRevision });
  assert.equal(applied.status, 409);
  assert.deepEqual(loadGraph(f.root), before);
});
