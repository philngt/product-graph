/** Pure presentation helpers. Never write graph data, advance revisions, or infer meaning. */
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);

export function searchObjects(nodes, query, limit = 30) {
  const needle = fold(query).trim(), words = needle.split(/\s+/).filter(Boolean);
  return nodes.filter(n => words.every(w => fold(`${n.id} ${n.title} ${n.type} ${n.region}`).includes(w)))
    .map((node, index) => ({ node, index, rank: !needle ? 3 : fold(node.id) === needle || fold(node.title) === needle ? 0 : fold(node.title).startsWith(needle) ? 1 : 2 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, Math.max(0, limit)).map(item => item.node);
}

/** Changes of an edge's kind/endpoints/data are shown, not only ID additions/removals. */
export function workingChanges(base, candidate) {
  if (!base || !candidate) return [];
  const rows = [];
  const groups = [['object', 'nodes'], ['relationship', 'edges'], ['document', 'documents']];
  for (const [category, field] of groups) {
    const key = item => item.id || `${item.from}:${item.kind}:${item.to}`;
    const before = new Map((base[field] || []).map(item => [key(item), item]));
    const after = new Map((candidate[field] || []).map(item => [key(item), item]));
    for (const [id, item] of after) {
      const old = before.get(id);
      if (!old || stable(old) !== stable(item)) rows.push({ category, id, kind: old ? 'changed' : 'added', before: old ?? null, after: item });
    }
    for (const [id, item] of before) if (!after.has(id)) rows.push({ category, id, kind: 'removed', before: item, after: null });
  }
  if (stable(base.manifest) !== stable(candidate.manifest)) rows.push({ category: 'project', id: candidate.manifest?.projectId || 'project', kind: 'changed', before: base.manifest, after: candidate.manifest });
  return rows;
}

export const OBJECT_KINDS = Object.freeze({
  feature: { region: 'product', type: 'feature', label: 'Feature', help: 'A capability that delivers value.' },
  entity: { region: 'domain', type: 'entity', label: 'Object / entity', help: 'Something the product manages.' },
  step: { region: 'workflow', type: 'step', label: 'Workflow step', help: 'An action in a product journey.' },
  rule: { region: 'domain', type: 'rule', label: 'Rule', help: 'A condition or business policy.' },
  screen: { region: 'experience', type: 'screen', label: 'Screen', help: 'A place where people interact.' },
  constraint: { region: 'intent', type: 'constraint', label: 'Constraint', help: 'A boundary the product must respect.' },
  decision: { region: 'decision', type: 'decision', label: 'Decision', help: 'A choice and its rationale.' },
  criterion: { region: 'quality', type: 'acceptance-criterion', label: 'Acceptance criterion', help: 'An observable way to check success.' },
});
export const RELATIONS = ['contains', 'supports', 'reads', 'writes', 'constrains', 'verified-by', 'implements', 'relates-to'];
function boundedText(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new Error(`${label} needs 1–${max} characters.`);
  return value.trim();
}
export function planRelationship(graph, { from, to, kind }, edgeId) {
  if (!graph.nodes.some(n => n.id === from) || !graph.nodes.some(n => n.id === to)) throw new Error('Choose objects that still exist in this project.');
  const relation = boundedText(kind, 'Relationship', 80);
  if (graph.edges.some(e => e.from === from && e.to === to && e.kind === relation)) throw new Error('This relationship already exists.');
  if (!edgeId || graph.edges.some(e => e.id === edgeId)) throw new Error('Relationship identity is not unique.');
  return { id: edgeId, from, to, kind: relation, data: { relationClass: 'semantic', executable: false } };
}
export function planObject(graph, input, uniqueId) {
  const def = Object.hasOwn(OBJECT_KINDS, input.kind) ? OBJECT_KINDS[input.kind] : null;
  if (!def) throw new Error('Choose the kind of object you are defining.');
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(uniqueId)) throw new Error('Invalid object identity.');
  const title = boundedText(input.title, 'Object name', 200);
  const description = input.description || '';
  if (typeof description !== 'string' || description.length > 4000 || description.includes('\0')) throw new Error('Description must be at most 4,000 characters.');
  const node = { id: `${def.region}:${uniqueId}`, region: def.region, type: def.type, title, status: 'draft', data: description.trim() ? { description: description.trim() } : {} };
  if (graph.nodes.some(n => n.id === node.id)) throw new Error('An object with this identity already exists.');
  const edge = input.rootId ? planRelationship({ ...graph, nodes: [...graph.nodes, node] }, { from: input.rootId, to: node.id, kind: input.relation }, `edge:${uniqueId}`) : null;
  return { node, edge };
}

/** Two bounded lines for SVG cards; full text stays in the accessible name and inspector. */
export function cardTitle(title, width = 26) {
  const chars = Array.from(String(title));
  if (chars.length <= width) return [chars.join('')];
  let at = chars.slice(0, width + 1).lastIndexOf(' ');
  if (at < width / 3) at = width;
  const rest = chars.slice(at).join('').trim();
  return [chars.slice(0, at).join(''), Array.from(rest).length > width ? Array.from(rest).slice(0, width - 1).join('') + '…' : rest];
}

export function definitionFacts(definition) {
  const d = definition && typeof definition === 'object' && !Array.isArray(definition) ? definition : {};
  const values = value => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter(item => typeof item === 'string').slice(0, 8);
  return { structure: values(d.structure), tradeoffs: values(d.tradeoffs ?? d.tradeOffs), capabilities: values(d.capabilities), target: typeof d.target === 'string' ? d.target : '' };
}
