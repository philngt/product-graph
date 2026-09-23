import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJECT_KINDS, OBJECT_CHOICES, RELATIONS, RELATION_CHOICES, planObject, planRelationship, observedEdge, planEdgeChange } from '../ui/authoring-model.js';
import * as editorial from '../ui/studio-presentation.js';
import { prepareCanvasEdit, findConnectionTargets, nearbyPosition } from '../ui/canvas-edit-model.js';
const graph = () => ({ manifest: { projectId: 'demo' }, nodes: [
  { id: 'feature:a', title: 'Record usage', region: 'product', type: 'feature', data: { shared: true }, document: 'doc:a' },
  { id: 'domain:b', title: 'Bottle', region: 'domain', type: 'entity' },
  { id: 'domain:c', title: 'Collection', region: 'domain', type: 'entity' },
], edges: [{ id: 'edge:r', from: 'feature:a', to: 'domain:b', kind: 'reads', data: { provenance: 'human' } }], documents: [{ id: 'doc:a', path: 'documents/brief.md', links: ['feature:a'] }] });

test('editorial and direct entry points share the identical semantic plan functions', () => {
  assert.equal(editorial.planObject, planObject); assert.equal(editorial.planRelationship, planRelationship);
  assert.equal(editorial.OBJECT_KINDS, OBJECT_KINDS); assert.equal(editorial.RELATIONS, RELATIONS);
  assert.deepEqual(OBJECT_CHOICES.map(c => c.key), Object.keys(OBJECT_KINDS));
  assert.deepEqual(RELATION_CHOICES.map(([k]) => k), RELATIONS);
});
for (const c of OBJECT_CHOICES) test(`same meaning through both object creation paths: ${c.key}`, () => {
  const g = graph(), before = structuredClone(g);
  const direct = prepareCanvasEdit(g, { action: 'create', choice: c.key, title: 'New definition', from: 'feature:a', kind: 'contains' }, () => 'id');
  const form = planObject(g, { kind: c.key, title: 'New definition', rootId: 'feature:a', relation: 'contains' }, 'id');
  assert.deepEqual(direct.graph.nodes.at(-1), form.node); assert.deepEqual(direct.graph.edges.at(-1), form.edge);
  assert.equal(form.node.status, 'draft'); assert.equal(form.edge.data.executable, false); assert.deepEqual(g, before);
});
test('no inferred relationship or platform for standalone creation', () => {
  const result = prepareCanvasEdit(graph(), { action: 'create', choice: 'flow', title: 'Workflow' }, () => 'id');
  assert.equal(result.graph.edges.length, 1); assert.deepEqual(result.graph.nodes.at(-1).data, {});
});
test('both creation paths reject invalid titles and semantic kinds', () => {
  for (const title of ['', ' ', 'a\nb', 'x\0y', 'x'.repeat(201)]) {
    assert.throws(() => planObject(graph(), { kind: 'entity', title }, 'id'));
    assert.throws(() => prepareCanvasEdit(graph(), { action: 'create', choice: 'entity', title }, () => 'id'));
  }
  for (const kind of ['', 'Has Space', '<script>', 'a'.repeat(81)]) {
    assert.throws(() => planRelationship(graph(), { from: 'domain:b', to: 'domain:c', kind }, 'edge:new'));
    assert.throws(() => prepareCanvasEdit(graph(), { action: 'connect', from: 'domain:b', to: 'domain:c', kind }, () => 'new'));
  }
});
test('both paths reject self links, duplicate relationships and missing objects', () => {
  for (const input of [{ from: 'feature:a', to: 'feature:a', kind: 'reads' }, { from: 'feature:a', to: 'domain:b', kind: 'reads' }, { from: 'other-project:x', to: 'domain:b', kind: 'reads' }]) {
    assert.throws(() => planRelationship(graph(), input, 'edge:new')); assert.throws(() => prepareCanvasEdit(graph(), { action: 'connect', ...input }, () => 'new'));
  }
});
test('cross-record identity collisions do not partially mutate graph', () => {
  const g = graph(), before = structuredClone(g);
  assert.throws(() => planRelationship(g, { from: 'domain:c', to: 'domain:b', kind: 'reads' }, 'doc:a'));
  assert.throws(() => planObject(g, { kind: 'entity', title: 'Duplicate' }, 'b'));
  assert.deepEqual(g, before);
});
test('rename preserves sources and no-op does not create an edit', () => {
  const g = graph(), p = prepareCanvasEdit(g, { action: 'rename', id: 'feature:a', expectedTitle: 'Record usage', title: 'Đồ thị ✦' });
  assert.deepEqual(p.graph.nodes[0].data, g.nodes[0].data); assert.deepEqual(p.graph.documents, g.documents); assert.deepEqual(p.graph.edges, g.edges);
  assert.equal(p.graph.nodes[0].id, g.nodes[0].id); assert.notEqual(p.graph.nodes[0].title, g.nodes[0].title);
  assert.equal(prepareCanvasEdit(g, { action: 'rename', id: 'feature:a', expectedTitle: 'Record usage', title: ' Record usage ' }).changed, false);
  assert.throws(() => prepareCanvasEdit(g, { action: 'rename', id: 'feature:a', expectedTitle: 'old', title: 'New' }), /changed/);
});
test('relationship edit preserves ID, metadata and source objects', () => {
  const g = graph(), before = structuredClone(g), observed = observedEdge(g, 0);
  const result = prepareCanvasEdit(g, { action: 'update-edge', observed, to: 'domain:c', kind: 'writes', selectedId: 'domain:b' });
  assert.equal(result.graph.edges[0].id, 'edge:r'); assert.deepEqual(result.graph.edges[0].data, { provenance: 'human' });
  assert.equal(result.graph.edges[0].to, 'domain:c'); assert.equal(result.graph.edges[0].kind, 'writes'); assert.deepEqual(result.graph.nodes, g.nodes);
  assert.equal(result.selectedId, 'domain:b'); assert.deepEqual(g, before);
  assert.equal(editorial.workingChanges(g, result.graph)[0].category, 'relationship');
});
test('unchanged legacy relationship remains a no-op without forced migration', () => {
  const g = graph(); g.edges[0].kind = 'Legacy kind'; delete g.edges[0].id;
  const p = prepareCanvasEdit(g, { action: 'update-edge', observed: observedEdge(g, 0), to: 'domain:b', kind: 'Legacy kind' });
  assert.equal(p.graph, g); assert.equal(p.changed, false);
});
test('new invalid relationships cannot be smuggled through update', () => {
  const g = graph(), observed = observedEdge(g, 0);
  for (const input of [{ to: 'feature:a', kind: 'reads' }, { to: 'missing', kind: 'reads' }, { to: 'domain:b', kind: '<script>' }]) assert.throws(() => prepareCanvasEdit(g, { action: 'update-edge', observed, ...input }));
  g.edges.push({ id: 'edge:other', from: 'feature:a', to: 'domain:c', kind: 'writes' });
  assert.throws(() => prepareCanvasEdit(g, { action: 'update-edge', observed, to: 'domain:c', kind: 'writes' }), /already exists/);
});
test('observed content rejects newer metadata even when edge ID is unchanged', () => {
  const g = graph(), observed = observedEdge(g, 0); g.edges[0].data.provenance = 'changed';
  for (const action of ['delete-edge', 'update-edge']) assert.throws(() => prepareCanvasEdit(g, { action, observed, to: 'domain:c', kind: 'writes' }), /changed/);
});
test('edge reorder is safe with an ID and refused without a stable match', () => {
  const g = graph(), observed = observedEdge(g, 0);
  g.edges.unshift({ id: 'edge:new', from: 'domain:c', to: 'domain:b', kind: 'supports' });
  assert.equal(planEdgeChange(g, { action: 'delete-edge', observed }).index, 1);
  const legacy = graph(); delete legacy.edges[0].id; const ref = observedEdge(legacy, 0);
  legacy.edges.unshift({ from: 'domain:c', to: 'domain:b', kind: 'supports' });
  assert.throws(() => planEdgeChange(legacy, { action: 'delete-edge', observed: ref }), /changed/);
});
test('duplicate edge IDs fail closed and deletion never deletes objects or documents', () => {
  const g = graph(), observed = observedEdge(g, 0), result = prepareCanvasEdit(g, { action: 'delete-edge', observed });
  assert.equal(result.graph.edges.length, 0); assert.deepEqual(result.graph.nodes, g.nodes); assert.deepEqual(result.graph.documents, g.documents);
  g.edges.push(structuredClone(g.edges[0])); assert.throws(() => planEdgeChange(g, { action: 'delete-edge', observed }), /changed/);
});
test('existing self link can retain its endpoints, but new self-links remain blocked', () => {
  const g = graph(); g.edges[0].to = 'feature:a';
  const p = prepareCanvasEdit(g, { action: 'update-edge', observed: observedEdge(g, 0), to: 'feature:a', kind: 'relates-to' });
  assert.equal(p.graph.edges[0].to, 'feature:a');
});
test('project name lookup supports IDs and Vietnamese letters, not only titles', () => {
  const g = graph(); g.nodes[1].title = 'Đồ dùng'; const before = structuredClone(g);
  assert.equal(findConnectionTargets(g, 'feature:a', 'do dung').nodes[0].id, 'domain:b');
  assert.equal(findConnectionTargets(g, 'feature:a', 'domain:c').nodes[0].id, 'domain:c');
  assert.equal(findConnectionTargets(g, 'feature:a', 'Record usage').nodes.length, 0); assert.deepEqual(g, before);
});
test('placement retains occupied positions and pin flags', () => {
  const positions = { a: { x: 100, y: 100, pinned: false } }, before = structuredClone(positions);
  const point = nearbyPosition({ x: 100, y: 100 }, positions); assert.ok(point.y > 100); assert.equal(point.pinned, true); assert.deepEqual(positions, before);
});
test('unrecognized actions and types never report success', () => {
  for (const action of ['execute', '', null]) assert.throws(() => prepareCanvasEdit(graph(), { action }));
  assert.throws(() => planObject(graph(), { kind: '__proto__', title: 'Invalid' }, 'id'));
});
