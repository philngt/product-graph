import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJECT_CHOICES, createObjectPlan, connectObjectsPlan, renameObjectPlan, findObjects, nextObjectPosition } from '../ui/quick-edit-model.js';
import { projectView, projectScope } from '../ui/studio-state.js';
const fixture = () => ({ manifest: { projectId: 'test' }, nodes: [
  { id: 'feature:a', title: 'Record usage', type: 'feature', region: 'product', data: { retained: true } },
  { id: 'domain:b', title: 'Bottle', type: 'entity', region: 'domain' },
], edges: [], documents: [{ id: 'doc', title: 'Brief', path: 'documents/brief.md', links: ['feature:a'] }] });
const ids = () => { let n = 0; return () => `test-${++n}`; };
test('all palette choices make draft objects without imposing a target', () => {
  for (const choice of OBJECT_CHOICES) {
    const g = fixture(), out = createObjectPlan(g, { choice: choice.id, title: choice.label }, ids());
    assert.equal(out.node.region, choice.region); assert.equal(out.node.type, choice.type); assert.equal(out.node.status, 'draft');
    assert.ok(!('target' in out.node)); assert.equal(out.graph.nodes.length, 3); assert.equal(out.graph.edges.length, 0);
  }
});
test('create+connect is one pure candidate and preserves unrelated model/source data', () => {
  const graph = fixture(), before = structuredClone(graph);
  const result = createObjectPlan(graph, { choice: 'rule', title: 'Cooldown', anchorId: 'feature:a', kind: 'constrains', direction: 'incoming' }, ids());
  assert.deepEqual(graph, before); assert.equal(result.edge.from, result.node.id); assert.equal(result.edge.to, 'feature:a');
  assert.deepEqual(result.graph.documents, graph.documents); assert.equal(result.edge.data.executable, false);
});
test('no implicit object type or relationship meaning', () => {
  assert.throws(() => createObjectPlan(fixture(), { title: 'Unnamed type' }, ids()), /Choose/);
  assert.throws(() => createObjectPlan(fixture(), { title: 'Step', choice: 'step', anchorId: 'feature:a', direction: 'outgoing' }, ids()), /meaning/);
});
test('explicit direction is required for connected creation', () => {
  assert.throws(() => createObjectPlan(fixture(), { choice: 'entity', title: 'Object', anchorId: 'feature:a', kind: 'uses' }, ids()), /direction/);
});
test('same display names get distinct stable IDs, not duplicate IDs based on titles', () => {
  const uuid = ids(); const a = createObjectPlan(fixture(), { choice: 'entity', title: 'Bottle' }, uuid);
  const b = createObjectPlan(a.graph, { choice: 'entity', title: 'Bottle' }, uuid); assert.notEqual(a.node.id, b.node.id);
});
test('invalid name, unknown type and source endpoint fail without changing input', () => {
  const g = fixture(), before = structuredClone(g);
  for (const title of ['', ' ', 'x'.repeat(201), 'a\0b']) assert.throws(() => createObjectPlan(g, { choice: 'entity', title }, ids()));
  assert.throws(() => createObjectPlan(g, { choice: 'eval-script', title: 'No' }, ids()));
  assert.throws(() => createObjectPlan(g, { choice: 'entity', title: 'No', anchorId: 'foreign' }, ids()));
  assert.deepEqual(g, before);
});
test('relationship endpoints are live, never guessed from a display name', () => {
  assert.throws(() => connectObjectsPlan(fixture(), { from: 'feature:a', to: 'Bottle', kind: 'uses' }, ids()), /no longer exists/);
});
test('exact duplicate and accidental self connections are rejected', () => {
  const first = connectObjectsPlan(fixture(), { from: 'feature:a', to: 'domain:b', kind: 'uses' }, ids());
  assert.throws(() => connectObjectsPlan(first.graph, { from: 'feature:a', to: 'domain:b', kind: 'uses' }, ids()), /already exists/);
  assert.throws(() => connectObjectsPlan(fixture(), { from: 'feature:a', to: 'feature:a', kind: 'uses' }, ids()), /different objects/);
});
test('other explicit relationship kinds remain metadata only', () => {
  const result = connectObjectsPlan(fixture(), { from: 'feature:a', to: 'domain:b', kind: 'custom:selects' }, ids());
  assert.equal(result.edge.kind, 'custom:selects'); assert.equal(result.edge.data.relationClass, 'semantic'); assert.equal(result.edge.data.executable, false);
  assert.throws(() => connectObjectsPlan(fixture(), { from: 'feature:a', to: 'domain:b', kind: '<script>' }, ids()));
});
test('rename preserves identities, edges, metadata and document links', () => {
  const graph = fixture(), result = renameObjectPlan(graph, { id: 'feature:a', title: '  Record wear  ', expectedTitle: 'Record usage' });
  assert.equal(result.graph.nodes[0].title, 'Record wear'); assert.deepEqual(result.graph.nodes[0].data, graph.nodes[0].data);
  assert.equal(result.graph.nodes[0].id, graph.nodes[0].id); assert.deepEqual(result.graph.documents, graph.documents);
  assert.equal(graph.nodes[0].title, 'Record usage');
});
test('no-op rename has no candidate change and stale rename is rejected', () => {
  const g = fixture(); assert.equal(renameObjectPlan(g, { id: 'feature:a', title: 'Record usage', expectedTitle: 'Record usage' }).graph, g);
  assert.throws(() => renameObjectPlan(g, { id: 'feature:a', title: 'Other', expectedTitle: 'Old name' }), /changed/);
});
test('finding existing objects handles duplicate titles and exposes bounded counts', () => {
  const g = fixture(); for (let i = 0; i < 150; i++) g.nodes.push({ id: `item:${i}`, title: 'Bottle', type: 'entity', region: 'domain' });
  const found = findObjects(g, ' bottle ', 'domain:b'); assert.equal(found.total, 150); assert.equal(found.nodes.length, 100);
  assert.equal(findObjects(g, 'item:149').nodes[0].id, 'item:149'); assert.equal(findObjects(g, 'zzz').total, 0);
});
test('existing object links do not remove objects outside the visible focus', () => {
  const g = fixture(), candidate = connectObjectsPlan(g, { from: 'feature:a', to: 'domain:b', kind: 'uses' }, ids()).graph;
  const focus = { scope: { ...projectScope(), id: 'focus', rootIds: ['feature:a'], depth: 0 }, view: 'overview', search: '', selectedId: 'feature:a' };
  assert.equal(projectView(candidate, focus).nodes.length, 1); assert.equal(candidate.nodes.length, 2); assert.equal(candidate.edges.length, 1);
});
test('placement preserves existing coordinates and avoids overlap of the new card', () => {
  const p = { a: { x: 160, y: 120, pinned: true }, b: { x: 480, y: 120, pinned: true } }, before = structuredClone(p);
  const out = nextObjectPosition(p, null, 'a'); assert.equal(out.x, 480); assert.equal(out.y, 260); assert.deepEqual(p, before);
});
test('pointer location is respected unless occupied; invalid locations fall back safely', () => {
  assert.deepEqual(nextObjectPosition({}, { x: -400, y: 320 }), { x: -400, y: 320, pinned: true });
  assert.equal(nextObjectPosition({}, { x: Infinity, y: NaN }).x, 160);
});
test('failed ID allocation never creates a partially mutated graph', () => {
  const g = fixture(), before = structuredClone(g); assert.throws(() => createObjectPlan(g, { choice: 'entity', title: 'Same' }, () => 'b'), /distinct/); assert.deepEqual(g, before);
});
