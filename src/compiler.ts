import type { Diagnostic, Graph, GraphNode, GraphEdge, GraphDocument } from "./types.ts";
import type { ImplementationTarget } from "./implementation-targets.ts";

/** Product semantics are independent of language, runtime and UI framework. */
export interface ProductIR {
  schemaVersion: string;
  projectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  documents: GraphDocument[];
  traceability: Record<string, string[]>;
}

export interface GeneratedFile {
  path: string;
  contents: string;
  generated: boolean;
  sourceIds: string[];
}

/** Adapter contract, not a built-in implementation. No generators are registered yet. */
export interface TargetTemplate {
  id: string;
  version: string;
  target: string;
  validate(ir: ProductIR, deployment: ImplementationTarget): Diagnostic[];
  generate(ir: ProductIR, deployment: ImplementationTarget): GeneratedFile[];
}

export interface CompileResult {
  files: GeneratedFile[];
  diagnostics: Diagnostic[];
  traceability: Record<string, string[]>;
}

export function normalizeProductGraph(graph: Graph): ProductIR {
  const { nodes, edges, documents } = structuredClone(graph);
  return {
    schemaVersion: graph.manifest.schemaVersion,
    projectId: graph.manifest.projectId,
    nodes, edges, documents,
    traceability: Object.fromEntries(nodes.map(node => [node.id, [node.id]])),
  };
}
