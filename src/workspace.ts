import fs from "node:fs";
import path from "node:path";
import { selectSubgraph } from "./focus.ts";
import type { CompareResult, FocusArea, Graph, GraphEdge, GraphNode, GuidedTour, NodeContext, PrimaryView } from "./types.ts";

function readCollection<T>(projectRoot: string, directory: string): T[] {
  const full = path.join(projectRoot, directory);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((file) => file.endsWith(".json")).sort().map((file) => JSON.parse(fs.readFileSync(path.join(full, file), "utf8")) as T);
}

export function loadFocusAreas(projectRoot: string, graph: Graph): FocusArea[] {
  const configured = readCollection<FocusArea>(projectRoot, "focus-areas");
  if (configured.length) return configured;
  return graph.nodes.filter((node) => node.region === "product" || node.type === "feature").slice(0, 8).map((node) => ({ id: node.id, title: node.title, description: `Explore ${node.title} across the product model.`, rootIds: [node.id], defaultView: "product" as PrimaryView, depth: 2 }));
}

export function loadTours(projectRoot: string): GuidedTour[] { return readCollection<GuidedTour>(projectRoot, "tours"); }
export function loadLibrary(projectRoot: string): { patterns: unknown[]; templates: unknown[] } { return { patterns: readCollection(projectRoot, "patterns"), templates: readCollection(projectRoot, "templates") }; }

function nodeById(graph: Graph, id: string): GraphNode | undefined { return graph.nodes.find((node) => node.id === id); }
function connected(graph: Graph, id: string): GraphEdge[] { return graph.edges.filter((edge) => edge.from === id || edge.to === id); }

export function deriveNodeContext(graph: Graph, id: string): NodeContext {
  const selected = nodeById(graph, id);
  if (!selected) throw new Error(`Node not found: ${id}`);
  const relationships = connected(graph, id);
  const related = new Set(relationships.flatMap((edge) => [edge.from, edge.to])); related.delete(id);
  const relatedNodes = [...related].map((nodeId) => nodeById(graph, nodeId)).filter(Boolean) as GraphNode[];
  const why = relatedNodes.filter((node) => ["intent", "product"].includes(node.region) || ["problem", "user-need", "desired-outcome", "constraint"].includes(node.type));
  const decisions = relatedNodes.filter((node) => node.region === "decision" || node.type === "decision");
  const evidence = relatedNodes.filter((node) => node.type === "evidence" || node.region === "quality");
  const whereUsed = relatedNodes.filter((node) => !why.includes(node) && !decisions.includes(node) && !evidence.includes(node));
  const focused = selectSubgraph(graph, { rootIds: [id], depth: 3 });
  return { selected, relationships, why, decisions, evidence, whereUsed, impact: focused.nodes.filter((node) => node.id !== id), sourceDocuments: graph.documents.filter((document) => document.links?.includes(id) ?? false) };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function compareGraphs(base: Graph, candidate: Graph): CompareResult {
  const baseNodes = new Map(base.nodes.map((node) => [node.id, node])); const candidateNodes = new Map(candidate.nodes.map((node) => [node.id, node]));
  const baseEdges = new Map(base.edges.map((edge) => [edge.id || `${edge.from}:${edge.kind}:${edge.to}`, edge])); const candidateEdges = new Map(candidate.edges.map((edge) => [edge.id || `${edge.from}:${edge.kind}:${edge.to}`, edge]));
  return {
    nodesAdded: [...candidateNodes.entries()].filter(([id]) => !baseNodes.has(id)).map(([, node]) => node),
    nodesRemoved: [...baseNodes.entries()].filter(([id]) => !candidateNodes.has(id)).map(([, node]) => node),
    nodesChanged: [...candidateNodes.entries()].filter(([id, node]) => baseNodes.has(id) && stable(baseNodes.get(id)) !== stable(node)).map(([, node]) => node),
    edgesAdded: [...candidateEdges.entries()].filter(([id]) => !baseEdges.has(id)).map(([, edge]) => edge),
    edgesRemoved: [...baseEdges.entries()].filter(([id]) => !candidateEdges.has(id)).map(([, edge]) => edge),
  };
}
