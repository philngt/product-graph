import type { Diagnostic, Graph, GraphNode } from "./types.ts";

export interface ProductIR {
  schemaVersion: string;
  projectId: string;
  nodes: GraphNode[];
  traceability: Record<string, string[]>;
}

export interface GeneratedFile {
  path: string;
  contents: string;
  generated: boolean;
  sourceIds: string[];
}

export interface TargetTemplate {
  id: string;
  version: string;
  target: "ios-swiftui";
  validate(ir: ProductIR): Diagnostic[];
  generate(ir: ProductIR): GeneratedFile[];
}

export interface CompileResult {
  files: GeneratedFile[];
  diagnostics: Diagnostic[];
  traceability: Record<string, string[]>;
}

export function normalizeProductGraph(graph: Graph): ProductIR {
  return {
    schemaVersion: graph.manifest.schemaVersion,
    projectId: graph.manifest.projectId,
    nodes: graph.nodes,
    traceability: Object.fromEntries(graph.nodes.map((node) => [node.id, [node.id]])),
  };
}
