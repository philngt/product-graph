#!/usr/bin/env -S node --experimental-strip-types
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContext, buildScopedContext } from "./context.ts";
import { copyDirectory, loadGraph, writeJson, writeText } from "./io.ts";
import { projectGraph, renderProjectionMarkdown } from "./projection.ts";
import { formatDiagnostics, validateGraph } from "./validate.ts";
import { PRIMARY_VIEWS, type ContextSelector, type Layer } from "./types.ts";
import { startServer } from "./server.ts";
import { startMcpServer } from "./mcp.ts";
import { loadFocusAreas } from "./workspace.ts";
import { selectSubgraph } from "./focus.ts";

const root = process.cwd();
const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates/default");

function usage(): never {
  console.error("Usage: framework <init|validate|project|context|check|upgrade|serve|mcp> [path] [options]");
  process.exit(2);
}

function resolveProject(input = "."): string { return path.resolve(root, input); }
function graphOrExit(projectRoot: string) { try { return loadGraph(projectRoot); } catch (error) { console.error(String(error)); process.exit(1); } }

function init(target = "."): void {
  const destination = resolveProject(target);
  if (fs.existsSync(path.join(destination, "project.json"))) throw new Error(`Project already exists: ${destination}`);
  copyDirectory(templateRoot, destination);
  console.log(`Initialized project at ${destination}`);
}

function validate(target: string): boolean {
  const projectRoot = resolveProject(target);
  const diagnostics = validateGraph(graphOrExit(projectRoot));
  if (diagnostics.length) { console.error(formatDiagnostics(diagnostics)); return false; }
  console.log("Graph validation passed"); return true;
}

function project(target: string, requestedLayer?: string): void {
  const projectRoot = resolveProject(target);
  const graph = graphOrExit(projectRoot);
  const diagnostics = validateGraph(graph);
  if (diagnostics.some((item) => item.level === "error")) { console.error(formatDiagnostics(diagnostics)); process.exit(1); }
  const layers = requestedLayer ? [requestedLayer as Layer] : [...PRIMARY_VIEWS] as Layer[];
  for (const layer of layers) {
    const projection = projectGraph(graph, layer);
    writeJson(path.join(projectRoot, "projections", `${layer}.json`), projection);
    writeText(path.join(projectRoot, "projections", `${layer}.md`), renderProjectionMarkdown(projection));
  }
  console.log(`Generated ${layers.length} projection(s)`);
}

function context(target: string, ...options: string[]): void {
  const projectRoot = resolveProject(target);
  const graph = graphOrExit(projectRoot);
  const layer = options.find((option) => !option.startsWith("--"));
  const rootIds = options.filter((option) => option.startsWith("--root=")).flatMap((option) => option.slice("--root=".length).split(",").filter(Boolean));
  const depthOption = options.find((option) => option.startsWith("--depth="));
  const depth = depthOption ? Number(depthOption.slice("--depth=".length)) : 2;
  const scopeOption = options.find((option) => option.startsWith("--scope="));
  const scopeId = scopeOption?.slice("--scope=".length);
  const scope = scopeId ? loadFocusAreas(projectRoot, graph).find((item) => item.id === scopeId) : undefined;
  if (scopeId && !scope) throw new Error(`Focus area not found: ${scopeId}`);
  const selectedRoots = scope?.rootIds || rootIds;
  const focused = selectedRoots.length ? selectSubgraph(graph, { rootIds: selectedRoots, depth: Number.isFinite(depth) ? depth : 2 }) : graph;
  const selector: ContextSelector = layer ? { layers: [layer as Exclude<Layer, "agent-context">] } : {};
  const bundle = layer ? buildContext(focused, selector) : buildScopedContext(graph, { rootIds: selectedRoots.length ? selectedRoots : undefined, scopeId, depth: Number.isFinite(depth) ? depth : 2 });
  writeJson(path.join(projectRoot, "agent-context", "context.json"), bundle);
  writeText(path.join(projectRoot, "agent-context", "context.md"), bundle.markdown);
  const scopes = scope ? [scope] : loadFocusAreas(projectRoot, graph);
  for (const item of scopes) {
    const scoped = buildScopedContext(graph, { rootIds: item.rootIds, depth: item.depth });
    writeJson(path.join(projectRoot, "agent-context", "scopes", `${item.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`), scoped);
    writeText(path.join(projectRoot, "agent-context", "scopes", `${item.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.md`), scoped.markdown);
  }
  console.log(`Generated agent context for ${bundle.nodeIds.length} node(s)`);
}

function withoutGeneratedAt<T>(value: T): T {
  const strip = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(strip);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item as Record<string, unknown>).filter(([key]) => key !== "generatedAt").map(([key, child]) => [key, strip(child)]));
    return item;
  };
  return strip(value) as T;
}

function check(target: string): void {
  const projectRoot = resolveProject(target);
  const graph = graphOrExit(projectRoot);
  const diagnostics = validateGraph(graph);
  if (diagnostics.length) { console.error(formatDiagnostics(diagnostics)); process.exit(1); }
  const expectedLayers: Layer[] = [...PRIMARY_VIEWS] as Layer[];
  const stale: string[] = [];
  for (const layer of expectedLayers) {
    const file = path.join(projectRoot, "projections", `${layer}.json`);
    const markdownFile = path.join(projectRoot, "projections", `${layer}.md`);
    if (!fs.existsSync(file) || !fs.existsSync(markdownFile)) { stale.push(`missing projections/${layer}.{json,md}`); continue; }
    const actual = JSON.parse(fs.readFileSync(file, "utf8"));
    const expected = projectGraph(graph, layer);
    if (JSON.stringify(withoutGeneratedAt(actual)) !== JSON.stringify(withoutGeneratedAt(expected)) || fs.readFileSync(markdownFile, "utf8") !== renderProjectionMarkdown(expected)) stale.push(`stale projections/${layer}.{json,md}`);
  }
  const contextJson = path.join(projectRoot, "agent-context", "context.json");
  const contextMarkdown = path.join(projectRoot, "agent-context", "context.md");
  if (!fs.existsSync(contextJson) || !fs.existsSync(contextMarkdown)) stale.push("missing agent-context bundle");
  else {
    const actual = JSON.parse(fs.readFileSync(contextJson, "utf8"));
    const selector = actual.selector || {};
    const expected = selector.rootIds?.length ? buildScopedContext(graph, { rootIds: selector.rootIds, scopeId: selector.scopeId, depth: selector.depth }) : buildContext(graph, selector);
    if (JSON.stringify(withoutGeneratedAt(actual)) !== JSON.stringify(withoutGeneratedAt(expected)) || fs.readFileSync(contextMarkdown, "utf8") !== expected.markdown) stale.push("stale agent-context bundle");
  }
  if (stale.length) { console.error(`STALE_GENERATED_OUTPUT: ${stale.join(", ")}`); process.exit(1); }
  console.log("Project check passed");
}

function upgrade(target: string): void {
  const projectRoot = resolveProject(target);
  const lock = path.join(projectRoot, "framework.lock");
  if (!fs.existsSync(lock)) writeJson(lock, { framework: "0.1.0", schemaVersion: "1.0.0" });
  console.log("Project metadata is up to date");
}

function serve(target: string, portText = "4173"): void {
  const projectRoot = resolveProject(target);
  loadGraph(projectRoot);
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port: ${portText}`);
  startServer(projectRoot, port);
}

function mcp(target: string): void {
  const projectRoot = resolveProject(target);
  loadGraph(projectRoot);
  startMcpServer(projectRoot);
}

const [command, target = ".", ...options] = process.argv.slice(2);
try {
  if (!command) usage();
  if (command === "init") init(target);
  else if (command === "validate") process.exit(validate(target) ? 0 : 1);
  else if (command === "project") project(target, options[0]);
  else if (command === "context") context(target, ...options);
  else if (command === "check") check(target);
  else if (command === "upgrade") upgrade(target);
  else if (command === "serve") serve(target, options[0]);
  else if (command === "mcp") mcp(target);
  else usage();
} catch (error) { console.error(String(error)); process.exit(1); }
