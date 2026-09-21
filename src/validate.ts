import { CORE_NODE_TYPES, REGIONS, type Diagnostic, type Graph } from "./types.ts";

const nodeRegions = new Set(REGIONS);

export function validateGraph(graph: Graph): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ids = new Set<string>();
  const nodeById = new Map<string, Graph["nodes"][number]>();

  if (!graph.manifest?.projectId) diagnostics.push({ level: "error", code: "MANIFEST_PROJECT_ID", message: "projectId is required", file: "project.json" });
  if (!graph.manifest?.schemaVersion) diagnostics.push({ level: "error", code: "MANIFEST_SCHEMA_VERSION", message: "schemaVersion is required", file: "project.json" });

  for (const node of graph.nodes) {
    if (!node.id || !node.type || !node.title || !node.region) {
      diagnostics.push({ level: "error", code: "NODE_REQUIRED_FIELD", message: "Node requires id, type, region and title", subject: node.id || "<unknown>" });
      continue;
    }
    if (ids.has(node.id)) diagnostics.push({ level: "error", code: "DUPLICATE_ID", message: `Duplicate graph ID: ${node.id}`, subject: node.id });
    ids.add(node.id);
    nodeById.set(node.id, node);
    if (!nodeRegions.has(node.region)) diagnostics.push({ level: "error", code: "INVALID_REGION", message: `Unsupported node region: ${node.region}`, subject: node.id });
    if (nodeRegions.has(node.region) && !CORE_NODE_TYPES[node.region].includes(node.type) && !node.type.includes(":")) {
      diagnostics.push({ level: "warning", code: "CUSTOM_NODE_TYPE", message: `Custom node type is not in the core ontology: ${node.type}`, subject: node.id });
    }
  }

  for (const edge of graph.edges) {
    if (!edge.kind || !edge.from || !edge.to) diagnostics.push({ level: "error", code: "EDGE_REQUIRED_FIELD", message: "Edge requires kind, from and to", subject: edge.id || `${edge.from}->${edge.to}` });
    if (edge.from && !nodeById.has(edge.from)) diagnostics.push({ level: "error", code: "MISSING_EDGE_SOURCE", message: `Edge source does not exist: ${edge.from}`, subject: edge.id || edge.from });
    if (edge.to && !nodeById.has(edge.to)) diagnostics.push({ level: "error", code: "MISSING_EDGE_TARGET", message: `Edge target does not exist: ${edge.to}`, subject: edge.id || edge.to });
  }

  for (const document of graph.documents) {
    if (!document.id || !document.title || !document.path) diagnostics.push({ level: "error", code: "DOCUMENT_REQUIRED_FIELD", message: "Document requires id, title and path", subject: document.id || "<unknown>" });
    if (document.links) for (const link of document.links) if (!nodeById.has(link)) diagnostics.push({ level: "error", code: "MISSING_DOCUMENT_LINK", message: `Document link does not exist: ${link}`, subject: document.id });
  }

  const edgesByNode = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges) {
    edgesByNode.set(edge.from, [...(edgesByNode.get(edge.from) || []), edge]);
    edgesByNode.set(edge.to, [...(edgesByNode.get(edge.to) || []), edge]);
  }
  for (const node of graph.nodes) {
    const connected = edgesByNode.get(node.id) || [];
    if (node.region === "workflow" && !connected.length) diagnostics.push({ level: "warning", code: "WORKFLOW_ISOLATED", message: "Workflow node has no connected trigger, step or outcome", subject: node.id });
    if (node.region === "experience" && node.type === "screen" && !connected.some((edge) => edge.kind === "supports" || edge.kind === "navigates-to")) diagnostics.push({ level: "warning", code: "SCREEN_UNMAPPED", message: "Screen is not connected to a workflow or navigation path", subject: node.id });
    if (node.region === "product" && node.type === "requirement" && !connected.some((edge) => edge.kind === "verified-by" || edge.kind === "verifies")) diagnostics.push({ level: "warning", code: "REQUIREMENT_UNVERIFIED", message: "Requirement has no verification relationship", subject: node.id });
  }

  const dependencyEdges = graph.edges.filter((edge) => ["depends-on", "dependency"].includes(edge.kind));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const edge of dependencyEdges) adjacency.set(edge.from, [...(adjacency.get(edge.from) || []), edge.to]);
  const visit = (id: string): void => {
    if (visiting.has(id)) { diagnostics.push({ level: "error", code: "DEPENDENCY_CYCLE", message: "Architecture dependency cycle detected", subject: id }); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of adjacency.get(id) || []) visit(child);
    visiting.delete(id); visited.add(id);
  };
  for (const id of adjacency.keys()) visit(id);
  return diagnostics;
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics.map((item) => `${item.level.toUpperCase()} ${item.code}: ${item.message}${item.subject ? ` [${item.subject}]` : ""}`).join("\n");
}
