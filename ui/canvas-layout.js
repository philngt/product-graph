/** Presentation geometry only. Never changes graph nodes, edges or semantic ownership.
 * Inspired by Design Studio AI's bounded layout / pinned-node separation (see THIRD_PARTY_NOTICES).
 * This intentionally does not import its Board model, renderer, or Dagre dependency.
 */
export const CARD = Object.freeze({ width: 220, height: 88 });
const order = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const validPosition = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Deterministic breadth-first columns. Cycles are exploration links, not invalid models. */
export function arrangeGraph(nodes, edges, { mode = 'layered', positions = {}, preserveAll = false } = {}) {
  const sorted = [...nodes].sort(order);
  const ids = new Set(sorted.map(n => n.id));
  const links = new Map(sorted.map(n => [n.id, new Set()]));
  const inbound = new Set();
  for (const edge of edges) if (ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to) {
    links.get(edge.from).add(edge.to); inbound.add(edge.to);
  }
  const levels = new Map();
  const visit = (roots) => {
    const queue = roots.map(id => [id, 0]);
    for (let index = 0; index < queue.length; index++) {
      const [id, depth] = queue[index];
      if (levels.has(id)) continue;
      levels.set(id, depth);
      for (const next of [...links.get(id)].sort()) if (!levels.has(next)) queue.push([next, depth + 1]);
    }
  };
  visit(sorted.filter(n => !inbound.has(n.id)).map(n => n.id));
  // A component made entirely of cycles has no zero-indegree root.
  for (const node of sorted) if (!levels.has(node.id)) visit([node.id]);
  const result = Object.create(null);
  const placed = [];
  for (const node of sorted) {
    const p = positions[node.id];
    if (validPosition(p) && (preserveAll || p.pinned)) {
      result[node.id] = { ...p }; placed.push(result[node.id]);
    }
  }
  const rows = new Map();
  const overlaps = (a, b) => Math.abs(a.x - b.x) < CARD.width + 32 && Math.abs(a.y - b.y) < CARD.height + 32;
  sorted.forEach((node, index) => {
    if (Object.hasOwn(result, node.id)) return;
    const column = mode === 'grid' ? index % 3 : levels.get(node.id);
    const row = mode === 'grid' ? Math.floor(index / 3) : (rows.get(column) || 0);
    rows.set(column, row + 1);
    const p = { x: 160 + column * 340, y: 120 + row * 172, pinned: false };
    // Each collision moves at least one full card; bounded by the number already placed.
    for (let tries = 0; tries <= placed.length && placed.some(other => overlaps(p, other)); tries++) p.y += 172;
    result[node.id] = p; placed.push(p);
  });
  return result;
}

export function graphBounds(positions) {
  const points = Object.values(positions).filter(validPosition);
  if (!points.length) return { x: 0, y: 0, width: 900, height: 560 };
  const left = Math.min(...points.map(p => p.x - CARD.width / 2)) - 80;
  const top = Math.min(...points.map(p => p.y - CARD.height / 2)) - 80;
  const right = Math.max(...points.map(p => p.x + CARD.width / 2)) + 80;
  const bottom = Math.max(...points.map(p => p.y + CARD.height / 2)) + 80;
  return { x: left, y: top, width: Math.max(420, right - left), height: Math.max(320, bottom - top) };
}

/** Endpoints touch card borders. Curves are not advertised as obstacle-free routing. */
export function connectorGeometry(a, b, self = false, lane = 0) {
  if (self) {
    const x = a.x + CARD.width / 2, y = a.y, reach = 70 + lane * 22;
    return { path: `M ${x} ${y - 22} C ${x + reach} ${y - 110}, ${x + reach} ${y + 110}, ${x} ${y + 22}`, label: { x: x + reach * .75, y } };
  }
  const dx = b.x - a.x, dy = b.y - a.y;
  const horizontal = Math.abs(dx) / CARD.width >= Math.abs(dy) / CARD.height;
  const sign = (horizontal ? dx : dy) >= 0 ? 1 : -1;
  const start = horizontal ? { x: a.x + sign * CARD.width / 2, y: a.y } : { x: a.x, y: a.y + sign * CARD.height / 2 };
  const end = horizontal ? { x: b.x - sign * CARD.width / 2, y: b.y } : { x: b.x, y: b.y - sign * CARD.height / 2 };
  const reach = Math.max(48, Math.abs(horizontal ? end.x - start.x : end.y - start.y) / 2);
  const offset = lane * 26;
  const c = horizontal ? { x: start.x + sign * reach, y: start.y + offset } : { x: start.x + offset, y: start.y + sign * reach };
  const d = horizontal ? { x: end.x - sign * reach, y: end.y + offset } : { x: end.x + offset, y: end.y - sign * reach };
  return {
    path: `M ${start.x} ${start.y} C ${c.x} ${c.y}, ${d.x} ${d.y}, ${end.x} ${end.y}`,
    label: { x: (start.x + 3 * c.x + 3 * d.x + end.x) / 8, y: (start.y + 3 * c.y + 3 * d.y + end.y) / 8 },
  };
}

export function zoomCamera(camera, factor) {
  const width = Math.max(180, Math.min(50000, camera.width * factor));
  const height = camera.height * width / camera.width;
  return { x: camera.x + (camera.width - width) / 2, y: camera.y + (camera.height - height) / 2, width, height };
}
