import { navigate, neighborhood, projectScope, projectView, regionOf, travel } from "./studio-state.js";

const VIEWS = ["overview", "product", "business", "workflow", "domain", "experience", "architecture", "verification", "decisions", "impact"];
const labels = { overview: "Overview", product: "Product", business: "Business", workflow: "Workflow", domain: "Domain", experience: "Experience", architecture: "Architecture", verification: "Verification", decisions: "Decisions", impact: "Related impact" };
const regions = ["intent", "product", "business", "workflow", "domain", "experience", "architecture", "decision", "quality"];
const colors = { intent: "#f4bc7a", product: "#75e0c2", business: "#ef9bca", workflow: "#e6b86a", domain: "#81c8ff", experience: "#90d7bb", architecture: "#bd9aff", decision: "#ff8d8d", quality: "#b8c8ff" };
const state = { graph: null, baseline: null, diagnostics: [], focusAreas: [], tours: [], library: { patterns: [], templates: [] }, proposals: [], scope: projectScope(), view: "overview", search: "", selectedId: null, context: null, compare: null, drawer: "context", dirty: false, history: [], future: [], layout: {}, scopeBack: [], scopeForward: [], tour: null, dragging: null, drawerOpen: false, busy: false, formId: null, formDirty: false, contextRequest: 0, contextError: "", drawerRequest: 0 };
const $ = (id) => document.getElementById(id);

async function request(url, options) { const response = await fetch(url, options); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Request failed"); return data; }
function scopeKey() { return `${state.scope.id}:${state.view}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function snapshot() { return { graph: clone(state.graph), layout: clone(state.layout) }; }
function restore(value) {
  state.graph = value.graph;
  state.layout = value.layout;
  state.formId = null;
  if (!selectedNode()) state.selectedId = null;
}

function nodeById(id) { return state.graph.nodes.find((node) => node.id === id); }
function relatedIds(ids, depth) { return neighborhood(state.graph, ids, depth); }

function scopedNodes() { return projectView(state.graph, state).nodes; }

function selectedNode() { return nodeById(state.selectedId); }
function commit(mutator) {
  if (state.busy || !discardDraft()) return false;
  state.history.push(snapshot());
  state.future = [];
  mutator();
  state.formId = null;
  markDirty();
  render();
  return true;
}

function undo() {
  if (state.busy || !state.history.length || !discardDraft()) return;
  state.future.push(snapshot());
  restore(state.history.pop());
  markDirty();
  render();
  toast("Undid last change");
}

function redo() {
  if (state.busy || !state.future.length || !discardDraft()) return;
  state.history.push(snapshot());
  restore(state.future.pop());
  markDirty();
  render();
  toast("Redid change");
}

function markDirty() {
  state.dirty = true;
  state.context = null;
  state.contextRequest += 1;
  state.contextError = "Context reflects saved files. Save the model to refresh it.";
  setStatus("Unsaved changes", true);
}

function setStatus(text, dirty = state.dirty) {
  $("save-state").textContent = state.busy ? "Saving…" : dirty ? "Unsaved changes" : state.formDirty ? "Object draft" : text;
  $("save-state").style.color = dirty || state.formDirty ? "#e6b86a" : "";
  $("save-button").disabled = state.busy;
  $("undo-button").disabled = state.busy || !state.history.length;
  $("redo-button").disabled = state.busy || !state.future.length;
  $("back-button").disabled = !state.scopeBack.length;
  $("forward-button").disabled = !state.scopeForward.length;
}

function toast(message) { const node = $("toast"); node.textContent = message; node.classList.add("show"); setTimeout(() => node.classList.remove("show"), 2300); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function trim(value, length) { return value.length > length ? `${value.slice(0, length - 1)}…` : value; }

function renderFocusAreas() {
  $("focus-area-list").innerHTML = `<button class="layer-button ${state.scope.id === "project" ? "active" : ""}" data-focus="project" type="button"><i class="layer-icon"></i><span class="layer-label">Entire project</span><span class="layer-number">${state.graph.nodes.length}</span></button>` + state.focusAreas.map((area) => `<button class="layer-button ${state.scope.id === area.id ? "active" : ""}" data-focus="${escapeHtml(area.id)}" type="button"><i class="layer-icon"></i><span class="layer-label"><strong>${escapeHtml(area.title)}</strong><small>${escapeHtml(area.description || "Focus area")}</small></span><span class="layer-number">${relatedIds(area.rootIds, area.depth).size}</span></button>`).join("");
  document.querySelectorAll("[data-focus]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.focus === "project") return allModels();
    const area = state.focusAreas.find((item) => item.id === button.dataset.focus);
    if (area) setScope({ id: area.id, title: area.title, rootIds: area.rootIds, depth: area.depth });
  }));
  $("node-count").textContent = `${state.graph.nodes.length} nodes`;
}

function renderLenses() {
  $("lens-list").innerHTML = VIEWS.map((view) => `<button class="lens-button ${state.view === view ? "active" : ""}" data-lens="${view}" aria-pressed="${state.view === view}" type="button">${labels[view]}</button>`).join("");
  document.querySelectorAll("[data-lens]").forEach((button) => button.addEventListener("click", () => {
    navigateUI({ view: button.dataset.lens });
    document.querySelector(`[data-lens="${state.view}"]`)?.focus();
  }));
}

function renderNodeList() { const nodes = scopedNodes(); $("node-list").innerHTML = nodes.length ? nodes.map((node) => `<button class="node-button ${node.id === state.selectedId ? "active" : ""}" data-node="${escapeHtml(node.id)}" type="button"><i class="layer-icon" style="background:${colors[regionOf(node)] || "#91a0b4"}"></i><span class="node-copy"><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(regionOf(node))} · ${escapeHtml(node.type)}</small></span></button>`).join("") : `<p class="muted" style="padding:.5rem">No objects in this scope/lens.</p>`; document.querySelectorAll("[data-node]").forEach((button) => button.addEventListener("click", () => selectNode(button.dataset.node))); }
function positionFor(node, index) { const stored = state.layout[scopeKey()]?.positions?.[node.id]; if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return stored; return { x: 150 + (index % 3) * 285, y: 120 + Math.floor(index / 3) * 145 }; }
function renderGraph() { const svg = $("graph-svg"); const nodes = scopedNodes(); svg.setAttribute("viewBox", `0 0 1000 ${Math.max(680, 160 + Math.ceil(nodes.length / 3) * 145)}`); const positioned = nodes.map((node, index) => ({ node, ...positionFor(node, index) })); const byId = new Map(positioned.map((item) => [item.node.id, item])); $("empty-state").hidden = nodes.length > 0; $("active-layer").textContent = `${state.scope.title} · ${labels[state.view]}`.toUpperCase(); $("scope-title").textContent = state.scope.title; $("canvas-summary").textContent = `${nodes.length} visible objects · ${state.scope.id === "project" ? "project scope" : `focus depth ${state.scope.depth}`}`; const edges = state.graph.edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to)); svg.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#496274"></path></marker></defs>` + edges.map((edge) => { const a = byId.get(edge.from); const b = byId.get(edge.to); const active = state.selectedId === edge.from || state.selectedId === edge.to; return `<line class="edge-line ${active ? "highlight" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`; }).join("") + positioned.map(({ node, x, y }) => `<g class="graph-node ${node.id === state.selectedId ? "selected" : ""}" data-graph-node="${escapeHtml(node.id)}" transform="translate(${x - 100},${y - 30})" tabindex="0" role="button" aria-label="${escapeHtml(node.title)}, ${escapeHtml(regionOf(node))} node"><rect class="node-card" width="200" height="60" rx="10"></rect><line class="node-accent accent-${regionOf(node)}" x1="2" y1="10" x2="2" y2="50"></line><text class="node-title" x="17" y="27">${escapeHtml(trim(node.title, 24))}</text><text class="node-type" x="17" y="45">${escapeHtml(regionOf(node))} · ${escapeHtml(node.type)}</text></g>`).join(""); document.querySelectorAll("[data-graph-node]").forEach((node) => { node.addEventListener("click", () => selectNode(node.dataset.graphNode)); node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNode(node.dataset.graphNode); } }); node.addEventListener("pointerdown", (event) => startDrag(event, node.dataset.graphNode)); }); }
function startDrag(event, id) {
  if (event.button !== 0 || state.busy) return;
  const before = snapshot();
  const key = scopeKey();
  let moved = false;
  const move = (moveEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return;
    if (!moved && Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY) < 4) return;
    const svg = $("graph-svg");
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    moved = true;
    const point = new DOMPoint(moveEvent.clientX, moveEvent.clientY).matrixTransform(matrix.inverse());
    state.layout[key] ||= { schemaVersion: "1.0.0", positions: {} };
    state.layout[key].positions[id] = { x: point.x, y: point.y, pinned: true };
    renderGraph();
  };
  const end = (endEvent) => {
    if (endEvent.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    if (endEvent.type === "pointercancel") {
      if (moved) state.layout = before.layout;
      renderGraph();
      return;
    }
    if (!moved) { selectNode(id); return; }
    state.history.push(before);
    state.future = [];
    markDirty();
    render();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}

function selectNode(id) {
  if (!nodeById(id) || (id !== state.selectedId && !discardDraft())) return;
  state.selectedId = id;
  state.context = null;
  render();
  refreshContext();
}

function discardDraft() {
  if (!state.formDirty) return true;
  if (!confirm("Discard unapplied object edits? Apply changes first to keep them in the model.")) return false;
  state.formDirty = false;
  state.formId = null;
  return true;
}

async function refreshContext() {
  const token = ++state.contextRequest;
  const id = state.selectedId;
  state.context = null;
  state.contextError = state.dirty ? "Context reflects saved files. Save the model to refresh it." : "";
  renderInspector();
  if (!id || !selectedNode() || state.dirty) return;
  try {
    const response = await request(`/api/context?rootId=${encodeURIComponent(id)}&depth=${state.scope.depth}`);
    if (token !== state.contextRequest || id !== state.selectedId) return;
    state.context = response.context;
    renderInspector();
  } catch (error) {
    if (token !== state.contextRequest) return;
    state.contextError = error.message;
    renderInspector();
  }
}

function navigateUI(patch) {
  const nextId = Object.hasOwn(patch, "selectedId") ? patch.selectedId : state.selectedId;
  if (nextId !== state.selectedId && !discardDraft()) return false;
  if (!navigate(state, patch)) return false;
  afterNavigation();
  return true;
}

function afterNavigation() {
  if (!selectedNode()) state.selectedId = null;
  state.context = null;
  $("search").value = state.search;
  render();
  refreshContext();
}

function travelUI(direction) {
  const target = (direction === "back" ? state.scopeBack : state.scopeForward).at(-1);
  if (!target || (target.selectedId !== state.selectedId && !discardDraft())) return;
  if (travel(state, direction)) afterNavigation();
}

function allModels() { navigateUI({ scope: projectScope(), search: "" }); }

function setScope(scope, view = state.view) {
  return navigateUI({ scope, view, selectedId: scope.rootIds[0] || state.selectedId, search: "" });
}

function renderInspector() { const node = selectedNode(); const form = $("node-form"); $("inspector-empty").hidden = Boolean(node); form.hidden = !node; $("context-sections").hidden = !node; $("selection-type").textContent = node ? `${regionOf(node)} / ${node.type}` : "No selection"; if (!node) { state.formId = null; $("edge-list").textContent = "Select a node to see relationships."; return; } if (state.formId !== node.id) { state.formId = node.id; state.formDirty = false; $("node-title").value = node.title; $("node-id").value = node.id; $("node-type").value = node.type; $("node-status").value = node.status || ""; $("node-data").value = JSON.stringify(node.data || {}, null, 2); $("node-region").innerHTML = regions.map((region) => `<option value="${region}" ${regionOf(node) === region ? "selected" : ""}>${region}</option>`).join(""); } const edges = state.graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id); $("edge-list").innerHTML = edges.length ? edges.map((edge) => `<div class="edge-item"><strong>${escapeHtml(edge.kind)}</strong><br>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}</div>`).join("") : `<span class="muted">No relationships yet.</span>`; const context = state.context; if (!context) { ["why-list", "where-list", "impact-list", "source-list"].forEach((id) => $(id).innerHTML = `<span class="muted">${escapeHtml(state.contextError || "Loading saved context…")}</span>`); return; } renderContextList("why-list", context.why, "No intent or rationale linked yet."); renderContextList("where-list", context.whereUsed, "No other usage found in this scope."); renderContextList("impact-list", context.impact, "No related objects found."); renderContextList("source-list", [...context.decisions, ...context.evidence], "No decisions or evidence linked yet."); }
function renderContextList(id, items, empty) { $(id).innerHTML = items.length ? items.slice(0, 8).map((item) => `<div class="context-item"><button data-node="${escapeHtml(item.id)}" type="button"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(regionOf(item))} · ${escapeHtml(item.type)}</span></button></div>`).join("") : `<span class="muted">${empty}</span>`; document.querySelectorAll(`#${id} [data-node]`).forEach((button) => button.addEventListener("click", () => selectNode(button.dataset.node))); }
function renderValidation() { const diagnostics = state.diagnostics || []; $("validation-count").textContent = `${diagnostics.length} issue${diagnostics.length === 1 ? "" : "s"}`; $("validation-list").innerHTML = diagnostics.length ? diagnostics.slice(0, 8).map((item) => `<div class="edge-item"><strong>${escapeHtml(item.code || item.level)}</strong><br>${escapeHtml(item.message)}</div>`).join("") : `<span class="muted">No issues in the last saved validation.</span>`; }


async function renderAgentDrawer() {
  const generation = ++state.drawerRequest;
  if (!state.drawerOpen) return;
  const content = $("drawer-content");
  if (state.drawer === "proposals") {
    content.innerHTML = state.proposals.length ? state.proposals.map((proposal) => `<div class="drawer-card"><strong>${escapeHtml(proposal.title)}</strong><br><span class="muted">${escapeHtml(proposal.status || "pending")} · ${escapeHtml(proposal.source || "agent")}</span><p>${escapeHtml(proposal.rationale || "No rationale provided.")}</p><button type="button" data-proposal-preview="${escapeHtml(proposal.id)}">Preview</button> <button type="button" data-proposal-apply="${escapeHtml(proposal.id)}" ${proposal.status !== "pending" || state.busy ? "disabled" : ""}>Apply</button> <button type="button" data-proposal-reject="${escapeHtml(proposal.id)}" ${proposal.status !== "pending" || state.busy ? "disabled" : ""}>Reject</button><div id="proposal-detail-${escapeHtml(proposal.id)}"></div></div>`).join("") : `<span class="muted">No agent proposals.</span>`;
    document.querySelectorAll("[data-proposal-preview]").forEach((button) => button.addEventListener("click", () => previewProposal(button.dataset.proposalPreview)));
    document.querySelectorAll("[data-proposal-apply]").forEach((button) => button.addEventListener("click", () => applyProposal(button.dataset.proposalApply)));
    document.querySelectorAll("[data-proposal-reject]").forEach((button) => button.addEventListener("click", () => rejectProposal(button.dataset.proposalReject)));
    return;
  }
  if (state.drawer === "context") {
    content.innerHTML += `<div class="drawer-card"><strong>Agent context</strong>Markdown is generated from the canonical JSON graph for the current project and focus.</div>`;
  }
  await renderDrawerOriginal(content, generation);
}
async function renderDrawerOriginal(content, generation) {
  if (state.drawer === "context") { content.innerHTML = `<div class="drawer-card"><strong>Current scope</strong>${escapeHtml(state.scope.title)}<br>Depth ${state.scope.depth}</div><div class="drawer-card"><strong>Editing model</strong>Changes are direct, traceable and undoable.</div><div class="drawer-card"><strong>Agent context</strong>Markdown is generated from the canonical JSON graph for the current project and focus.</div>`; return; }
  if (state.drawer === "compare") { try { state.compare = await request("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base: state.baseline, candidate: state.graph }) }); if (generation !== state.drawerRequest || !state.drawerOpen || state.drawer !== "compare") return; const c = state.compare; content.innerHTML = `<div class="drawer-card"><strong>Changes</strong>${c.nodesAdded.length} added · ${c.nodesRemoved.length} removed · ${c.nodesChanged.length} changed nodes</div><div class="drawer-card"><strong>Relationships</strong>${c.edgesAdded.length} added · ${c.edgesRemoved.length} removed</div>`; } catch (error) { if (generation === state.drawerRequest) content.textContent = error.message; } return; }
  if (state.drawer === "library") { const cards = [...state.library.patterns.map((item) => ({ ...item, kind: "Pattern" })), ...state.library.templates.map((item) => ({ ...item, kind: "Template" }))]; content.innerHTML = cards.length ? cards.map((item) => `<div class="drawer-card"><strong>${escapeHtml(item.kind)} · ${escapeHtml(item.title)}</strong>${escapeHtml(item.problem || item.target || "Reusable knowledge for the current scope.")}<br><button type="button" data-library="${escapeHtml(item.id)}">Preview in scope</button></div>`).join("") : `<span class="muted">Library is empty.</span>`; document.querySelectorAll("[data-library]").forEach((button) => button.addEventListener("click", () => toast(`Preview ${button.dataset.library} for ${state.scope.title}`))); return; }
  const tour = state.tour?.tour || state.tours[0]; if (!tour) { content.innerHTML = `<span class="muted">No guided tours configured.</span>`; return; } if (!state.tour) content.innerHTML = `<div class="drawer-card"><strong>${escapeHtml(tour.title)}</strong>${tour.steps.length} semantic steps<br><button id="start-tour" type="button">Start tour</button></div>`; else content.innerHTML = `<div class="drawer-card"><strong>${escapeHtml(tour.title)}</strong>Step ${state.tour.index + 1} of ${tour.steps.length}<br>${escapeHtml(tour.steps[state.tour.index].explanation)}<br><button id="tour-back" type="button" ${state.tour.index === 0 ? "disabled" : ""}>Back</button> <button id="tour-next" type="button">${state.tour.index === tour.steps.length - 1 ? "Finish" : "Next"}</button></div>`; $("start-tour")?.addEventListener("click", () => startTour(tour)); $("tour-back")?.addEventListener("click", () => { state.tour.index -= 1; showTourStep(); }); $("tour-next")?.addEventListener("click", () => { if (state.tour.index >= tour.steps.length - 1) { state.tour = null; render(); toast("Tour complete"); } else { state.tour.index += 1; showTourStep(); } });
}
async function previewProposal(id) { try { const result = await request(`/api/proposals/${encodeURIComponent(id)}/preview`, { method: "POST" }); const target = $(`proposal-detail-${id}`); if (target) target.innerHTML = `<p><strong>Preview</strong> ${result.diff.nodesAdded.length} added · ${result.diff.nodesChanged.length} changed · ${result.diff.edgesAdded.length} relationships</p><p>${result.canApply ? "Ready for human approval." : "Cannot apply: stale or invalid."}</p>${result.diagnostics.length ? `<p class="muted">${result.diagnostics.map((item) => escapeHtml(item.message)).join("<br>")}</p>` : ""}`; } catch (error) { toast(error.message); } }
async function applyProposal(id) {
  if (state.busy) return;
  if (state.dirty || state.formDirty) return toast("Apply object edits and save your model before applying a proposal.");
  if (!confirm("Apply this agent proposal to the canonical graph?")) return;
  state.busy = true;
  render();
  try {
    const result = await request(`/api/proposals/${encodeURIComponent(id)}/apply`, { method: "POST" });
    state.graph = result.graph;
    state.baseline = clone(result.graph);
    state.diagnostics = result.diagnostics || [];
    state.proposals = state.proposals.map((item) => item.id === id ? result.proposal : item);
    state.history = [];
    state.future = [];
    state.formId = null;
    state.dirty = false;
    if (!selectedNode()) state.selectedId = null;
    toast("Proposal applied");
  } catch (error) {
    toast(error.message);
    try { await refreshProposals(); } catch { /* Preserve the original failure. */ }
  } finally {
    state.busy = false;
    render();
    refreshContext();
  }
}

async function rejectProposal(id) { if (state.busy) return; try { const result = await request(`/api/proposals/${encodeURIComponent(id)}/reject`, { method: "POST" }); state.proposals = state.proposals.map((item) => item.id === id ? result.proposal : item); render(); toast("Proposal rejected"); } catch (error) { toast(error.message); } }
async function refreshProposals() { const result = await request("/api/proposals"); state.proposals = result.proposals || []; }
function startTour(tour) {
  if (!tour.steps.length || !discardDraft()) return;
  state.tour = { tour, index: 0 };
  openDrawer("tour");
  showTourStep();
}

function showTourStep() {
  const step = state.tour.tour.steps[state.tour.index];
  const area = state.focusAreas.find((item) => item.id === step.scopeId);
  const scope = area ? { id: area.id, title: area.title, rootIds: area.rootIds, depth: area.depth } : state.scope;
  navigateUI({ scope, view: step.lens, selectedId: step.nodeId, search: "" });
  toast(`${state.tour.index + 1}/${state.tour.tour.steps.length}: ${step.explanation}`);
}

function render() {
  renderFocusAreas();
  renderLenses();
  renderNodeList();
  renderGraph();
  renderInspector();
  renderValidation();
  renderScopeStatus();
  $("scope-breadcrumb").textContent = `Project / ${state.scope.title} / ${labels[state.view]}`;
  $("drawer-content").hidden = !state.drawerOpen;
  $("drawer-toggle").textContent = state.drawerOpen ? "Hide details" : "Show details";
  $("drawer-toggle").setAttribute("aria-expanded", String(state.drawerOpen));
  document.querySelectorAll("[data-drawer]").forEach((button) => button.classList.toggle("active", state.drawerOpen && button.dataset.drawer === state.drawer));
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const tool = button.dataset.tool;
    button.classList.toggle("active", tool === "all" ? state.scope.id === "project" && state.view !== "decisions" : tool === "decisions" ? state.view === "decisions" : state.drawerOpen && state.drawer === (tool === "review" ? "proposals" : tool));
  });
  document.querySelectorAll("#node-form input, #node-form select, #node-form textarea, #node-form button, #add-node, #add-edge, #context-refresh").forEach((element) => { element.disabled = state.busy; });
  setStatus(state.dirty ? "Unsaved changes" : "Ready");
  renderAgentDrawer();
}

function renderScopeStatus() {
  const projection = projectView(state.graph, state);
  const boundary = projection.boundaryEdges.length;
  $("scope-summary").textContent = `${projection.nodes.length} of ${projection.scopeNodeCount} objects shown · ${projection.hiddenByLens} hidden by lens · ${projection.hiddenBySearch} by search · ${boundary} relationships leave this scope`;
  const messages = {
    "outside-scope": "Selected object is outside this focus. Inspect it here, choose Focus here, or open All models.",
    "hidden-by-lens": "Selected object is hidden by this lens, not deleted. Switch to Overview to see it.",
    "hidden-by-search": "Selected object is hidden by search, not deleted. Clear search to see it.",
    missing: "The selected object no longer exists in the model.",
  };
  $("selection-visibility").textContent = messages[projection.selectionVisibility] || "";
  $("selection-visibility").hidden = !messages[projection.selectionVisibility];
  $("isolate-button").disabled = !selectedNode();
  $("expand-button").disabled = state.scope.id === "project" || state.scope.depth >= 8 || !state.scope.rootIds.length;
  const empty = $("empty-state");
  empty.querySelector("h2").textContent = projection.missingRoots.length ? "Focus object is missing" : state.search.trim() ? "No matching objects" : "Nothing defined in this lens";
  empty.querySelector("p").textContent = projection.missingRoots.length ? "Open All models or go Back. The rest of the graph has not been deleted." : projection.hiddenByLens || projection.hiddenBySearch ? "Change lens or clear search. Hidden objects remain in the same model." : "Create a node or link an existing model into this focus.";
  $("validation-count").textContent = `${state.diagnostics.length} saved issues${state.dirty ? " · needs recheck" : ""}`;
}

function openDrawer(drawer) {
  state.drawer = drawer;
  state.drawerOpen = true;
  render();
}

$("search").addEventListener("input", (event) => { state.search = event.target.value; render(); });
$("undo-button").addEventListener("click", undo);
$("redo-button").addEventListener("click", redo);
$("back-button").addEventListener("click", () => travelUI("back"));
$("forward-button").addEventListener("click", () => travelUI("forward"));
window.addEventListener("keydown", (event) => {
  if (event.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (state.dirty || state.formDirty) { event.preventDefault(); event.returnValue = ""; }
});
$("isolate-button").addEventListener("click", () => {
  const node = selectedNode();
  if (node) setScope({ id: `focus:${node.id}`, title: node.title, rootIds: [node.id], depth: 0 }, "overview");
});
$("expand-button").addEventListener("click", () => {
  if (state.scope.id !== "project") navigateUI({ scope: { ...state.scope, depth: Math.min(8, state.scope.depth + 1) } });
});
$("all-models-button").addEventListener("click", allModels);
$("clear-search-button").addEventListener("click", () => { state.search = ""; $("search").value = ""; render(); });
$("compare-button").addEventListener("click", () => openDrawer("compare"));
$("drawer-toggle").addEventListener("click", () => { state.drawerOpen = !state.drawerOpen; render(); });
document.querySelectorAll("[data-drawer]").forEach((button) => button.addEventListener("click", () => openDrawer(button.dataset.drawer)));
document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => {
  switch (button.dataset.tool) {
    case "all": allModels(); break;
    case "decisions": navigateUI({ scope: projectScope(), view: "decisions", search: "" }); break;
    case "library": openDrawer("library"); break;
    case "review": openDrawer("proposals"); break;
  }
}));
$("focus-here-button").addEventListener("click", () => {
  const node = selectedNode();
  if (node) setScope({ id: `focus:${node.id}`, title: node.title, rootIds: [node.id], depth: 2 });
});
$("context-refresh").addEventListener("click", refreshContext);
$("save-button").addEventListener("click", async () => {
  if (state.busy) return;
  if (state.formDirty) return toast("Apply object changes before saving the model.");
  const submitted = snapshot();
  state.busy = true;
  render();
  try {
    const response = await request("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submitted) });
    state.baseline = clone(submitted.graph);
    state.diagnostics = response.diagnostics || [];
    state.dirty = false;
    toast("Product model saved");
  } catch (error) { toast(error.message); }
  finally { state.busy = false; render(); refreshContext(); }
});
$("node-form").addEventListener("input", () => { state.formDirty = true; setStatus("Object draft"); });
$("node-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const node = selectedNode();
  if (!node || state.busy) return;
  try {
    const data = JSON.parse($("node-data").value || "{}");
    if (!data || Array.isArray(data) || typeof data !== "object") return toast("Metadata must be a JSON object.");
    const values = { title: $("node-title").value.trim(), type: $("node-type").value.trim(), region: $("node-region").value, status: $("node-status").value.trim() || undefined, data };
    if (!values.title || !values.type) return toast("Title and type are required.");
    state.formDirty = false;
    commit(() => Object.assign(node, values));
    toast("Product model updated");
  } catch { toast("Metadata must be valid JSON"); }
});
$("delete-node").addEventListener("click", () => {
  const node = selectedNode();
  if (!node || state.busy || !confirm(`Delete ${node.title}? Relationships will also be removed.`)) return;
  commit(() => {
    state.graph.nodes = state.graph.nodes.filter((item) => item.id !== node.id);
    state.graph.edges = state.graph.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
    state.selectedId = null;
  });
});
$("add-node").addEventListener("click", () => {
  if (state.busy || !discardDraft()) return;
  const root = state.scope.rootIds.map(nodeById).find(Boolean);
  if (state.scope.id !== "project" && !root) return toast("Choose an existing focus object or open All models first.");
  const title = prompt("Object title", "New product concept")?.trim();
  if (!title) return;
  const region = regions.includes(state.view) ? state.view : state.view === "verification" ? "quality" : state.view === "decisions" ? "decision" : "product";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
  const node = { id: `${region}:${slug}`, type: region === "domain" ? "concept" : region, region, title, status: "draft", data: {} };
  if (nodeById(node.id)) return toast("An object with this ID already exists");
  // The user chooses the relationship; never invent an edge just to make a node visible.
  const kind = root ? prompt(`Relationship from ${root.title} to ${title}`, "relates-to")?.trim() : null;
  if (root && !kind) return;
  commit(() => {
    state.graph.nodes.push(node);
    if (root) state.graph.edges.push({ id: `edge:${crypto.randomUUID()}`, kind, from: root.id, to: node.id });
    state.selectedId = node.id;
  });
  if (root && state.scope.depth === 0) navigateUI({ scope: { ...state.scope, depth: 1 }, search: "" });
  else { state.search = ""; $("search").value = ""; render(); }
});
$("add-edge").addEventListener("click", () => {
  const node = selectedNode();
  if (!node || state.busy || !discardDraft()) return;
  const target = prompt("Target object ID", state.graph.nodes.find((item) => item.id !== node.id)?.id || "");
  if (target === null) return;
  if (!nodeById(target)) return toast("Target object was not found");
  const kind = prompt("Relationship kind", "relates-to")?.trim();
  if (!kind) return;
  commit(() => state.graph.edges.push({ id: `edge:${crypto.randomUUID()}`, kind, from: node.id, to: target }));
});

async function boot() { try { const response = await request("/api/workspace"); state.graph = response.graph; state.baseline = clone(response.baseline || response.graph); state.layout = response.layout || {}; state.focusAreas = response.focusAreas || []; state.tours = response.tours || []; state.library = response.library || { patterns: [], templates: [] }; state.diagnostics = response.diagnostics || []; try { await refreshProposals(); } catch (error) { toast(`Proposals unavailable: ${error.message}`); } $("project-name").textContent = state.graph.manifest.name; render(); } catch (error) { $("project-name").textContent = "Unable to load project"; toast(error.message); } }
boot();
