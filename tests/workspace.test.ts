import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { copyDirectory, loadGraph } from "../src/io.ts";
import { compareGraphs, deriveNodeContext, loadFocusAreas, loadLibrary, loadTours } from "../src/workspace.ts";

function fixture() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-workspace-")); copyDirectory(path.resolve("templates/default"), dir); return { dir, graph: loadGraph(dir) }; }

test("workspace loads focus areas and libraries", () => {
  const { dir, graph } = fixture();
  assert.equal(loadFocusAreas(dir, graph).length, 2);
  assert.equal(loadTours(dir).length, 1);
  assert.equal(loadLibrary(dir).patterns.length, 1);
  assert.equal(loadLibrary(dir).templates.length, 1);
});

test("node context exposes why, usage and impact", () => {
  const { graph } = fixture();
  const context = deriveNodeContext(graph, "product:graph-workspace");
  assert.ok(context.why.some((node) => node.id === "intent:problem"));
  assert.ok(context.whereUsed.some((node) => node.id === "business:free-plan"));
  assert.ok(context.impact.some((node) => node.id === "architecture:framework"));
});

test("compare returns structural changes", () => {
  const { graph } = fixture();
  const candidate = structuredClone(graph);
  candidate.nodes[0].title = "Changed intent";
  candidate.nodes.push({ id: "product:new", type: "feature", region: "product", title: "New feature", data: {} });
  const result = compareGraphs(graph, candidate);
  assert.equal(result.nodesChanged.length, 1);
  assert.equal(result.nodesAdded.length, 1);
});
