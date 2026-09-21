import fs from "node:fs";
import path from "node:path";
import { LEGACY_REGION_MAP, type Graph, type GraphDocument, type GraphEdge, type GraphNode, type LayoutState, type ProjectManifest } from "./types.ts";
import type { ProposalPatch } from "./proposals.ts";

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

const readJsonFiles = <T>(directory: string): T[] => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => readJson<T>(path.join(directory, file)));
};

export function loadGraph(projectRoot: string): Graph {
  const manifestFile = path.join(projectRoot, "project.json");
  const legacyManifest = path.join(projectRoot, "project.yaml");
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`Missing project.json in ${projectRoot}${fs.existsSync(legacyManifest) ? " (YAML manifests are not supported by the zero-dependency loader yet)" : ""}`);
  }

  const manifest = readJson<ProjectManifest>(manifestFile);
  const nodes = readJsonFiles<GraphNode>(path.join(projectRoot, "graph", "nodes")).map((node) => ({
    ...node,
    region: node.region || LEGACY_REGION_MAP[node.layer || ""] || "product",
  }));
  const edges = readJsonFiles<GraphEdge>(path.join(projectRoot, "graph", "edges"));
  const documents = readJsonFiles<GraphDocument>(path.join(projectRoot, "graph", "documents"));
  return { manifest, nodes, edges, documents };
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, "utf8");
}

export function loadLayouts(projectRoot: string): Record<string, LayoutState> {
  const directory = path.join(projectRoot, "layout");
  if (!fs.existsSync(directory)) return {};
  return Object.fromEntries(fs.readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => [path.basename(file, ".json"), readJson<LayoutState>(path.join(directory, file))]));
}

export function saveLayouts(projectRoot: string, layouts: Record<string, LayoutState>): void {
  for (const [view, layout] of Object.entries(layouts)) writeJson(path.join(projectRoot, "layout", `${view}.json`), layout);
}

export function saveGraph(projectRoot: string, graph: Graph): void {
  writeJson(path.join(projectRoot, "project.json"), graph.manifest);
  graph.nodes.forEach((node) => {
    const persisted = { ...node, region: node.region || LEGACY_REGION_MAP[node.layer || ""] || "product" };
    delete persisted.layer;
    writeJson(path.join(projectRoot, "graph", "nodes", `${node.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`), persisted);
  });
  graph.edges.forEach((edge, index) => writeJson(path.join(projectRoot, "graph", "edges", `${(edge.id || `${edge.from}-${edge.kind}-${edge.to}-${index}`).replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`), edge));
  graph.documents.forEach((document) => writeJson(path.join(projectRoot, "graph", "documents", `${document.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`), document));
}

export function loadProposals(projectRoot: string): ProposalPatch[] {
  return readJsonFiles<ProposalPatch>(path.join(projectRoot, "agent-context", "proposals"));
}

export function saveProposal(projectRoot: string, proposal: ProposalPatch): void {
  writeJson(path.join(projectRoot, "agent-context", "proposals", `${proposal.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`), proposal);
}

export function copyDirectory(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else fs.copyFileSync(from, to);
  }
}
