/** One semantic authoring contract for canvas, editorial forms and keyboard adapters.
 * Pure plans only: no persistence, inferred relations or executable workflow actions.
 */
export const OBJECT_KINDS = Object.freeze({
  feature: { region: 'product', type: 'feature', label: 'Feature', help: 'A capability that delivers value.' },
  entity: { region: 'domain', type: 'entity', label: 'Object / entity', help: 'Something the product manages.' },
  flow: { region: 'workflow', type: 'workflow', label: 'Workflow', help: 'An intended journey, not an executable program.' },
  step: { region: 'workflow', type: 'step', label: 'Workflow step', help: 'An action in a product journey.' },
  rule: { region: 'domain', type: 'rule', label: 'Rule', help: 'A condition or business policy.' },
  screen: { region: 'experience', type: 'screen', label: 'Screen', help: 'A place where people interact.' },
  service: { region: 'architecture', type: 'service', label: 'Service / module', help: 'An implementation responsibility.' },
  plan: { region: 'business', type: 'plan', label: 'Business plan', help: 'An offering; not an implemented paywall.' },
  constraint: { region: 'intent', type: 'constraint', label: 'Constraint', help: 'A boundary the product must respect.' },
  decision: { region: 'decision', type: 'decision', label: 'Decision', help: 'A choice and its rationale.' },
  criterion: { region: 'quality', type: 'acceptance-criterion', label: 'Acceptance criterion', help: 'An observable way to check success.' },
});
export const RELATION_CHOICES = Object.freeze([
  ['relates-to', 'Is related to'], ['contains', 'Contains'], ['supports', 'Supports'],
  ['reads', 'Reads information from'], ['writes', 'Updates data in'], ['constrains', 'Constrains'],
  ['verified-by', 'Is verified by'], ['implements', 'Implements'], ['precedes', 'Comes before (descriptive only)'],
]);
export const RELATIONS = Object.freeze(RELATION_CHOICES.map(([kind]) => kind));
export const OBJECT_CHOICES = Object.freeze(Object.entries(OBJECT_KINDS).map(([key, value]) => ({ key, ...value })));
export const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
export function cleanTitle(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Enter a title of 1–200 characters on one line.');
  return value.trim();
}
export function cleanRelation(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9:_-]{0,79}$/.test(value)) throw new Error('Choose a relationship or a lowercase kind using letters, numbers, colon, underscore or hyphen.');
  return value;
}
export function object(graph, id) {
  const node = graph.nodes.find(n => n.id === id);
  if (!node) throw new Error('That object is no longer in this product. Close and choose an existing object.');
  return node;
}
export function uniqueId(graph, id) {
  if (typeof id !== 'string' || !id || graph.nodes.some(n => n.id === id) || graph.edges.some(e => e.id === id) || graph.documents?.some(d => d.id === id)) throw new Error('Generated identity already exists. Try again.');
  return id;
}
export function planRelationship(graph, { from, to, kind }, edgeId) {
  object(graph, from); object(graph, to); const relation = cleanRelation(kind);
  if (from === to) throw new Error('Choose a different object. Existing self-relations are retained, but this tool does not create new ones.');
  if (graph.edges.some(e => e.from === from && e.to === to && e.kind === relation)) throw new Error('This relationship already exists.');
  return { id: uniqueId(graph, edgeId), from, to, kind: relation, data: { relationClass: 'semantic', executable: false } };
}
export function planObject(graph, input, unique) {
  const def = Object.hasOwn(OBJECT_KINDS, input.kind) ? OBJECT_KINDS[input.kind] : null;
  if (!def) throw new Error('Choose the kind of object you are defining.');
  if (typeof unique !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(unique)) throw new Error('Invalid object identity.');
  const title = cleanTitle(input.title), description = input.description ?? '';
  if (typeof description !== 'string' || description.length > 4000 || description.includes('\0')) throw new Error('Description must be at most 4,000 characters.');
  const node = { id: uniqueId(graph, `${def.region}:${unique}`), region: def.region, type: def.type, title, status: 'draft', data: description.trim() ? { description: description.trim() } : {} };
  const edge = input.rootId ? planRelationship({ ...graph, nodes: [...graph.nodes, node] }, { from: input.rootId, to: node.id, kind: input.relation }, `edge:${unique}`) : null;
  return { node, edge };
}
/** Bind an editor to a full observed edge; ID alone does not authorize overwriting newer data. */
export function observedEdge(graph, index) {
  if (!Number.isInteger(index) || !graph.edges[index]) throw new Error('Relationship is missing.');
  return { index, value: structuredClone(graph.edges[index]) };
}
export function planEdgeChange(graph, edit) {
  const ref = edit.observed;
  if (!ref || !Number.isInteger(ref.index) || !ref.value) throw new Error('Reopen the relationship to edit.');
  const matches = ref.value.id ? graph.edges.map((edge, i) => edge.id === ref.value.id ? i : -1).filter(i => i >= 0) : [ref.index];
  if (matches.length !== 1 || !graph.edges[matches[0]] || stable(graph.edges[matches[0]]) !== stable(ref.value)) throw new Error('Relationship changed after opening. Close and review it again.');
  const index = matches[0], current = graph.edges[index];
  if (edit.action === 'delete-edge') return { index, replacement: null, changed: true };
  object(graph, current.from); object(graph, edit.to);
  if (edit.to === current.to && edit.kind === current.kind) return { index, replacement: current, changed: false };
  const kind = cleanRelation(edit.kind);
  if (current.from === edit.to && current.from !== current.to) throw new Error('Choose a different object; no new self-relation.');
  if (graph.edges.some((edge, i) => i !== index && edge.from === current.from && edge.to === edit.to && edge.kind === kind)) throw new Error('This relationship already exists.');
  return { index, replacement: { ...structuredClone(current), to: edit.to, kind }, changed: true };
}
