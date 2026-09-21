import type { AgentContextRequest, ContextBundle, ContextSelector, Graph, GraphNode } from "./types.ts";
import { graphFingerprint } from "./revision.ts";
import { projectGraph } from "./projection.ts";
import { selectSubgraph } from "./focus.ts";

export function buildContext(graph: Graph, selector: ContextSelector = {}): ContextBundle {
  const all = projectGraph(graph, "agent-context");
  const idSet = selector.ids ? new Set(selector.ids) : undefined;
  const nodes = all.nodes.filter((node) =>
    (!idSet || idSet.has(node.id)) &&
    (!selector.layers || selector.layers.includes(node.layer || node.region as never)) &&
    (!selector.regions || selector.regions.includes(node.region)) &&
    (!selector.types || selector.types.includes(node.type)),
  );
  const selected = new Set(nodes.map((node) => node.id));
  const edges = all.edges.filter((edge) => selected.has(edge.from) && selected.has(edge.to));
  const documents = selector.includeDocuments === false ? [] : all.documents.filter((document) => document.links?.some((id) => selected.has(id)) ?? false);
  const json = { ...all, nodes, edges, documents };
  const revision = graphFingerprint(graph);
  const lines = [
    `# Product Graph Context: ${graph.manifest.name}`,
    "",
    `Project: ${graph.manifest.projectId}`,
    `Schema: ${graph.manifest.schemaVersion}`,
    `Revision: ${revision}`,
    "",
    "## Nodes",
    "",
  ];
  for (const node of nodes) {
    lines.push(`### ${node.id}`, "", `- Type: ${node.type}`, `- Region: ${node.region}`, `- Title: ${node.title}`);
    if (node.status) lines.push(`- Status: ${node.status}`);
    if (node.document) lines.push(`- Source: ${node.document}`);
    if (node.data && Object.keys(node.data).length) lines.push(`- Data: ${JSON.stringify(node.data)}`);
    lines.push("");
  }
  lines.push("", "## Relationships", "");
  for (const edge of edges) lines.push(`- ${edge.from} —[${edge.kind}]→ ${edge.to}`);
  if (documents.length) {
    lines.push("", "## Documents", "");
    for (const document of documents) lines.push(`- **${document.title}**: ${document.path}`);
  }
  return { schemaVersion: graph.manifest.schemaVersion, projectId: graph.manifest.projectId, revision, selector, nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge, index) => edge.id || `${edge.from}:${edge.kind}:${edge.to}:${index}`), markdown: `${lines.join("\n")}\n`, json };
}

export function buildScopedContext(graph: Graph, request: AgentContextRequest = {}): ContextBundle {
  const roots = request.rootIds || (request.scopeId ? [] : undefined);
  const depth = request.depth ?? 2;
  const focused = roots?.length ? selectSubgraph(graph, { rootIds: roots, depth, regions: request.regions }) : graph;
  const selector: ContextSelector = { depth };
  if (roots?.length) selector.rootIds = roots;
  if (request.scopeId) selector.scopeId = request.scopeId;
  if (request.regions) selector.regions = request.regions;
  if (request.types) selector.types = request.types;
  if (request.includeDocuments !== undefined) selector.includeDocuments = request.includeDocuments;
  const bundle = buildContext(focused, selector);
  bundle.revision = graphFingerprint(graph);
  return bundle;
}

export function renderNodeContextMarkdown(node: GraphNode, graph: Graph): string {
  const bundle = buildContext(graph, { ids: [node.id] });
  return bundle.markdown;
}
