/** Small, pure authoring plans. These are UI choices, not a new ontology or runner. */
export const OBJECT_CHOICES = Object.freeze([
  { key: 'feature', label: 'Feature — a capability', region: 'product', type: 'feature' },
  { key: 'step', label: 'Workflow step', region: 'workflow', type: 'step' },
  { key: 'entity', label: 'Entity — something the app manages', region: 'domain', type: 'entity' },
  { key: 'rule', label: 'Business rule', region: 'domain', type: 'rule' },
  { key: 'screen', label: 'Screen / experience', region: 'experience', type: 'screen' },
  { key: 'service', label: 'Service / module', region: 'architecture', type: 'service' },
  { key: 'constraint', label: 'Project constraint', region: 'intent', type: 'constraint' },
  { key: 'decision', label: 'Decision', region: 'decision', type: 'decision' },
  { key: 'criterion', label: 'Acceptance criterion', region: 'quality', type: 'acceptance-criterion' },
  { key: 'plan', label: 'Business plan', region: 'business', type: 'plan' },
]);
export const RELATION_CHOICES = Object.freeze([
  ['relates-to', 'Is related to'], ['contains', 'Contains'], ['supports', 'Supports'],
  ['reads', 'Reads information from'], ['writes', 'Updates data in'],
  ['constrains', 'Constrains'], ['verified-by', 'Is verified by'],
  ['implements', 'Implements'], ['precedes', 'Comes before (descriptive order)'],
]);
export function cleanTitle(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Enter a title of 1–200 characters on one line.');
  return value.trim();
}
export function cleanRelation(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9:_-]{0,79}$/.test(value)) throw new Error('Choose a relationship, or enter a custom kind using lowercase letters, numbers, colon, underscore or hyphen.');
  return value;
}
function object(graph, id) {
  const node = graph.nodes.find(n => n.id === id);
  if (!node) throw new Error('That object is no longer in this product. Close and choose an existing object.');
  return node;
}
function uniqueId(graph, id) {
  if (typeof id !== 'string' || !id || graph.nodes.some(n => n.id === id) || graph.edges.some(e => e.id === id) || graph.documents?.some(d => d.id === id)) throw new Error('Generated identity already exists. Try again.');
  return id;
}
function relationship(graph, from, to, kind, uuid) {
  object(graph, from); object(graph, to); cleanRelation(kind);
  if (from === to) throw new Error('Choose a different object. Self-relations are not created by this tool.');
  if (graph.edges.some(e => e.from === from && e.to === to && e.kind === kind)) throw new Error('This relationship already exists. Choose a different meaning or cancel.');
  return { id: uniqueId(graph, `edge:${uuid()}`), from, to, kind, data: { relationClass: 'semantic', executable: false } };
}
/** Validate before cloning/mutating. The host records ONE graph/layout Undo snapshot. */
export function prepareCanvasEdit(graph, edit, uuid = () => crypto.randomUUID()) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Open a product before editing.');
  if (!edit || typeof edit !== 'object') throw new Error('Choose an authoring action.');
  if (edit.action === 'rename') {
    const node = object(graph, edit.id), title = cleanTitle(edit.title);
    if (edit.expectedTitle !== node.title) throw new Error('This title changed while you were editing. Close and review it again.');
    if (title === node.title) return { graph, changed: false, selectedId: node.id };
    const candidate = structuredClone(graph);
    candidate.nodes.find(n => n.id === node.id).title = title;
    return { graph: candidate, changed: true, selectedId: node.id };
  }
  if (edit.action === 'connect') {
    const edge = relationship(graph, edit.from, edit.to, edit.kind, uuid);
    const candidate = structuredClone(graph); candidate.edges.push(edge);
    return { graph: candidate, changed: true, selectedId: edit.from };
  }
  if (edit.action === 'create') {
    const choice = OBJECT_CHOICES.find(c => c.key === edit.choice);
    if (!choice) throw new Error('Choose what this object represents.');
    const title = cleanTitle(edit.title);
    if (edit.from) { object(graph, edit.from); cleanRelation(edit.kind); }
    const id = uniqueId(graph, `${choice.region}:${uuid()}`);
    const node = { id, title, type: choice.type, region: choice.region, status: 'draft', data: {} };
    const candidate = structuredClone(graph); candidate.nodes.push(node);
    if (edit.from) candidate.edges.push(relationship(candidate, edit.from, id, edit.kind, uuid));
    return { graph: candidate, changed: true, selectedId: id, createdId: id };
  }
  throw new Error('Unsupported authoring action.');
}
const searchable = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function findConnectionTargets(graph, sourceId, query = '', limit = 80) {
  const text = searchable(query).trim();
  const matches = graph.nodes.filter(n => n.id !== sourceId && searchable(`${n.title} ${n.type} ${n.region}`).includes(text));
  matches.sort((a, b) => {
    const x = searchable(a.title), y = searchable(b.title);
    return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { nodes: matches.slice(0, Math.max(1, Math.min(200, limit))), total: matches.length };
}
/** View coordinates only. Occupied nodes are preserved; search is deterministic/bounded. */
export function nearbyPosition(preferred, positions, card = { width: 220, height: 88 }) {
  if (!preferred || !Number.isFinite(preferred.x) || !Number.isFinite(preferred.y)) throw new Error('Canvas position is unavailable.');
  const occupied = Object.values(positions).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const point = { x: preferred.x, y: preferred.y, pinned: true };
  for (let i = 0; i <= occupied.length; i++) {
    if (!occupied.some(p => Math.abs(p.x - point.x) < card.width + 32 && Math.abs(p.y - point.y) < card.height + 32)) return point;
    point.y += card.height + 48;
  }
  return point;
}
