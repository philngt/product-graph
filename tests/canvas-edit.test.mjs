import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCanvasEdit, cleanTitle, cleanRelation, findConnectionTargets, nearbyPosition, OBJECT_CHOICES } from '../ui/canvas-edit-model.js';
import { projectView, projectScope } from '../ui/studio-state.js';
const graph = () => ({ manifest: { projectId: 'demo', name: 'Demo', schemaVersion: '1' }, nodes: [
  { id: 'feature:a', title: 'Record usage', region: 'product', type: 'feature', data: { important: true }, document: 'doc:a' },
  { id: 'domain:b', title: 'Bottle', region: 'domain', type: 'entity' },
], edges: [], documents: [{ id: 'doc:a', path: 'documents/brief.md', links: ['feature:a'] }] });
const uuid = () => { let n = 0; return () => `id-${++n}`; };

test('rename retains identity, all metadata, edges, documents and original input', () => {
  const g = graph(), before = structuredClone(g), r = prepareCanvasEdit(g, { action: 'rename', id: 'feature:a', expectedTitle: 'Record usage', title: '  Ghi nhận sử dụng  ' });
  assert.equal(r.graph.nodes[0].title, 'Ghi nhận sử dụng'); assert.equal(r.graph.nodes[0].id, 'feature:a');
  assert.deepEqual(r.graph.nodes[0].data, before.nodes[0].data); assert.equal(r.graph.nodes[0].document, 'doc:a');
  assert.deepEqual(r.graph.documents, g.documents); assert.deepEqual(g, before);
});
test('unchanged rename is a no-op, not an undoable edit', () => {
  const g = graph(), r = prepareCanvasEdit(g, { action: 'rename', id: 'feature:a', expectedTitle: 'Record usage', title: 'Record usage' });
  assert.equal(r.changed, false); assert.equal(r.graph, g);
});
test('stale title and missing object refuse changes', () => {
  assert.throws(() => prepareCanvasEdit(graph(), { action: 'rename', id: 'feature:a', expectedTitle: 'Old', title: 'New' }), /changed/);
  assert.throws(() => prepareCanvasEdit(graph(), { action: 'rename', id: 'missing', expectedTitle: '', title: 'New' }), /no longer/);
});
test('Unicode is retained and empty, controls and excessive titles are rejected', () => {
  assert.equal(cleanTitle('  Đồ thị ✦  '), 'Đồ thị ✦');
  for (const title of ['', ' \t ', 'a\nb', 'x\0y', 'x'.repeat(201), null]) assert.throws(() => cleanTitle(title));
});
test('HTML-looking title remains source text, not code or a type', () => {
  const r = prepareCanvasEdit(graph(), { action: 'create', title: '<img src=x onerror=bad()>', choice: 'entity' }, uuid());
  assert.equal(r.graph.nodes.at(-1).title, '<img src=x onerror=bad()>'); assert.equal(r.graph.nodes.at(-1).type, 'entity');
});
test('related creation is one prepared graph with a draft object and explicit edge', () => {
  const g = graph(), r = prepareCanvasEdit(g, { action: 'create', title: 'Validate', choice: 'step', from: 'feature:a', kind: 'contains' }, uuid());
  assert.equal(r.graph.nodes.length, 3); assert.equal(r.graph.edges.length, 1);
  assert.equal(r.graph.nodes.at(-1).status, 'draft'); assert.equal(r.graph.nodes.at(-1).region, 'workflow');
  assert.equal(r.graph.edges[0].to, r.createdId); assert.equal(r.graph.edges[0].data.executable, false);
  assert.equal(g.nodes.length, 2); assert.equal(g.edges.length, 0);
});
test('standalone creation invents no relationship or platform', () => {
  const r = prepareCanvasEdit(graph(), { action: 'create', title: 'Concept', choice: 'feature' }, uuid());
  assert.equal(r.graph.edges.length, 0); assert.deepEqual(r.graph.nodes.at(-1).data, {});
});
test('every quick-create choice yields its stated semantic type and region', () => {
  for (const c of OBJECT_CHOICES) {
    const r = prepareCanvasEdit(graph(), { action: 'create', choice: c.key, title: c.label }, uuid());
    assert.equal(r.graph.nodes.at(-1).type, c.type); assert.equal(r.graph.nodes.at(-1).region, c.region);
  }
});
test('missing relation, unknown type or missing source leaves the entire input untouched', () => {
  const g = graph(), before = structuredClone(g);
  for (const patch of [{ kind: '' }, { choice: 'mystery' }, { from: 'absent' }]) {
    assert.throws(() => prepareCanvasEdit(g, { action: 'create', choice: 'entity', title: 'New', from: 'feature:a', kind: 'uses', ...patch }, uuid()));
    assert.deepEqual(g, before);
  }
});
test('renamed/identical titles never become identities; existing object can be reused', () => {
  const g = graph(), a = prepareCanvasEdit(g, { action: 'create', choice: 'entity', title: 'Bottle' }, uuid());
  assert.notEqual(a.createdId, 'domain:b');
  const r = prepareCanvasEdit(g, { action: 'connect', from: 'feature:a', to: 'domain:b', kind: 'reads' }, uuid());
  assert.equal(r.graph.nodes.length, 2); assert.equal(r.graph.edges[0].to, 'domain:b');
});
test('identical edge refused, but direction and different semantic meaning remain explicit', () => {
  const r = prepareCanvasEdit(graph(), { action: 'connect', from: 'feature:a', to: 'domain:b', kind: 'reads' }, uuid());
  assert.throws(() => prepareCanvasEdit(r.graph, { action: 'connect', from: 'feature:a', to: 'domain:b', kind: 'reads' }, () => 'other'), /already exists/);
  assert.equal(prepareCanvasEdit(r.graph, { action: 'connect', from: 'feature:a', to: 'domain:b', kind: 'writes' }, () => 'other').graph.edges.length, 2);
  assert.equal(prepareCanvasEdit(r.graph, { action: 'connect', from: 'domain:b', to: 'feature:a', kind: 'reads' }, () => 'reverse').graph.edges.length, 2);
});
test('self/foreign relation and collided generated identity are rejected', () => {
  const g = graph();
  for (const to of ['feature:a', 'other-project:thing']) assert.throws(() => prepareCanvasEdit(g, { action: 'connect', from: 'feature:a', to, kind: 'reads' }));
  assert.throws(() => prepareCanvasEdit(g, { action: 'create', choice: 'entity', title: 'Name' }, () => 'b'), /identity/);
  g.edges.push({ id: 'edge:taken', from: 'domain:b', to: 'feature:a', kind: 'custom' });
  assert.throws(() => prepareCanvasEdit(g, { action: 'create', choice: 'entity', title: 'New', from: 'feature:a', kind: 'reads' }, () => 'taken'), /identity/);
  assert.equal(g.nodes.length, 2);
});
test('custom relationship vocabulary is explicit and bounded', () => {
  assert.equal(cleanRelation('domain:depends-on'), 'domain:depends-on');
  for (const k of ['', ' ', '<script>', 'Has Space', 'a'.repeat(81)]) assert.throws(() => cleanRelation(k));
});
test('name search handles accents, excludes source and does not mutate graph order', () => {
  const g = graph(); g.nodes.push({ id: 'x', title: 'Nước hoa', type: 'entity', region: 'domain' });
  const before = structuredClone(g);
  assert.equal(findConnectionTargets(g, 'feature:a', 'nuoc').nodes[0].id, 'x');
  assert.equal(findConnectionTargets(g, 'feature:a', 'Record usage').total, 0); assert.deepEqual(g, before);
});
test('ambiguous names stay distinct and search has a bounded result count', () => {
  const g = graph(); for (let n = 0; n < 250; n++) g.nodes.push({ id: `duplicate:${n}`, title: 'Bottle', type: 'entity', region: 'domain' });
  const r = findConnectionTargets(g, 'feature:a', 'Bottle'); assert.equal(r.nodes.length, 80); assert.equal(r.total, 251);
  assert.equal(new Set(r.nodes.map(n => n.id)).size, 80);
});
test('adjacent insertion preserves occupied geometry and deterministically avoids collisions', () => {
  const positions = { a: { x: 200, y: 120, pinned: true }, b: { x: 520, y: 120, pinned: false } }, before = structuredClone(positions);
  const r = nearbyPosition({ x: 520, y: 120 }, positions);
  assert.equal(r.x, 520); assert.ok(r.y > 120); assert.equal(r.pinned, true); assert.deepEqual(positions, before);
  assert.deepEqual(nearbyPosition({ x: 520, y: 120 }, positions), r); assert.throws(() => nearbyPosition({ x: NaN, y: 0 }, positions));
});
test('saved graph remains full when only a one-node lens projection is visible', () => {
  const r = prepareCanvasEdit(graph(), { action: 'create', choice: 'screen', title: 'Detail' }, uuid());
  const view = projectView(r.graph, { scope: projectScope(), view: 'domain', search: '', selectedId: r.createdId });
  assert.equal(view.selectionVisibility, 'hidden-by-lens'); assert.equal(r.graph.nodes.length, 3); assert.equal(r.graph.documents.length, 1);
});
test('unknown edit input cannot be treated as success', () => {
  for (const edit of [null, {}, { action: 'execute' }]) assert.throws(() => prepareCanvasEdit(graph(), edit));
});
