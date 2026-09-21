import type { FocusQuery, Graph } from "./types.ts";

export function selectSubgraph(graph: Graph, query: FocusQuery): Graph {
  const roots = new Set(query.rootIds);
  const selected = new Set(query.rootIds);
  let frontier = new Set(query.rootIds);
  const depth = Math.max(0, query.depth ?? 1);
  for (let index = 0; index < depth; index += 1) {
    const next = new Set<string>();
    for (const edge of graph.edges) {
      if (frontier.has(edge.from)) next.add(edge.to);
      if (frontier.has(edge.to)) next.add(edge.from);
    }
    next.forEach((id) => selected.add(id));
    frontier = next;
  }
  const nodes = graph.nodes.filter((node) => selected.has(node.id) && (!query.regions || query.regions.includes(node.region)));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to) && (!query.edgeKinds || query.edgeKinds.includes(edge.kind)));
  return { ...graph, nodes, edges, documents: graph.documents.filter((document) => document.links?.some((id) => ids.has(id)) ?? false) };
}
