import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { selectSubgraph } from "../src/focus.ts";
import { copyDirectory, loadGraph } from "../src/io.ts";

test("focus selects a bounded semantic neighborhood", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-focus-"));
  copyDirectory(path.resolve("templates/default"), dir);
  const graph = loadGraph(dir);
  const focused = selectSubgraph(graph, { rootIds: ["intent:problem"], depth: 1 });
  assert.deepEqual(focused.nodes.map((node) => node.id).sort(), ["intent:problem", "product:graph-workspace"]);
  assert.equal(focused.edges.length, 1);
});
