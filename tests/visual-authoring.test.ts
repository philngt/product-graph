import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { applyCommands } from "../src/commands.ts";
import { loadGraph } from "../src/io.ts";
import { defineSketch, validateBoard, saveSketch, loadSketch, createSketchProposal, sketchOriginCurrent } from "../src/visual-authoring.ts";
import { fixture } from "./helpers/authoring-fixture.ts";

test("sketch source is saved independently of semantic graph", t => {
  const f = fixture(t), before = loadGraph(f.root), current = loadSketch(f.root);
  current.board.notes[0].text = "An unresolved new thought";
  saveSketch(f.root, { expectedRevision: current.boardRevision, board: current.board });
  assert.deepEqual(loadGraph(f.root), before);
  assert.equal(loadSketch(f.root).board.notes[0].text, "An unresolved new thought");
});
test("explicit definition reuses objects and only creates declared semantic edges", t => {
  const f = fixture(t), graph = loadGraph(f.root), s = loadSketch(f.root);
  const p = defineSketch(graph, s.board, s.boardRevision, f.input(), "proposal:test");
  const result = applyCommands(graph, p.commands);
  assert.equal(result.nodes.length, graph.nodes.length + 1);
  assert.equal(result.edges.length, graph.edges.length + 1);
  const node = result.nodes.find(n => n.id === "domain:sketch-rule-note")!;
  assert.equal(node.status, "draft"); assert.equal(node.data?.description, f.board.notes[1].text);
  assert.equal(result.edges.at(-1)?.data?.executable, false);
  assert.deepEqual(p.authoring.sourceNotes.map(n => n.kind), ["note", "assumption"]);
  assert.equal(graph.nodes.some(n => n.id === node.id), false);
});
test("untyped arrows do not automatically become semantic edges", t => {
  const f = fixture(t), s = loadSketch(f.root), input = f.input(); input.relations = [];
  const p = defineSketch(loadGraph(f.root), s.board, s.boardRevision, input);
  assert.equal(p.commands.filter(c => c.type === "create-edge").length, 0);
});
test("assumptions require explicit acknowledgement", t => {
  const f = fixture(t), s = loadSketch(f.root), input = f.input(); input.mappings[1].interpretationConfirmed = false;
  assert.throws(() => defineSketch(loadGraph(f.root), s.board, s.boardRevision, input), /acknowledge/);
});
test("questions cannot be silently converted by an ordinary note mapping", t => {
  const f = fixture(t), s = loadSketch(f.root), input = f.input(); input.mappings[1].noteId = "question-note";
  input.mappings[1].interpretationConfirmed = false;
  assert.throws(() => defineSketch(loadGraph(f.root), s.board, s.boardRevision, input), /acknowledge/);
});
test("implementation contracts remain inert declarations", t => {
  const f = fixture(t), s = loadSketch(f.root), input = f.input() as any;
  input.mappings[1].inputs = "Bottle[]"; input.mappings[1].outputs = "Recommendation?"; input.mappings[1].implementationRef = "$(do-not-run) Score.swift";
  const p = defineSketch(loadGraph(f.root), s.board, s.boardRevision, input);
  const command = p.commands.find(c => c.type === "create-node") as any;
  assert.equal(command.node.data.implementationContract.executable, false);
  assert.equal(command.node.data.implementationContract.reference, "$(do-not-run) Score.swift");
});
test("new sketch proposals do not alter the graph and retain original notes", t => {
  const f = fixture(t), before = loadGraph(f.root), p = createSketchProposal(f.root, f.input());
  assert.deepEqual(loadGraph(f.root), before);
  assert.equal(p.proposal.status, "pending");
  const stored = JSON.parse(fs.readFileSync(path.join(f.root, `agent-context/proposals/${p.proposal.id}.json`), "utf8"));
  assert.equal(stored.authoring.sourceNotes[1].text, f.board.notes[1].text);
  assert.equal(sketchOriginCurrent(f.root, stored), true);
});
test("stale board saves do not overwrite another writer", t => {
  const f = fixture(t), first = loadSketch(f.root), second = loadSketch(f.root);
  first.board.notes[0].text = "New source"; saveSketch(f.root, { board: first.board, expectedRevision: first.boardRevision });
  assert.throws(() => saveSketch(f.root, { board: second.board, expectedRevision: second.boardRevision }), /changed on disk/);
  assert.equal(loadSketch(f.root).board.notes[0].text, "New source");
});
test("sketch edit invalidates a previously reviewed proposal", t => {
  const f = fixture(t), p = createSketchProposal(f.root, f.input()).proposal, current = loadSketch(f.root);
  current.board.notes[0].text = "Changed after proposal";
  saveSketch(f.root, { board: current.board, expectedRevision: current.boardRevision });
  assert.equal(sketchOriginCurrent(f.root, p), false);
});
test("board and graph revision mismatches fail before writing proposals", t => {
  const f = fixture(t);
  assert.throws(() => createSketchProposal(f.root, { ...f.input(), expectedBoardRevision: "wrong" }), /changed/);
  assert.throws(() => createSketchProposal(f.root, { ...f.input(), expectedGraphRevision: "wrong" }), /changed/);
  assert.equal(fs.readdirSync(path.join(f.root, "agent-context/proposals")).length, 0);
});
test("duplicate mappings, phantom sources, foreign objects and execution edges are rejected", t => {
  const f = fixture(t), s = loadSketch(f.root), g = loadGraph(f.root);
  const define = (input: unknown) => defineSketch(g, s.board, s.boardRevision, input);
  assert.throws(() => define({ ...f.input(), mappings: [f.input().mappings[0], f.input().mappings[0]] }), /distinct/);
  const input = f.input(); input.mappings[0].existingNodeId = "other-project:object";
  assert.throws(() => define(input), /not found/);
  assert.throws(() => define({ ...f.input(), relations: [{ from: "rule-note", to: "feature-note", kind: "run-shell" }] }), /semantic relationship/);
  assert.throws(() => define({ ...f.input(), mappings: [{ noteId: "absent", kind: "rule", title: "No source" }] }), /existing/);
});
test("board rejects duplicate IDs, dangling links, excessive coordinates and unknown kinds", t => {
  const f = fixture(t);
  assert.throws(() => validateBoard({ ...f.board, notes: [f.board.notes[0], f.board.notes[0]] }), /Duplicate/);
  assert.throws(() => validateBoard({ ...f.board, links: [{ id: "l", from: "absent", to: "feature-note" }] }), /endpoints/);
  assert.throws(() => validateBoard({ ...f.board, notes: [{ ...f.board.notes[0], x: Infinity }] }), /position/);
  assert.throws(() => validateBoard({ ...f.board, notes: [{ ...f.board.notes[0], kind: "approved" }] }), /kind/);
  assert.throws(() => validateBoard({ ...f.board, notes: Array(201).fill(f.board.notes[0]) }), /200/);
});
test("unrecognized sketch fields cannot smuggle semantic or execution metadata", t => {
  const f = fixture(t);
  const b = validateBoard({ ...f.board, links: [{ ...f.board.links[0], kind: "exec", approved: true }], nodes: [{ id: "evil" }] });
  assert.deepEqual(Object.keys(b.links[0]).sort(), ["from", "id", "to"]);
  assert.equal((b as any).nodes, undefined);
});
test("sketch revision is bound to project location and identity", t => {
  const f = fixture(t), p2 = f.registry.create("Another project"), revision = loadSketch(f.root).boardRevision;
  assert.notEqual(loadSketch(p2.root).boardRevision, revision);
  assert.throws(() => saveSketch(p2.root, { expectedRevision: revision, board: f.board }), /changed/);
});
test("sketch symlinks are rejected, no outside file is overwritten", t => {
  const f = fixture(t), victim = path.join(f.home, "outside.json");
  fs.writeFileSync(victim, '{"outside":true}'); fs.unlinkSync(path.join(f.root, "sketches/board.json")); fs.symlinkSync(victim, path.join(f.root, "sketches/board.json"));
  assert.throws(() => loadSketch(f.root), /Symbolic/);
  assert.equal(fs.readFileSync(victim, "utf8"), '{"outside":true}');
});
