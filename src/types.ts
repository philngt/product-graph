export const REGIONS = [
  "intent",
  "product",
  "business",
  "workflow",
  "domain",
  "experience",
  "architecture",
  "decision",
  "quality",
] as const;

export type Region = (typeof REGIONS)[number];
export const PRIMARY_VIEWS = ["product", "business", "workflow", "domain", "experience", "architecture"] as const;
export type PrimaryView = (typeof PRIMARY_VIEWS)[number];
export const LAYERS = [...PRIMARY_VIEWS, "document", "roadmap", "agent-context"] as const;
export type Layer = (typeof LAYERS)[number];

export const LEGACY_REGION_MAP: Record<string, Region> = {
  workflow: "workflow",
  domain: "domain",
  architecture: "architecture",
  document: "experience",
  roadmap: "product",
};

export const CORE_NODE_TYPES: Record<Region, readonly string[]> = {
  intent: ["problem", "evidence", "user-need", "desired-outcome", "constraint"],
  product: ["product", "capability", "feature", "requirement", "outcome"],
  business: ["customer-segment", "offering", "plan", "pricing", "revenue-model", "entitlement", "cost-driver", "distribution-channel"],
  workflow: ["workflow", "actor", "trigger", "step", "action", "decision", "state", "event", "outcome"],
  domain: ["entity", "value-object", "aggregate", "command", "event", "rule", "invariant", "policy", "repository", "concept"],
  experience: ["journey", "screen", "component", "interaction", "navigation", "feedback", "empty-state", "error-state", "document"],
  architecture: ["module", "service", "interface", "api", "storage", "dependency", "integration", "runtime-boundary", "component"],
  decision: ["decision"],
  quality: ["acceptance-criterion", "test", "verification", "quality-requirement"],
};

export interface ProjectManifest {
  framework: string;
  schemaVersion: string;
  projectId: string;
  name: string;
  description?: string;
  adapter?: string;
}

export interface GraphNode {
  id: string;
  type: string;
  region: Region;
  /** @deprecated Use region. Kept for loading older projects. */
  layer?: Exclude<Layer, "agent-context">;
  title: string;
  status?: string;
  data?: Record<string, unknown>;
  document?: string;
}

export interface GraphEdge {
  id?: string;
  kind: string;
  from: string;
  to: string;
  data?: Record<string, unknown>;
}

export interface GraphDocument {
  id: string;
  title: string;
  path: string;
  purpose?: string;
  status?: string;
  links?: string[];
}

export interface Graph {
  manifest: ProjectManifest;
  nodes: GraphNode[];
  edges: GraphEdge[];
  documents: GraphDocument[];
}

export interface FocusQuery {
  rootIds: string[];
  depth?: number;
  regions?: Region[];
  edgeKinds?: string[];
}

export interface FocusArea {
  id: string;
  title: string;
  description?: string;
  rootIds: string[];
  defaultView: PrimaryView;
  depth: number;
}

export interface GuidedTour {
  id: string;
  title: string;
  steps: Array<{ scopeId: string; nodeId: string; lens: PrimaryView; explanation: string }>;
}

export interface NodeContext {
  selected: GraphNode;
  relationships: GraphEdge[];
  why: GraphNode[];
  decisions: GraphNode[];
  evidence: GraphNode[];
  whereUsed: GraphNode[];
  impact: GraphNode[];
  sourceDocuments: GraphDocument[];
}

export interface CompareResult {
  nodesAdded: GraphNode[];
  nodesRemoved: GraphNode[];
  nodesChanged: GraphNode[];
  edgesAdded: GraphEdge[];
  edgesRemoved: GraphEdge[];
}

export interface LayoutPosition {
  x: number;
  y: number;
  pinned?: boolean;
}

export interface LayoutState {
  schemaVersion: string;
  positions: Record<string, LayoutPosition>;
}

export interface ViewDefinition {
  id: PrimaryView;
  label: string;
  regions: Region[];
  edgeKinds?: string[];
}

export type GraphCommand =
  | { type: "create-node"; node: GraphNode }
  | { type: "update-node"; id: string; patch: Partial<GraphNode> }
  | { type: "delete-node"; id: string }
  | { type: "create-edge"; edge: GraphEdge }
  | { type: "delete-edge"; id: string }
  | { type: "set-layout"; view: string; layout: LayoutState };

export interface Diagnostic {
  level: "error" | "warning";
  code: string;
  message: string;
  subject?: string;
  file?: string;
}

export interface ProjectionArtifact {
  layer: Layer;
  generatedAt: string;
  sourceSchemaVersion: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  documents: GraphDocument[];
}

export interface ContextSelector {
  ids?: string[];
  rootIds?: string[];
  depth?: number;
  scopeId?: string;
  layers?: Exclude<Layer, "agent-context">[];
  types?: string[];
  regions?: Region[];
  includeDocuments?: boolean;
}

export interface ContextBundle {
  schemaVersion: string;
  projectId: string;
  revision?: string;
  selector: ContextSelector;
  nodeIds: string[];
  edgeIds: string[];
  markdown: string;
  json: ProjectionArtifact;
}

export interface AgentContextRequest {
  rootIds?: string[];
  scopeId?: string;
  depth?: number;
  regions?: Region[];
  types?: string[];
  includeDocuments?: boolean;
}

export type ProposalStatus = "pending" | "applied" | "rejected" | "stale";

export interface ProjectAdapter {
  name: string;
  version: string;
  detect(projectRoot: string): boolean;
  capabilities: readonly string[];
}
