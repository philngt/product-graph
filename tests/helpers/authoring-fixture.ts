import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProjectRegistry } from "../../src/project-registry.ts";
import { loadGraph, saveGraph, writeJson } from "../../src/io.ts";
import { graphFingerprint } from "../../src/revision.ts";
import { emptyBoard, loadSketch, saveSketch, type SketchBoard } from "../../src/visual-authoring.ts";

export function fixture(t: { after: (fn: () => void) => void }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pg-authoring-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const registry = new ProjectRegistry(home), project = registry.create("Fragrance Rotation", "Offline personal collection");
  const root = project.root, graph = loadGraph(root);
  graph.nodes.push(
    { id: "feature:rotation", region: "product", type: "feature", title: "Recommend next", status: "draft" },
    { id: "constraint:offline", region: "intent", type: "constraint", title: "No network required", status: "active" },
    { id: "test:rotation", region: "quality", type: "acceptance-criterion", title: "No recently used bottle", status: "draft" },
  );
  graph.edges.push({ id: "edge:test", from: "feature:rotation", to: "test:rotation", kind: "verified-by" });
  graph.documents.push({ id: "document:rules", path: "documents/rules.md", title: "Rotation rules", links: ["feature:rotation"] });
  saveGraph(root, graph);
  fs.writeFileSync(path.join(root, "documents/rules.md"), "# Rotation rules\n\n## Rule\n\nAvoid recently used bottles.\n\n## Rationale\n\nUse the collection intentionally.\n");
  const board: SketchBoard = { ...emptyBoard(), notes: [
    { id: "feature-note", kind: "note", text: "Recommend the next bottle", x: 30, y: 40 },
    { id: "rule-note", kind: "assumption", text: "Avoid bottles used in the past 7 days", x: 330, y: 40 },
    { id: "question-note", kind: "question", text: "What happens when all bottles are excluded?", x: 630, y: 40 },
  ], links: [{ id: "arrow", from: "rule-note", to: "feature-note" }] };
  saveSketch(root, { expectedRevision: loadSketch(root).boardRevision, board });
  const input = () => ({ title: "Define rotation", expectedBoardRevision: loadSketch(root).boardRevision, expectedGraphRevision: graphFingerprint(loadGraph(root)), mappings: [
    { noteId: "feature-note", existingNodeId: "feature:rotation", interpretationConfirmed: false },
    { noteId: "rule-note", kind: "rule", title: "Seven-day cooldown", interpretationConfirmed: true },
  ], relations: [{ from: "rule-note", to: "feature-note", kind: "constrains" }] });
  return { home, registry, project, root, graph, board, input, writeJson };
}
