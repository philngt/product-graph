import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGraph, loadLayouts, loadProposals, saveGraph, saveLayouts, saveProposal } from "./io.ts";
import { applyCommand } from "./commands.ts";
import { formatDiagnostics, validateGraph } from "./validate.ts";
import type { Graph } from "./types.ts";
import { compareGraphs, deriveNodeContext, loadFocusAreas, loadLibrary, loadTours } from "./workspace.ts";
import { selectSubgraph } from "./focus.ts";
import { buildScopedContext } from "./context.ts";
import { applyProposal, previewProposal, type ProposalPatch } from "./proposals.ts";
import { graphFingerprint } from "./revision.ts";

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui");

function send(response: http.ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
}

function sendJson(response: http.ServerResponse, status: number, value: unknown): void {
  send(response, status, JSON.stringify(value), "application/json; charset=utf-8");
}

async function body(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function assetPath(urlPath: string): string | undefined {
  const requested = urlPath === "/" ? "index.html" : urlPath.slice(1);
  const resolved = path.resolve(uiRoot, requested);
  if (!resolved.startsWith(`${uiRoot}${path.sep}`)) return undefined;
  return resolved;
}

export function startServer(projectRoot: string, port = 4173): http.Server {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if ((url.pathname === "/api/graph" || url.pathname === "/api/workspace") && request.method === "GET") {
        const graph = loadGraph(projectRoot);
        return sendJson(response, 200, { graph, baseline: graph, layout: loadLayouts(projectRoot), focusAreas: loadFocusAreas(projectRoot, graph), tours: loadTours(projectRoot), library: loadLibrary(projectRoot), diagnostics: validateGraph(graph) });
      }
      if ((url.pathname === "/api/graph" || url.pathname === "/api/workspace") && request.method === "POST") {
        const payload = JSON.parse(await body(request)) as { graph: Graph; layout?: Record<string, import("./types.ts").LayoutState> };
        const graph = payload.graph || payload as unknown as Graph;
        const diagnostics = validateGraph(graph);
        if (diagnostics.some((item) => item.level === "error")) return sendJson(response, 400, { diagnostics, message: formatDiagnostics(diagnostics) });
        saveGraph(projectRoot, graph);
        if (payload.layout) saveLayouts(projectRoot, payload.layout);
        return sendJson(response, 200, { graph, layout: payload.layout || {}, diagnostics });
      }
      if (url.pathname === "/api/agent-context" && request.method === "GET") {
        const graph = loadGraph(projectRoot);
        const rootIds = url.searchParams.getAll("rootId");
        const depth = Number(url.searchParams.get("depth") || "2");
        const bundle = buildScopedContext(graph, { rootIds: rootIds.length ? rootIds : undefined, depth: Number.isFinite(depth) ? depth : 2 });
        return sendJson(response, 200, { bundle });
      }
      if (url.pathname === "/api/proposals" && request.method === "GET") {
        return sendJson(response, 200, { proposals: loadProposals(projectRoot), revision: graphFingerprint(loadGraph(projectRoot)) });
      }
      if (url.pathname.startsWith("/api/proposals/") && request.method === "GET") {
        const id = decodeURIComponent(url.pathname.slice("/api/proposals/".length));
        const proposal = loadProposals(projectRoot).find((item) => item.id === id);
        if (!proposal) return sendJson(response, 404, { message: `Proposal not found: ${id}` });
        return sendJson(response, 200, { proposal });
      }
      if (url.pathname.startsWith("/api/proposals/") && request.method === "POST") {
        const segments = url.pathname.slice("/api/proposals/".length).split("/");
        const id = decodeURIComponent(segments[0]);
        const proposal = loadProposals(projectRoot).find((item) => item.id === id);
        if (!proposal) return sendJson(response, 404, { message: `Proposal not found: ${id}` });
        const graph = loadGraph(projectRoot);
        if (segments[1] === "preview") {
          const preview = previewProposal(graph, proposal);
          return sendJson(response, 200, { proposal, diff: compareGraphs(graph, preview.graph), diagnostics: preview.diagnostics, revision: graphFingerprint(graph), canApply: proposal.baseRevision === graphFingerprint(graph) && !preview.diagnostics.some((item) => item.level === "error") });
        }
        if (segments[1] === "apply") {
          try {
            const candidate = applyProposal(graph, proposal);
            const diagnostics = validateGraph(candidate);
            if (diagnostics.some((item) => item.level === "error")) return sendJson(response, 400, { diagnostics, message: formatDiagnostics(diagnostics) });
            saveGraph(projectRoot, candidate);
            saveProposal(projectRoot, { ...proposal, status: "applied" });
            return sendJson(response, 200, { graph: candidate, proposal: { ...proposal, status: "applied" }, diagnostics, revision: graphFingerprint(candidate) });
          } catch (error) {
            const message = String(error);
            if (message.includes("stale")) {
              saveProposal(projectRoot, { ...proposal, status: "stale" });
              return sendJson(response, 409, { message, proposal: { ...proposal, status: "stale" } });
            }
            return sendJson(response, 400, { message, proposal });
          }
        }
        if (segments[1] === "reject") {
          saveProposal(projectRoot, { ...proposal, status: "rejected" });
          return sendJson(response, 200, { proposal: { ...proposal, status: "rejected" } });
        }
      }
      if (url.pathname === "/api/context" && request.method === "GET") {
        const graph = loadGraph(projectRoot);
        const rootId = url.searchParams.get("rootId");
        if (!rootId) return sendJson(response, 400, { message: "rootId is required" });
        const depth = Number(url.searchParams.get("depth") || "2");
        const focused = selectSubgraph(graph, { rootIds: [rootId], depth: Number.isFinite(depth) ? depth : 2 });
        return sendJson(response, 200, { graph: focused, context: deriveNodeContext(graph, rootId) });
      }
      if (url.pathname === "/api/compare" && request.method === "POST") {
        const payload = JSON.parse(await body(request)) as { base: Graph; candidate: Graph };
        return sendJson(response, 200, compareGraphs(payload.base, payload.candidate));
      }
      if (url.pathname === "/api/commands" && request.method === "POST") {
        const payload = JSON.parse(await body(request)) as { command: import("./types.ts").GraphCommand };
        const graph = applyCommand(loadGraph(projectRoot), payload.command);
        const diagnostics = validateGraph(graph);
        if (diagnostics.some((item) => item.level === "error")) return sendJson(response, 400, { diagnostics, message: formatDiagnostics(diagnostics) });
        saveGraph(projectRoot, graph);
        return sendJson(response, 200, { graph, diagnostics });
      }
      if (request.method !== "GET") return send(response, 405, "Method not allowed");
      const file = assetPath(url.pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(response, 404, "Not found");
      const extension = path.extname(file);
      const contentType = extension === ".html" ? "text/html; charset=utf-8" : extension === ".css" ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
      return send(response, 200, fs.readFileSync(file, "utf8"), contentType);
    } catch (error) {
      return sendJson(response, 500, { message: String(error) });
    }
  });
  server.listen(port, "127.0.0.1", () => console.log(`Product graph UI: http://127.0.0.1:${port}`));
  return server;
}
