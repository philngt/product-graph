import test from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { ProjectRegistry } from "../src/project-registry.ts";
import { startWorkspaceServer } from "../src/workspace-server.ts";
import { startServer } from "../src/server.ts";
import { loadGraph, saveGraph } from "../src/io.ts";

const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), "pg-projects-"));
function fixture(t: any) { const home = temporary(); t.after(() => fs.rmSync(home, { recursive: true, force: true })); return { home, registry: new ProjectRegistry(home) }; }
async function apiFixture(t: any) {
  const result = fixture(t);
  const server = startWorkspaceServer(result.home, 0); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const api = async (url: string, method = "GET", value?: any, headers = {}) => {
    const response = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...headers }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    return { status: response.status, data: await response.json() };
  };
  return { ...result, base, api };
}

test("create projects with distinct folders, manifests and catalog IDs; reopen in a new registry", t => {
  const { home, registry } = fixture(t); const a = registry.create("Fragrance Rotation"), b = registry.create("Home Materials");
  assert.notEqual(a.id, b.id); assert.notEqual(a.root, b.root);
  assert.notEqual(loadGraph(a.root).manifest.projectId, loadGraph(b.root).manifest.projectId);
  assert.equal(new ProjectRegistry(home).list().length, 2);
  assert.equal(registry.register(a.root).id, a.id);
  assert.equal(fs.readFileSync(path.join(a.root, "documents/overview.md"), "utf8").includes("Fragrance Rotation"), true);
});
test("register existing folders in place and deduplicate aliases without changing files", t => {
  const { registry } = fixture(t), a = registry.create("A");
  const before = fs.readFileSync(path.join(a.root, "project.json"));
  const alias = path.join(path.dirname(a.root), "alias"); fs.symlinkSync(a.root, alias, "dir");
  assert.equal(registry.register(alias).id, a.id);
  assert.deepEqual(fs.readFileSync(path.join(a.root, "project.json")), before);
  assert.throws(() => registry.register("relative/path"), /absolute/);
});
test("copies with the same manifest ID still have isolated catalog identities", t => {
  const { home, registry } = fixture(t), a = registry.create("A"), copy = path.join(home, "copy");
  fs.cpSync(a.root, copy, { recursive: true }); const b = registry.register(copy);
  assert.notEqual(a.id, b.id); assert.equal(registry.list().length, 2);
});
test("recent visit persists; forget never deletes; moved roots remain recoverable", t => {
  const { registry } = fixture(t), a = registry.create("A"), b = registry.create("B");
  registry.visit(a.id); assert.equal(registry.list()[0].id, a.id);
  fs.renameSync(b.root, `${b.root}-moved`);
  assert.equal(registry.list().find(p => p.id === b.id)?.available, false);
  assert.throws(() => registry.resolve(b.id), /unavailable/);
  registry.forget(b.id); assert.ok(fs.existsSync(`${b.root}-moved`));
  registry.forget(a.id); assert.ok(fs.existsSync(path.join(a.root, "project.json")));
});
test("corrupt catalog is not silently overwritten", t => {
  const { home, registry } = fixture(t); fs.writeFileSync(path.join(home, "projects.json"), "broken");
  assert.throws(() => registry.create("A")); assert.equal(fs.readFileSync(path.join(home, "projects.json"), "utf8"), "broken");
});
test("project data symlinks and unmanaged IDs cannot redirect requests", t => {
  const { home, registry } = fixture(t), a = registry.create("A");
  fs.writeFileSync(path.join(home, "outside.json"), '{}');
  fs.symlinkSync(path.join(home, "outside.json"), path.join(a.root, "graph/nodes/outside.json"));
  assert.throws(() => registry.resolve(a.id), /Symbolic/);
  assert.throws(() => registry.resolve("../../anything"), /Unknown/);
});
test("real HTTP catalog create, open, list and non-destructive removal", async t => {
  const { api, registry } = await apiFixture(t);
  const created = await api('/api/projects', 'POST', { name: 'Actual project', description: 'Test' });
  assert.equal(created.status, 201); const { id, root } = created.data.project;
  assert.equal((await api('/api/projects/open', 'POST', { path: root })).data.project.id, id);
  assert.equal((await api('/api/projects')).data.projects.length, 1);
  assert.equal((await api(`/api/projects/${id}/visit`, 'POST', {})).status, 200);
  assert.ok(registry.list()[0].lastOpenedAt);
  assert.equal((await api(`/api/projects/${id}`, 'DELETE', {})).data.filesDeleted, false);
  assert.ok(fs.existsSync(root)); assert.equal((await api('/api/projects')).data.projects.length, 0);
});
test("two tab URLs write to their own roots, saved graph and layout reload from disk", async t => {
  const { api, registry } = await apiFixture(t), a = registry.create('A'), b = registry.create('B');
  const read = await api(`/api/projects/${a.id}/workspace`), payload = read.data;
  payload.graph.nodes[0].title = 'A edited'; payload.layout = { 'project:overview': { schemaVersion: '1.0.0', positions: { 'product:root': { x: 30, y: 40 } } } };
  const saved = await api(`/api/projects/${a.id}/workspace`, 'POST', payload, { 'X-Product-Graph-Revision': read.data.workspaceRevision });
  assert.equal(saved.status, 200);
  assert.equal(loadGraph(a.root).nodes[0].title, 'A edited'); assert.equal(loadGraph(b.root).nodes[0].title, 'B');
  const reopened = (await api(`/api/projects/${a.id}/workspace`)).data;
  assert.equal(reopened.graph.nodes[0].title, 'A edited'); assert.equal(reopened.layout['project:overview'].positions['product:root'].x, 30);
  assert.notEqual(reopened.workspaceRevision, payload.workspaceRevision);
});
test("unscoped APIs and unknown projects do not fall back to another project", async t => {
  const { api, registry } = await apiFixture(t); registry.create('A');
  assert.equal((await api('/api/workspace')).status, 404);
  assert.equal((await api('/api/projects/00000000-0000-0000-0000-000000000000/workspace')).status, 404);
});
test("workspace saves require revision; stale, foreign and traversal writes do not overwrite disk", async t => {
  const { api, registry } = await apiFixture(t), a = registry.create('A'), b = registry.create('B');
  const route = `/api/projects/${a.id}/workspace`, initial = (await api(route)).data;
  assert.equal((await api(route, 'POST', initial)).status, 428);
  const altered = structuredClone(initial); altered.graph.nodes[0].title = 'First save';
  assert.equal((await api(route, 'POST', altered, { 'X-Product-Graph-Revision': initial.workspaceRevision })).status, 200);
  assert.equal((await api(route, 'POST', initial, { 'X-Product-Graph-Revision': initial.workspaceRevision })).status, 409);
  const current = (await api(route)).data;
  const foreign = { ...current, graph: loadGraph(b.root) };
  assert.equal((await api(route, 'POST', foreign, { 'X-Product-Graph-Revision': current.workspaceRevision })).status, 409);
  current.layout = { '../escape': { positions: {} } };
  assert.equal((await api(route, 'POST', current, { 'X-Product-Graph-Revision': current.workspaceRevision })).status, 400);
  assert.equal(loadGraph(a.root).nodes[0].title, 'First save');
  assert.equal(fs.existsSync(path.join(a.root, 'escape.json')), false);
});
test("concurrent same-revision saves have one winner; external edits are detected", async t => {
  const { api, registry } = await apiFixture(t), a = registry.create('A'), route = `/api/projects/${a.id}/workspace`;
  const initial = (await api(route)).data, headers = { 'X-Product-Graph-Revision': initial.workspaceRevision };
  const results = await Promise.all([api(route, 'POST', initial, headers), api(route, 'POST', { ...initial, graph: { ...initial.graph, manifest: { ...initial.graph.manifest, description: 'B' } } }, headers)]);
  // An identical no-op save does not consume a revision, so test actual edits separately below.
  assert.ok(results.some(r => r.status === 200));
  const current = (await api(route)).data;
  const payloads = ['X', 'Y'].map(title => { const p = structuredClone(current); p.graph.nodes[0].title = title; return p; });
  const writes = await Promise.all(payloads.map(p => api(route, 'POST', p, { 'X-Product-Graph-Revision': current.workspaceRevision })));
  assert.deepEqual(writes.map(r => r.status).sort(), [200, 409]);
  const last = (await api(route)).data; const onDisk = loadGraph(a.root); onDisk.nodes[0].title = 'External'; saveGraph(a.root, onDisk);
  assert.equal((await api(route, 'POST', last, { 'X-Product-Graph-Revision': last.workspaceRevision })).status, 409);
});
test("deletions survive reopening and normalized-ID collisions fail", t => {
  const { registry } = fixture(t), a = registry.create('A'), graph = loadGraph(a.root);
  graph.nodes = []; graph.documents[0].links = []; saveGraph(a.root, graph); assert.equal(loadGraph(a.root).nodes.length, 0);
  const copy = loadGraph(a.root); copy.nodes = [{ id:'a:b',region:'product',type:'feature',title:'A' },{ id:'a-b',region:'product',type:'feature',title:'B' }];
  assert.throws(() => saveGraph(a.root, copy), /collide/); assert.equal(loadGraph(a.root).nodes.length, 0);
});
test("local service rejects cross-origin, form writes and DNS-rebinding Host", async t => {
  const { api, base } = await apiFixture(t);
  assert.equal((await api('/api/projects', 'POST', { name: 'No' }, { Origin:'https://evil.example' })).status, 403);
  assert.equal((await fetch(base + '/api/projects', { method:'POST', body:'name=No', headers:{'Content-Type':'application/x-www-form-urlencoded'} })).status, 415);
  const rebinding = await new Promise<number>((resolve, reject) => {
    const request = http.get(base + '/api/projects', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode!); }); request.on('error', reject);
  });
  assert.equal(rebinding, 403);
  assert.equal((await api('/api/projects')).data.projects.length, 0);
});
test("legacy single-project server still serves an unscoped workspace", async t => {
  const { registry } = fixture(t), a = registry.create('Legacy'), server = startServer(a.root,0); await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const result = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/workspace`); assert.equal(result.status,200);
  const payload = await result.json(); assert.equal(payload.graph.manifest.name,'Legacy'); assert.ok(payload.workspaceRevision);
});

test("workspace save preflights graph and layout together before writing", async t => {
  const { api, registry } = await apiFixture(t), a = registry.create("A");
  const first = await api(`/api/projects/${a.id}/workspace`);
  const graph = structuredClone(first.data.graph);
  graph.nodes.push({ ...graph.nodes[0], id: 'a:b' }, { ...graph.nodes[0], id: 'a-b' });
  const headers = { 'X-Product-Graph-Revision': first.data.workspaceRevision };
  const result = await api(`/api/projects/${a.id}/workspace`, 'POST', { graph, layout: { overview: { schemaVersion: '1.0.0', positions: {} } } }, headers);
  assert.equal(result.status, 400);
  assert.equal(fs.existsSync(path.join(a.root, 'layout/overview.json')), false);
  assert.deepEqual(loadGraph(a.root), first.data.graph);
  const invalid = await api(`/api/projects/${a.id}/workspace`, 'POST', { graph: { manifest: graph.manifest, nodes: null } }, headers);
  assert.equal(invalid.status, 400);
});
