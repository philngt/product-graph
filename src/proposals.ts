import { applyCommands } from "./commands.ts";
import { validateGraph } from "./validate.ts";
import type { Diagnostic, Graph, GraphCommand, ProposalStatus } from "./types.ts";
import { graphFingerprint } from "./revision.ts";

export interface ProposalPatch {
  id: string;
  title: string;
  rationale?: string;
  source: "human" | "agent" | "pattern";
  commands: GraphCommand[];
  affectedIds: string[];
  baseRevision?: string;
  createdAt?: string;
  status?: ProposalStatus;
}

export interface ProposalReview {
  graph: Graph;
  diagnostics: Diagnostic[];
}

export function previewProposal(graph: Graph, proposal: ProposalPatch): ProposalReview {
  const result = applyCommands(graph, proposal.commands);
  return { graph: result, diagnostics: validateGraph(result) };
}

export function proposalRevisionMatches(graph: Graph, proposal: ProposalPatch): boolean {
  return !proposal.baseRevision || proposal.baseRevision === graphFingerprint(graph);
}

export function applyProposal(graph: Graph, proposal: ProposalPatch): Graph {
  if (!proposalRevisionMatches(graph, proposal)) throw new Error("Proposal is stale and must be regenerated");
  const preview = previewProposal(graph, proposal);
  if (preview.diagnostics.some((diagnostic) => diagnostic.level === "error")) throw new Error("Proposal contains validation errors");
  return preview.graph;
}
