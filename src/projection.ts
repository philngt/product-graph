import { LEGACY_REGION_MAP, PRIMARY_VIEWS, type Graph, type Layer, type PrimaryView, type ProjectionArtifact, type Region } from "./types.ts";
import { VIEW_DEFINITIONS } from "./views.ts";

const regionOf = (node: Graph["nodes"][number]): Region => node.region || LEGACY_REGION_MAP[node.layer || ""] || "product";
const viewRegions: Record<PrimaryView, Region[]> = Object.fromEntries(VIEW_DEFINITIONS.map((view) => [view.id, view.regions])) as Record<PrimaryView, Region[]>;

export function projectGraph(graph: Graph, layer: Layer): ProjectionArtifact {
  const regions = PRIMARY_VIEWS.includes(layer as PrimaryView) ? viewRegions[layer as PrimaryView] : [LEGACY_REGION_MAP[layer] || layer as Region];
  const nodes = layer === "agent-context" ? graph.nodes : graph.nodes.filter((node) => regions.includes(regionOf(node)));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  const documents = graph.documents.filter((document) => document.links?.some((id) => ids.has(id)) ?? false);
  return {
    layer,
    generatedAt: new Date().toISOString(),
    sourceSchemaVersion: graph.manifest.schemaVersion,
    nodes,
    edges,
    documents,
  };
}

export function renderProjectionMarkdown(projection: ProjectionArtifact): string {
  const lines = [
    `# ${projection.layer} view`,
    "",
    `Schema version: ${projection.sourceSchemaVersion}`,
    "",
    "## Nodes",
    "",
  ];
  for (const node of projection.nodes) {
    lines.push(`### ${node.id} — ${node.title}`, "", `- Type: ${node.type}`, `- Region: ${regionOf(node)}`);
    if (node.status) lines.push(`- Status: ${node.status}`);
    if (node.document) lines.push(`- Document: ${node.document}`);
    lines.push("");
  }
  lines.push("## Relationships", "");
  if (!projection.edges.length) lines.push("No relationships in this projection.", "");
  for (const edge of projection.edges) lines.push(`- ${edge.from} —[${edge.kind}]→ ${edge.to}`);
  if (projection.documents.length) {
    lines.push("", "## Documents", "");
    for (const document of projection.documents) lines.push(`- [${document.title}](${document.path})`);
  }
  return `${lines.join("\n")}\n`;
}
