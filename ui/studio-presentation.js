/** Presentation and compatibility exports. Semantic plans have one shared owner. */
export { OBJECT_KINDS, RELATIONS, planRelationship, planObject } from './authoring-model.js';
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
