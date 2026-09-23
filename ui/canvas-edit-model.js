import { OBJECT_CHOICES, RELATION_CHOICES, cleanTitle, cleanRelation, object, planObject, planRelationship, planEdgeChange } from './authoring-model.js';
export { OBJECT_CHOICES, RELATION_CHOICES, cleanTitle, cleanRelation };
/** All UI paths share authoring rules. The host records ONE graph/layout Undo snapshot. */
export function prepareCanvasEdit(graph, edit, uuid = () => crypto.randomUUID()) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Open a product before editing.');
  if (!edit || typeof edit !== 'object') throw new Error('Choose an authoring action.');
  if (edit.action === 'rename') {
    const node = object(graph, edit.id), title = cleanTitle(edit.title);
    if (edit.expectedTitle !== node.title) throw new Error('This title changed while you were editing. Close and review it again.');
    if (title === node.title) return { graph, changed: false, selectedId: node.id };
    const candidate = structuredClone(graph); candidate.nodes.find(n => n.id === node.id).title = title;
    return { graph: candidate, changed: true, selectedId: node.id };
  }
  if (edit.action === 'connect') {
    const edge = planRelationship(graph, edit, `edge:${uuid()}`);
    const candidate = structuredClone(graph); candidate.edges.push(edge);
    return { graph: candidate, changed: true, selectedId: edit.from };
  }
  if (edit.action === 'create') {
    const plan = planObject(graph, { kind: edit.choice, title: edit.title, description: edit.description, rootId: edit.from, relation: edit.kind }, uuid());
    const candidate = structuredClone(graph); candidate.nodes.push(plan.node); if (plan.edge) candidate.edges.push(plan.edge);
    return { graph: candidate, changed: true, selectedId: plan.node.id, createdId: plan.node.id };
  }
  if (['update-edge', 'delete-edge'].includes(edit.action)) {
    const plan = planEdgeChange(graph, edit);
    const selectedId = graph.nodes.some(n => n.id === edit.selectedId) ? edit.selectedId : graph.nodes.find(n => n.id === edit.observed.value.from)?.id || null;
    if (!plan.changed) return { graph, changed: false, selectedId };
    const candidate = structuredClone(graph);
    if (plan.replacement) candidate.edges[plan.index] = plan.replacement; else candidate.edges.splice(plan.index, 1);
    return { graph: candidate, changed: true, selectedId };
  }
  throw new Error('Unsupported authoring action.');
}
const searchable = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
export function findConnectionTargets(graph, sourceId, query = '', limit = 80) {
  const text = searchable(query).trim();
  const matches = graph.nodes.filter(n => n.id !== sourceId && searchable(`${n.title} ${n.id} ${n.type} ${n.region}`).includes(text));
  matches.sort((a, b) => { const x = searchable(a.title), y = searchable(b.title); return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
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
