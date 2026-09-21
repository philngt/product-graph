import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyCommand } from "../src/commands.ts";
import { copyDirectory, loadGraph } from "../src/io.ts";

function fixture() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-command-")); copyDirectory(path.resolve("templates/default"), dir); return loadGraph(dir); }

test("commands create, update and remove graph entities", () => {
  let graph = fixture();
  graph = applyCommand(graph, { type: "create-node", node: { id: "domain:test", type: "entity", region: "domain", title: "Test entity", data: {} } });
  graph = applyCommand(graph, { type: "update-node", id: "domain:test", patch: { status: "active" } });
  assert.equal(graph.nodes.find((node) => node.id === "domain:test")?.status, "active");
  graph = applyCommand(graph, { type: "create-edge", edge: { id: "edge:test", kind: "relates-to", from: "domain:test", to: "domain:project" } });
  assert.ok(graph.edges.some((edge) => edge.id === "edge:test"));
  graph = applyCommand(graph, { type: "delete-node", id: "domain:test" });
  assert.equal(graph.nodes.some((node) => node.id === "domain:test"), false);
  assert.equal(graph.edges.some((edge) => edge.id === "edge:test"), false);
});

test("commands reject dangling edge endpoints", () => {
  assert.throws(() => applyCommand(fixture(), { type: "create-edge", edge: { id: "edge:bad", kind: "relates-to", from: "missing", to: "domain:project" } }), /endpoints/);
});
