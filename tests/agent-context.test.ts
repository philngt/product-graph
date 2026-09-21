import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildScopedContext } from "../src/context.ts";
import { copyDirectory, loadGraph, loadProposals, saveProposal } from "../src/io.ts";
import { graphFingerprint } from "../src/revision.ts";
import { applyProposal, previewProposal, type ProposalPatch } from "../src/proposals.ts";

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graph-agent-context-"));
  copyDirectory(path.resolve("templates/default"), dir);
  return { dir, graph: loadGraph(dir) };
}

test("scoped context preserves scope metadata and provenance", () => {
  const { graph } = fixture();
  const bundle = buildScopedContext(graph, { rootIds: ["product:graph-workspace"], scopeId: "focus:rotation", depth: 1 });
  assert.deepEqual(bundle.selector, { rootIds: ["product:graph-workspace"], depth: 1, scopeId: "focus:rotation" });
  assert.match(bundle.markdown, /Revision: sha256:/);
  assert.match(bundle.markdown, /product:graph-workspace/);
  assert.ok(bundle.json.nodes.every((node) => node.id === "product:graph-workspace" || node.id === "intent:problem" || node.id === "business:free-plan" || node.id === "experience:graph-canvas" || node.id === "workflow:develop" || node.id === "quality:graph-valid"));
});

test("proposal storage and stale protection preserve human approval boundary", () => {
  const { dir, graph } = fixture();
  const proposal: ProposalPatch = {
    id: "proposal:test",
    title: "Rename graph workspace",
    source: "agent",
    commands: [{ type: "update-node", id: "product:graph-workspace", patch: { title: "Updated graph workspace" } }],
    affectedIds: ["product:graph-workspace"],
    baseRevision: graphFingerprint(graph),
    status: "pending",
  };
  saveProposal(dir, proposal);
  assert.equal(loadProposals(dir).length, 1);
  const preview = previewProposal(graph, proposal);
  assert.equal(preview.graph.nodes.find((node) => node.id === "product:graph-workspace")?.title, "Updated graph workspace");
  assert.equal(graph.nodes.find((node) => node.id === "product:graph-workspace")?.title, "Graph workspace");
  const changed = structuredClone(graph);
  changed.nodes[0].title = "Concurrent human edit";
  assert.throws(() => applyProposal(changed, proposal), /stale/);
});
