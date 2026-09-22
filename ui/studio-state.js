/** View state is not product data. Navigation must never mutate the graph or edit history. */
export const projectScope = () => ({ id: "project", title: "Entire project", rootIds: [], depth: 2 });

export const lensRegions = {
  overview: null,
  product: ["intent", "product", "quality"],
  business: ["business", "intent", "product"],
  workflow: ["workflow", "product", "business"],
  domain: ["domain", "business", "workflow"],
  experience: ["experience", "workflow", "domain", "product"],
  architecture: ["architecture", "domain", "experience", "quality"],
  verification: ["quality", "decision", "product"],
  decisions: ["decision"],
  impact: null,
};

export function regionOf(node) {
  return node.region || ({ document: "experience", roadmap: "product" }[node.layer] || node.layer || "product");
}

export function navigationSnapshot(state) {
  return {
    scope: { ...state.scope, rootIds: [...state.scope.rootIds] },
    view: state.view,
    selectedId: state.selectedId,
    search: state.search,
  };
}

/** Apply a navigation transition. Plain selection changes intentionally do not call this. */
export function navigate(state, patch) {
  const previous = navigationSnapshot(state);
  const next = navigationSnapshot({ ...state, ...patch });
  if (JSON.stringify(previous) === JSON.stringify(next)) return false;
  state.scopeBack.push(previous);
  if (state.scopeBack.length > 100) state.scopeBack.shift();
  state.scopeForward = [];
  Object.assign(state, next);
  return true;
}

export function travel(state, direction) {
  const source = direction === "back" ? state.scopeBack : state.scopeForward;
  const destination = direction === "back" ? state.scopeForward : state.scopeBack;
  const next = source.pop();
  if (!next) return false;
  destination.push(navigationSnapshot(state));
  Object.assign(state, navigationSnapshot(next));
  return true;
}

/** Undirected neighborhood for exploration, not an execution plan or causal impact proof. */
export function neighborhood(graph, roots, depth) {
  const ids = new Set(graph.nodes.map((node) => node.id));
  const seen = new Set(roots.filter((id) => ids.has(id)));
  const adjacency = new Map();
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }
  let frontier = [...seen];
  const limit = Number.isFinite(depth) ? Math.max(0, Math.min(8, Math.floor(depth))) : 2;
  for (let hop = 0; hop < limit && frontier.length; hop += 1) {
    const next = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) || []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return seen;
}

/** All projections read the same graph. Missing focus roots must not reveal the whole project. */
export function projectView(graph, state) {
  const scopeIds = state.scope.id === "project"
    ? new Set(graph.nodes.map((node) => node.id))
    : neighborhood(graph, state.scope.rootIds, state.scope.depth);
  const scoped = graph.nodes.filter((node) => scopeIds.has(node.id));
  const allowed = lensRegions[state.view];
  const lensNodes = scoped.filter((node) =>
    (!allowed || allowed.includes(regionOf(node))) &&
    (state.view !== "impact" || !state.scope.rootIds.includes(node.id)));
  const query = state.search.trim().toLowerCase();
  const nodes = lensNodes.filter((node) => `${node.id} ${node.title} ${node.type}`.toLowerCase().includes(query));
  const visibleIds = new Set(nodes.map((node) => node.id));
  const graphIds = new Set(graph.nodes.map((node) => node.id));
  const boundaryEdges = graph.edges.filter((edge) => graphIds.has(edge.from) && graphIds.has(edge.to) && scopeIds.has(edge.from) !== scopeIds.has(edge.to));
  let selectionVisibility = "none";
  if (state.selectedId) {
    if (!graphIds.has(state.selectedId)) selectionVisibility = "missing";
    else if (!scopeIds.has(state.selectedId)) selectionVisibility = "outside-scope";
    else if (!lensNodes.some((node) => node.id === state.selectedId)) selectionVisibility = "hidden-by-lens";
    else if (!visibleIds.has(state.selectedId)) selectionVisibility = "hidden-by-search";
    else selectionVisibility = "visible";
  }
  return {
    nodes,
    edges: graph.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
    scopeIds,
    scopeNodeCount: scoped.length,
    hiddenByLens: scoped.length - lensNodes.length,
    hiddenBySearch: lensNodes.length - nodes.length,
    boundaryEdges,
    selectionVisibility,
    missingRoots: state.scope.rootIds.filter((id) => !graphIds.has(id)),
  };
}
