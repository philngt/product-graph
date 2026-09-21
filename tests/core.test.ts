import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildContext } from "../src/context.ts";
import { copyDirectory, loadGraph } from "../src/io.ts";
import { projectGraph } from "../src/projection.ts";
import { validateGraph } from "../src/validate.ts";

const template = path.resolve("templates/default");

test("template loads and validates", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-framework-"));
  copyDirectory(template, dir);
  const graph = loadGraph(dir);
  assert.equal(validateGraph(graph).length, 0);
  assert.equal(graph.nodes.length, 11);
});

test("projection contains only nodes from its layer", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-framework-"));
  copyDirectory(template, dir);
  const graph = loadGraph(dir);
  const projection = projectGraph(graph, "domain");
  assert.deepEqual(projection.nodes.map((node) => node.id).sort(), ["business:free-plan", "domain:project", "workflow:develop"]);
  assert.equal(projection.edges.length, 0);
});

test("context selector preserves provenance and relationships", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-framework-"));
  copyDirectory(template, dir);
  const graph = loadGraph(dir);
  const bundle = buildContext(graph, { ids: ["architecture:framework", "experience:graph-canvas"] });
  assert.deepEqual([...bundle.nodeIds].sort(), ["architecture:framework", "experience:graph-canvas"]);
  assert.equal(bundle.json.edges.length, 1);
  assert.match(bundle.markdown, /architecture:framework/);
});

test("broken references are errors", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-framework-"));
  copyDirectory(template, dir);
  const graph = loadGraph(dir);
  graph.edges[0].to = "missing:node";
  assert.ok(validateGraph(graph).some((diagnostic) => diagnostic.code === "MISSING_EDGE_TARGET"));
});

test("legacy layer manifests migrate to semantic regions when loaded", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-legacy-"));
  copyDirectory(template, dir);
  const legacyFile = path.join(dir, "graph", "nodes", "legacy.json");
  fs.writeFileSync(legacyFile, JSON.stringify({ id: "legacy:node", type: "concept", layer: "domain", title: "Legacy node" }));
  const graph = loadGraph(dir);
  assert.equal(graph.nodes.find((node) => node.id === "legacy:node")?.region, "domain");
});
