import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { buildScopedContext } from "./context.ts";
import { loadGraph, loadProposals, saveProposal } from "./io.ts";
import { graphFingerprint } from "./revision.ts";
import { applyProposal, previewProposal, type ProposalPatch } from "./proposals.ts";
import { compareGraphs } from "./workspace.ts";
import { formatDiagnostics, validateGraph } from "./validate.ts";
import type { AgentContextRequest, Graph, GraphCommand } from "./types.ts";

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function contextFor(projectRoot: string, request: AgentContextRequest) {
  const graph = loadGraph(projectRoot);
  const bundle = buildScopedContext(graph, request);
  return { graph, bundle };
}

export function createMcpServer(projectRoot: string): McpServer {
  const server = new McpServer({ name: "product-graph", version: "0.1.0" });

  server.registerResource("project-context", "productgraph://context/all", { title: "Product Graph context", mimeType: "text/markdown" }, async (uri) => {
    const { bundle } = contextFor(projectRoot, {});
    return { contents: [{ uri: uri.href, text: bundle.markdown }] };
  });

  server.registerResource("project-diagnostics", "productgraph://diagnostics", { title: "Product Graph diagnostics", mimeType: "application/json" }, async (uri) => {
    const diagnostics = validateGraph(loadGraph(projectRoot));
    return { contents: [{ uri: uri.href, text: JSON.stringify({ diagnostics }, null, 2), mimeType: "application/json" }] };
  });

  server.registerTool("search_graph", {
    title: "Search Product Graph",
    description: "Find product concepts by id, title, type, region, or status.",
    inputSchema: z.object({ query: z.string().min(1), region: z.string().optional(), type: z.string().optional() }),
  }, async ({ query, region, type }) => {
    const graph = loadGraph(projectRoot);
    const needle = query.toLowerCase();
    const nodes = graph.nodes.filter((node) =>
      (!region || node.region === region) &&
      (!type || node.type === type) &&
      [node.id, node.title, node.type, node.region, node.status || ""].some((value) => value.toLowerCase().includes(needle)),
    );
    return textResult({ revision: graphFingerprint(graph), nodes });
  });

  server.registerTool("get_focus_context", {
    title: "Get focus context",
    description: "Return bounded Markdown and structured context around one or more Product Graph nodes.",
    inputSchema: z.object({ rootIds: z.array(z.string()).min(1), depth: z.number().int().min(0).max(6).optional(), regions: z.array(z.string()).optional(), types: z.array(z.string()).optional() }),
  }, async ({ rootIds, depth, regions, types }) => {
    const { bundle } = contextFor(projectRoot, { rootIds, depth, regions: regions as AgentContextRequest["regions"], types });
    return textResult(bundle);
  });

  server.registerTool("validate_graph", {
    title: "Validate Product Graph",
    description: "Run graph validation without changing project files.",
    inputSchema: z.object({}),
  }, async () => textResult({ revision: graphFingerprint(loadGraph(projectRoot)), diagnostics: validateGraph(loadGraph(projectRoot)) }));

  server.registerTool("compare_graph", {
    title: "Compare graph snapshots",
    description: "Compare a candidate graph snapshot against the current canonical graph.",
    inputSchema: z.object({ candidate: z.unknown() }),
  }, async ({ candidate }) => {
    const current = loadGraph(projectRoot);
    return textResult(compareGraphs(current, candidate as Graph));
  });

  server.registerTool("create_proposal", {
    title: "Create graph proposal",
    description: "Create a reviewable proposal. This never applies changes to the canonical graph.",
    inputSchema: z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      rationale: z.string().optional(),
      commands: z.array(z.unknown()).min(1),
      affectedIds: z.array(z.string()).default([]),
    }),
  }, async ({ id, title, rationale, commands, affectedIds }) => {
    const graph = loadGraph(projectRoot);
    const proposal: ProposalPatch = {
      id,
      title,
      rationale,
      source: "agent",
      commands: commands as GraphCommand[],
      affectedIds,
      baseRevision: graphFingerprint(graph),
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    const preview = previewProposal(graph, proposal);
    if (preview.diagnostics.some((diagnostic) => diagnostic.level === "error")) return textResult({ proposal, diagnostics: preview.diagnostics, accepted: false });
    saveProposal(projectRoot, proposal);
    return textResult({ proposal, diagnostics: preview.diagnostics, accepted: true, message: "Proposal saved for human review; canonical graph was not changed." });
  });

  server.registerTool("list_proposals", {
    title: "List graph proposals",
    description: "List pending and historical proposals created for human review.",
    inputSchema: z.object({}),
  }, async () => textResult(loadProposals(projectRoot)));

  server.registerTool("preview_proposal", {
    title: "Preview graph proposal",
    description: "Preview a proposal and return diagnostics without applying it.",
    inputSchema: z.object({ id: z.string().min(1) }),
  }, async ({ id }) => {
    const graph = loadGraph(projectRoot);
    const proposal = loadProposals(projectRoot).find((item) => item.id === id);
    if (!proposal) return textResult({ error: `Proposal not found: ${id}` });
    const preview = previewProposal(graph, proposal);
    return textResult({ proposal, revision: graphFingerprint(graph), diff: compareGraphs(graph, preview.graph), diagnostics: preview.diagnostics, canApply: proposal.baseRevision === graphFingerprint(graph) && !preview.diagnostics.some((item) => item.level === "error") });
  });

  return server;
}

export function startMcpServer(projectRoot: string): void {
  serveStdio(() => createMcpServer(projectRoot));
}
