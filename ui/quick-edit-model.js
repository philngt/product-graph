/** Small, pure authoring plans for the existing working graph. Not an ontology or runner. */
export const OBJECT_CHOICES = Object.freeze([
  { id: 'feature', label: 'Feature', region: 'product', type: 'feature', hint: 'A useful capability of the product.' },
  { id: 'entity', label: 'Object', region: 'domain', type: 'entity', hint: 'Something the application manages.' },
  { id: 'workflow', label: 'Flow', region: 'workflow', type: 'workflow', hint: 'A user or system journey.' },
  { id: 'step', label: 'Step', region: 'workflow', type: 'step', hint: 'An action within a flow.' },
  { id: 'rule', label: 'Rule', region: 'domain', type: 'rule', hint: 'A condition the product must respect.' },
  { id: 'screen', label: 'Screen', region: 'experience', type: 'screen', hint: 'A place to see or do something.' },
  { id: 'module', label: 'Module', region: 'architecture', type: 'module', hint: 'An implementation responsibility.' },
  { id: 'plan', label: 'Plan', region: 'business', type: 'plan', hint: 'A product offering or access tier.' },
  { id: 'constraint', label: 'Constraint', region: 'intent', type: 'constraint', hint: 'A limit or requirement to preserve.' },
  { id: 'decision', label: 'Decision', region: 'decision', type: 'decision', hint: 'A choice and its rationale.' },
  { id: 'criterion', label: 'Acceptance', region: 'quality', type: 'acceptance-criterion', hint: 'An observable way to verify success.' },
]);
export const RELATION_CHOICES = Object.freeze([
  ['contains', 'contains'], ['supports', 'supports'], ['uses', 'uses'], ['reads', 'reads from'],
  ['writes', 'writes to'], ['constrains', 'constrains'], ['verified-by', 'is verified by'],
  ['implements', 'implements'], ['depends-on', 'depends on'], ['relates-to', 'relates to'],
]);
function title(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || value.includes('\0')) throw new Error('Enter a name of 1–200 characters.');
  return value.trim();
}
function kind(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9:._-]{0,79}$/.test(value)) throw new Error('Choose a relationship meaning, or enter a short lower-case relationship name.');
  return value;
}
function freshId(prefix, graph, uuid) {
  const id = `${prefix}:${uuid()}`;
  if (!/^[a-zA-Z0-9:._-]+$/.test(id) || graph.nodes.some(n => n.id === id) || graph.edges.some(e => e.id === id)) throw new Error('Could not allocate a distinct object ID. Try again.');
  return id;
}
function endpoint(graph, id) {
  const node = graph.nodes.find(n => n.id === id);
  if (!node) throw new Error('This object no longer exists. Close and choose the object again.');
  return node;
}
function relation(graph, from, to, meaning, uuid) {
  endpoint(graph, from); endpoint(graph, to);
  if (from === to) throw new Error('Choose two different objects. Existing self-links are preserved, but this quick editor does not create them.');
  const value = kind(meaning);
  if (graph.edges.some(e => e.from === from && e.to === to && e.kind === value)) throw new Error('That exact relationship already exists.');
  return { id: freshId('edge', graph, uuid), kind: value, from, to, data: { relationClass: 'semantic', executable: false } };
}
export function createObjectPlan(graph, input, uuid = () => crypto.randomUUID()) {
  const choice = OBJECT_CHOICES.find(c => c.id === input.choice);
  if (!choice) throw new Error('Choose what this object represents.');
  const name = title(input.title);
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 2000 || input.description.includes('\0'))) throw new Error('Description must be at most 2000 characters.');
  if (input.anchorId) endpoint(graph, input.anchorId);
  else if (input.kind) throw new Error('Choose an object to connect before choosing a relationship.');
  const node = { id: freshId(choice.region, graph, uuid), region: choice.region, type: choice.type, title: name, status: 'draft', data: input.description?.trim() ? { description: input.description.trim() } : {} };
  const nodes = [...graph.nodes, node];
  const candidate = { ...graph, nodes };
  let edge = null;
  if (input.anchorId) {
    if (!['outgoing', 'incoming'].includes(input.direction)) throw new Error('Choose the direction of the relationship.');
    edge = relation(candidate, input.direction === 'outgoing' ? input.anchorId : node.id, input.direction === 'outgoing' ? node.id : input.anchorId, input.kind, uuid);
  }
  return { graph: { ...graph, nodes, edges: edge ? [...graph.edges, edge] : [...graph.edges] }, selectedId: node.id, node, edge };
}
export function connectObjectsPlan(graph, input, uuid = () => crypto.randomUUID()) {
  const edge = relation(graph, input.from, input.to, input.kind, uuid);
  return { graph: { ...graph, nodes: [...graph.nodes], edges: [...graph.edges, edge] }, selectedId: input.from, edge };
}
export function renameObjectPlan(graph, input) {
  const node = endpoint(graph, input.id), name = title(input.title);
  if (node.title !== input.expectedTitle) throw new Error('The name changed while you were editing. Reopen Rename to review the current value.');
  if (node.title === name) return { graph, selectedId: node.id };
  return { graph: { ...graph, nodes: graph.nodes.map(n => n.id === node.id ? { ...n, title: name } : n) }, selectedId: node.id };
}
export function findObjects(graph, query = '', excludedId = null, limit = 100) {
  const needle = query.trim().toLocaleLowerCase();
  const found = graph.nodes.filter(n => n.id !== excludedId && `${n.title} ${n.type} ${n.region} ${n.id}`.toLocaleLowerCase().includes(needle));
  return { total: found.length, nodes: found.slice(0, limit) };
}
/** Place one new card without moving existing cards or attaching business meaning to geometry. */
export function nextObjectPosition(positions, preferred, anchorId) {
  const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const anchor = positions[anchorId];
  const start = valid(preferred) ? preferred : valid(anchor) ? { x: anchor.x + 320, y: anchor.y } : { x: 160, y: 120 };
  const point = { x: start.x, y: start.y, pinned: true };
  const others = Object.values(positions).filter(valid);
  for (let i = 0; i <= others.length && others.some(p => Math.abs(p.x - point.x) < 252 && Math.abs(p.y - point.y) < 120); i++) point.y += 140;
  return point;
}
