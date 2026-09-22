import test from "node:test";
import assert from "node:assert/strict";
import { navigate, navigationSnapshot, neighborhood, projectScope, projectView, regionOf, travel } from "../ui/studio-state.js";

const graph = {
  nodes: [
    { id: "feature", region: "product", type: "feature", title: "Rotation" },
    { id: "step", region: "workflow", type: "step", title: "Recommend next" },
    { id: "rule", region: "domain", type: "rule", title: "Cooldown" },
    { id: "store", region: "architecture", type: "module", title: "Persistence" },
    { id: "decision", region: "decision", type: "decision", title: "Offline only" },
    { id: "other", region: "product", type: "feature", title: "Collection" },
  ],
  edges: [
    { id: "e1", from: "feature", to: "step" },
    { id: "e2", from: "step", to: "rule" },
    { id: "e3", from: "rule", to: "store" },
    { id: "e4", from: "decision", to: "store" },
  ],
};
const focus = { id: "rotation", title: "Rotation", rootIds: ["feature"], depth: 2 };
const makeState = () => ({ scope: projectScope(), view: "overview", selectedId: null, search: "", scopeBack: [], scopeForward: [], graph: structuredClone(graph), history: ["edit"], future: [], dirty: true });

test("selecting an object does not refocus or add navigation history", () => {
  const state = makeState();
  navigate(state, { scope: focus, selectedId: "feature" });
  state.selectedId = "rule";
  assert.equal(state.scope.id, "rotation");
  assert.equal(state.scopeBack.length, 1);
});

test("lens changes preserve focus, selection, search and unsaved edits", () => {
  const state = makeState();
  navigate(state, { scope: focus, selectedId: "rule", search: "Cooldown" });
  navigate(state, { view: "architecture" });
  assert.deepEqual(state.scope, focus);
  assert.equal(state.selectedId, "rule");
  assert.equal(state.search, "Cooldown");
  assert.equal(state.dirty, true);
  assert.deepEqual(state.history, ["edit"]);
  assert.deepEqual(state.graph, graph);
});

test("back/forward restore scope, lens, depth, selection and search together", () => {
  const state = makeState();
  navigate(state, { scope: focus, view: "domain", selectedId: "rule", search: "Cooldown" });
  const before = navigationSnapshot(state);
  navigate(state, { scope: projectScope(), search: "" });
  assert.ok(travel(state, "back"));
  assert.deepEqual(navigationSnapshot(state), before);
  assert.ok(travel(state, "forward"));
  assert.equal(state.scope.id, "project");
  assert.equal(state.view, "domain");
  assert.equal(state.selectedId, "rule");
});

test("new navigation clears forward; repeated navigation does not create history", () => {
  const state = makeState();
  assert.equal(navigate(state, { view: "overview" }), false);
  navigate(state, { scope: focus });
  travel(state, "back");
  navigate(state, { view: "workflow" });
  assert.equal(state.scopeForward.length, 0);
  assert.equal(travel(state, "forward"), false);
});

test("history owns root arrays; isolation cannot mutate the configured focus area", () => {
  const area = structuredClone(focus);
  const state = makeState();
  navigate(state, { scope: area });
  area.rootIds.push("other");
  assert.deepEqual(state.scope.rootIds, ["feature"]);
  navigate(state, { scope: { id: "focus:rule", title: "Cooldown", rootIds: ["rule"], depth: 0 }, selectedId: "rule" });
  state.scope.rootIds.push("store");
  travel(state, "back");
  assert.deepEqual(state.scope.rootIds, ["feature"]);
  assert.equal(state.scope.depth, 2);
});

test("navigation history is bounded", () => {
  const state = makeState();
  for (let i = 0; i < 140; i++) navigate(state, { search: String(i) });
  assert.equal(state.scopeBack.length, 100);
});

test("projection reports scope boundaries independently of lens and search", () => {
  const state = { ...makeState(), scope: focus, view: "domain", selectedId: "feature" };
  const result = projectView(graph, state);
  assert.deepEqual(result.nodes.map((node) => node.id), ["step", "rule"]);
  assert.equal(result.scopeNodeCount, 3);
  assert.equal(result.hiddenByLens, 1);
  assert.deepEqual(result.boundaryEdges.map((edge) => edge.id), ["e3"]);
  assert.equal(result.selectionVisibility, "hidden-by-lens");
  const searched = projectView(graph, { ...state, search: "Cooldown", selectedId: "step" });
  assert.equal(searched.hiddenBySearch, 1);
  assert.equal(searched.selectionVisibility, "hidden-by-search");
  assert.equal(searched.boundaryEdges.length, 1);
});

test("outside-scope selection remains selected without silently expanding", () => {
  const state = { ...makeState(), scope: focus, selectedId: "store" };
  const result = projectView(graph, state);
  assert.equal(result.selectionVisibility, "outside-scope");
  assert.equal(state.selectedId, "store");
  assert.equal(result.nodes.length, 3);
});

test("missing or empty focus roots never fall back to all models", () => {
  for (const rootIds of [["deleted"], []]) {
    const result = projectView(graph, { ...makeState(), scope: { ...focus, rootIds }, selectedId: "deleted" });
    assert.equal(result.nodes.length, 0);
    assert.equal(result.selectionVisibility, "missing");
  }
});

test("All models expands scope while keeping the current lens", () => {
  const state = { ...makeState(), scope: focus, view: "architecture" };
  navigate(state, { scope: projectScope() });
  const result = projectView(graph, state);
  assert.equal(state.view, "architecture");
  assert.deepEqual(result.nodes.map((node) => node.id), ["rule", "store"]);
  assert.equal(result.boundaryEdges.length, 0);
});

test("project Decisions lens only shows decisions", () => {
  const state = { ...makeState(), view: "decisions" };
  assert.deepEqual(projectView(graph, state).nodes.map((node) => node.id), ["decision"]);
});

test("depth zero isolates roots; traversal handles cycles and dangling edges", () => {
  const candidate = { ...graph, edges: [...graph.edges, { from: "rule", to: "feature" }, { from: "feature", to: "missing" }] };
  assert.deepEqual([...neighborhood(candidate, ["feature"], 0)], ["feature"]);
  assert.equal(neighborhood(candidate, ["feature"], 8).size, 5);
  assert.equal(neighborhood(candidate, ["missing"], 2).size, 0);
});

test("projection only renders edges whose endpoints are visible", () => {
  const state = { ...makeState(), scope: focus, view: "domain" };
  assert.deepEqual(projectView(graph, state).edges.map((edge) => edge.id), ["e2"]);
});

test("navigation and filtering do not delete or rewrite canonical data", () => {
  const before = JSON.stringify(graph);
  const state = makeState();
  navigate(state, { scope: focus, view: "domain", search: "nothing" });
  projectView(graph, state);
  travel(state, "back");
  assert.equal(JSON.stringify(graph), before);
  assert.deepEqual(state.graph, graph);
});

test("legacy layer nodes keep their existing region mapping", () => {
  assert.equal(regionOf({ layer: "document" }), "experience");
  assert.equal(regionOf({ layer: "roadmap" }), "product");
  assert.equal(regionOf({ region: "domain", layer: "roadmap" }), "domain");
});

test("multi-root scope and search are deterministic", () => {
  const state = { ...makeState(), scope: { ...focus, rootIds: ["feature", "other"], depth: 0 }, search: "  COLLECTION  " };
  assert.deepEqual(projectView(graph, state).nodes.map((node) => node.id), ["other"]);
});
