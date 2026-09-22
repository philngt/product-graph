import fs from "node:fs";
import path from "node:path";
import { atomicText, localPath, LocalError } from "./local-files.ts";
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

export function prepareLayoutWrite(projectRoot: string, layouts: Record<string, LayoutState>): () => void {
  if (!layouts || typeof layouts !== "object" || Array.isArray(layouts)) throw new LocalError(400, "Invalid layout map");
  const entries = Object.entries(layouts).map(([view, layout]) => {
    if (!/^[a-zA-Z0-9:._-]{1,240}$/.test(view) || !layout || typeof layout !== "object" || !layout.positions || typeof layout.positions !== "object" || Array.isArray(layout.positions)) throw new LocalError(400, "Invalid layout key or data");
    for (const position of Object.values(layout.positions)) {
      if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new LocalError(400, "Invalid layout coordinates");
    }
    return [localPath(projectRoot, `layout/${view}.json`), `${JSON.stringify(layout, null, 2)}\n`] as const;
  });
  if (entries.length > 5000 || entries.some(([, text]) => Buffer.byteLength(text) > 1024 * 1024)) throw new LocalError(413, "Layout exceeds storage limits");
  return () => { for (const [file, text] of entries) atomicText(file, text); };
}

export function saveLayouts(projectRoot: string, layouts: Record<string, LayoutState>): void { prepareLayoutWrite(projectRoot, layouts)(); }

export function prepareGraphWrite(projectRoot: string, graph: Graph): () => void {
  // Preflight every filename before any write; reject IDs that normalize to the same file.
  const groups = [
    ["graph/nodes", graph.nodes.map(node => { const persisted = { ...node, region: node.region || LEGACY_REGION_MAP[node.layer || ""] || "product" }; delete persisted.layer; return [node.id, persisted] as const; })],
    ["graph/edges", graph.edges.map((edge, index) => [edge.id || `${edge.from}-${edge.kind}-${edge.to}-${index}`, edge] as const)],
    ["graph/documents", graph.documents.map(document => [document.id, document] as const)],
  ] as const;
  const plan = groups.map(([directory, entries]) => {
    if (entries.length > 5000) throw new LocalError(413, "Too many graph records");
    const names = entries.map(([id]) => `${id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`);
    if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new LocalError(400, `IDs collide as filenames in ${directory}`);
    const files = entries.map(([, value], index) => [localPath(projectRoot, `${directory}/${names[index]}`), `${JSON.stringify(value, null, 2)}\n`] as const);
    if (names.some(name => name.length > 240) || files.some(([, text]) => Buffer.byteLength(text) > 1024 * 1024)) throw new LocalError(413, "Graph record exceeds storage limits");
    const target = localPath(projectRoot, directory);
    const stale = fs.existsSync(target) ? fs.readdirSync(target).filter(name => name.endsWith(".json") && !names.includes(name)).map(name => localPath(projectRoot, `${directory}/${name}`)) : [];
    return { files, stale };
  });
  const manifest = localPath(projectRoot, "project.json");
  const manifestText = `${JSON.stringify(graph.manifest, null, 2)}\n`;
  if (Buffer.byteLength(manifestText) > 1024 * 1024) throw new LocalError(413, "Project manifest exceeds storage limits");
  return () => {
    for (const group of plan) for (const [file, text] of group.files) atomicText(file, text);
    for (const group of plan) for (const file of group.stale) fs.unlinkSync(file);
    atomicText(manifest, manifestText);
  };
}

export function saveGraph(projectRoot: string, graph: Graph): void { prepareGraphWrite(projectRoot, graph)(); }

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
