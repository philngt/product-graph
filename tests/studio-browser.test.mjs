import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const browser = process.env.PRODUCT_GRAPH_BROWSER;
const uiRoot = fileURLToPath(new URL("../ui/", import.meta.url));

// Real UI and browser; API responses are fixtures. This is not a persistence/MCP integration test.
const fixture = {
  manifest: { name: "Studio regression fixture" },
  nodes: [
    { id: "feature", region: "product", type: "feature", title: "Rotation", data: {} },
    { id: "step", region: "workflow", type: "step", title: "Recommend next", data: {} },
    { id: "rule", region: "domain", type: "rule", title: "Cooldown", data: { days: 3 } },
    { id: "store", region: "architecture", type: "module", title: "Persistence", data: {} },
    { id: "decision", region: "decision", type: "decision", title: "Offline only", data: {} },
    { id: "other", region: "product", type: "feature", title: "Collection", data: {} },
  ],
  edges: [
    { id: "e1", kind: "contains", from: "feature", to: "step" },
    { id: "e2", kind: "uses", from: "step", to: "rule" },
    { id: "e3", kind: "implemented-by", from: "rule", to: "store" },
    { id: "e4", kind: "constrains", from: "decision", to: "store" },
  ],
  documents: [],
};

async function browserChecks() {
  const checks = [];
  const q = (selector) => document.querySelector(selector);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const click = (selector) => { const el = q(selector); if (!el) throw new Error(`Missing ${selector}`); el.click(); };
  const input = (selector, value) => { q(selector).value = value; q(selector).dispatchEvent(new Event("input", { bubbles: true })); };
  const nodes = () => document.querySelectorAll("[data-graph-node]").length;
  try {
    for (let i = 0; i < 100 && !q('[data-focus="rotation"]'); i++) await sleep(30);
    check(Boolean(q('[data-focus="rotation"]')), "Studio boots with fixture workspace");
    check(q("#drawer-content").hidden, "Supporting drawer starts collapsed");
    check(nodes() === 6, "Initial project scope shows all six objects");
    click('[data-focus="rotation"]');
    check(q("#scope-title").textContent === "Rotation", "Sidebar enters feature focus");
    check(!q("#back-button").disabled, "Sidebar navigation records history");
    check(nodes() === 3, "Feature neighborhood is bounded");
    check(q("#scope-summary").textContent.includes("1 relationships leave"), "Cross-scope relationship is disclosed");

    const svgNode = q('[data-graph-node="step"]');
    svgNode.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, button: 0, clientX: 100, clientY: 100 }));
    check(q("#save-state").textContent === "Ready", "A pointer click does not dirty layout");
    check(q("#node-id").value === "step" && q("#scope-title").textContent === "Rotation", "Selection does not refocus");

    click('[data-lens="domain"]');
    click('#node-list [data-node="rule"]');
    input("#search", "Cooldown");
    click("#all-models-button");
    check(q('[data-lens="domain"]').getAttribute("aria-pressed") === "true", "All models preserves lens");
    check(q("#scope-title").textContent === "Entire project", "All models actually expands scope");
    click("#back-button");
    check(q("#scope-title").textContent === "Rotation" && q("#search").value === "Cooldown" && q("#node-id").value === "rule", "Back restores focus, search and selection");
    click("#forward-button");
    check(q("#search").value === "" && q("#node-id").value === "rule", "Forward restores destination without discarding selection");

    click("#isolate-button");
    check(q("#scope-title").textContent === "Cooldown" && nodes() === 1, "Isolate creates a named depth-zero focus");
    click("#expand-button");
    check(nodes() === 3, "Expand adds one neighborhood hop");
    click("#back-button");
    check(nodes() === 1, "Back restores isolate depth");
    click("#back-button");
    check(q("#scope-title").textContent === "Entire project" && q('[data-lens="domain"]').classList.contains("active"), "Back restores pre-isolate scope and lens");

    // Force reversed context responses: rule is slower than step in the fixture server.
    click('#node-list [data-node="rule"]');
    click('#node-list [data-node="step"]');
    await sleep(250);
    check(q("#node-id").value === "step" && q("#where-list").textContent.includes("Recommend next") && !q("#where-list").textContent.includes("Cooldown"), "Late context cannot replace current selection context");
    input("#node-title", "Recommend draft");
    click('[data-lens="architecture"]');
    await sleep(250);
    check(q("#node-title").value === "Recommend draft", "Lens changes and context refresh preserve unapplied inspector input");
    check(!q("#selection-visibility").hidden && q("#selection-visibility").textContent.includes("hidden by this lens"), "Hidden selection is explained, not reset");
    window.confirm = () => false;
    click('[data-focus="rotation"]');
    check(q("#scope-title").textContent === "Entire project" && q("#node-title").value === "Recommend draft", "Cancelled draft discard cancels navigation");
    q("#node-form").requestSubmit();
    check(q("#save-state").textContent === "Unsaved changes", "Applying object edits changes only the local model");
    check(q("#where-list").textContent.includes("Save the model"), "Saved context is not misrepresented as current while dirty");

    click('[data-tool="review"]');
    click('[data-proposal-apply="proposal-1"]');
    const beforeSave = await (await fetch("/__qa")).json();
    check(beforeSave.proposalApplies === 0, "Proposal apply cannot discard unsaved local edits");
    click("#drawer-toggle");
    check(q("#drawer-content").hidden, "Drawer can be hidden again");
    click("#isolate-button");
    check(nodes() === 1, "Dirty model can still be explored through isolation");
    click("#save-button");
    for (let i = 0; i < 100 && q("#save-button").disabled; i++) await sleep(20);
    const saved = await (await fetch("/__qa")).json();
    check(saved.savedNodes === 6 && saved.savedTitle === "Recommend draft", "Save writes the whole edited graph, not just the visible projection");
    check(q("#save-state").textContent === "Ready", "Successful save clears dirty state");

    // Creation in a focus requires an explicit relationship, and remains undoable.
    const answers = ["Exception path", "contains"];
    window.prompt = () => answers.shift() ?? null;
    click("#add-node");
    check(q("#node-title").value === "Exception path" && nodes() >= 2, "Add to focus connects the new object and reveals it");
    click("#undo-button");
    check(![...document.querySelectorAll(".node-title")].some((el) => el.textContent === "Exception path"), "Undo removes the added object and relationship together");
    click("#redo-button");
    check([...document.querySelectorAll(".node-title")].some((el) => el.textContent === "Exception path"), "Redo restores the creation");

    click('[data-tool="decisions"]');
    check(nodes() === 1 && q(".node-title").textContent === "Offline only", "Decisions tool opens the actual decision projection");
    click('[data-tool="all"]');
    click('[data-lens="overview"]');
    click('#node-list [data-node="rule"]');
    click("#focus-here-button");
    window.confirm = () => true;
    click("#delete-node");
    check(nodes() === 0 && q("#empty-state h2").textContent === "Focus object is missing", "Deleting focus root does not silently reveal all models");
    click("#all-models-button");
    check(nodes() === 6, "Rest of graph remains accessible after deleting focus root");

    // Compare is async; a late result must not overwrite another drawer.
    click('[data-drawer="compare"]');
    click('[data-drawer="library"]');
    await sleep(300);
    check(q("#drawer-content").textContent.includes("Library is empty"), "Late compare result cannot overwrite Library");
    document.documentElement.dataset.studioSmoke = "passed";
  } catch (error) {
    document.documentElement.dataset.studioSmoke = "failed";
    checks.push(`FAIL: ${error.stack || error.message}`);
  }
  const report = document.createElement("pre");
  report.id = "studio-smoke-result";
  report.textContent = JSON.stringify(checks);
  document.body.append(report);
}

// In-memory responses keep the smoke test independent of sockets, MCP and disk writes.
function installFixture(fixture) {
  let graph = structuredClone(fixture);
  let proposalApplies = 0, savedNodes = 0, savedTitle = "", sequence = 0;
  // about:blank has no secure-origin UUID API; production localhost supplies it.
  if (!crypto.randomUUID) crypto.randomUUID = () => `fixture-${++sequence}`;
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, "http://fixture.test");
    const json = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
    if (url.pathname === "/__qa") return json({ proposalApplies, savedNodes, savedTitle });
    if (url.pathname === "/api/workspace") {
      if (options.method === "POST") {
        graph = JSON.parse(options.body).graph;
        savedNodes = graph.nodes.length;
        savedTitle = graph.nodes.find((node) => node.id === "step")?.title;
        return json({ graph, diagnostics: [] });
      }
      return json({ graph, focusAreas: [{ id: "rotation", title: "Rotation", rootIds: ["feature"], depth: 2 }], layout: {}, tours: [], library: { patterns: [], templates: [] }, diagnostics: [] });
    }
    if (url.pathname === "/api/proposals") return json({ proposals: [{ id: "proposal-1", title: "Agent change", status: "pending", source: "fixture", rationale: "Test unsaved guard" }] });
    if (url.pathname.endsWith("/apply")) { proposalApplies++; return json({}); }
    if (url.pathname === "/api/context") {
      const selected = graph.nodes.find((node) => node.id === url.searchParams.get("rootId"));
      await new Promise((resolve) => setTimeout(resolve, selected?.id === "rule" ? 100 : 5));
      return json({ context: { why: [], whereUsed: selected ? [selected] : [], decisions: [], evidence: [], impact: [] } });
    }
    if (url.pathname === "/api/compare") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return json({ nodesAdded: [], nodesRemoved: [], nodesChanged: [], edgesAdded: [], edgesRemoved: [] });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
}

test("Studio browser regression with in-memory fixture API", { skip: !browser, timeout: 40000 }, async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "product-graph-browser-"));
  const moduleURL = (text) => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
  const stateModule = moduleURL(fs.readFileSync(path.join(uiRoot, "studio-state.js"), "utf8"));
  const appModule = moduleURL(fs.readFileSync(path.join(uiRoot, "app.js"), "utf8").replace('"./studio-state.js"', JSON.stringify(stateModule)));
  const styles = ["styles.css", "studio.css"].map((file) => fs.readFileSync(path.join(uiRoot, file), "utf8")).join("\n");
  const html = fs.readFileSync(path.join(uiRoot, "index.html"), "utf8")
    .replace(/<link rel="stylesheet"[^>]*>/g, "")
    .replace("</head>", `<style>${styles}</style></head>`)
    .replace('<script type="module" src="/app.js"></script>', `<script>(${installFixture.toString()})(${JSON.stringify(fixture)});</script><script type="module" src="${appModule}"></script><script type="module">(${browserChecks.toString()})();</script>`);
  try {
    const result = await runBrowser(html, profile);
    assert.equal(result.status, "passed", result.report);
    console.log(result.report);
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

// CDP over Node's built-in WebSocket keeps this optional smoke test dependency-free.
async function runBrowser(html, profile) {
  const args = ["--headless", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking", "--disable-extensions", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"];
  if (process.getuid?.() === 0) args.unshift("--no-sandbox");
  const child = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error(`No browser debug endpoint: ${output}`)), 8000);
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.stderr.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    const pending = new Map();
    let sequence = 0;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 8000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Runtime.evaluate", { expression: `document.open(); document.write(${JSON.stringify(html)}); document.close();` }, sessionId);
    for (let attempt = 0; attempt < 180; attempt++) {
      const result = await send("Runtime.evaluate", { expression: `JSON.stringify({status: document.documentElement.dataset.studioSmoke, report: document.querySelector("#studio-smoke-result")?.textContent})`, returnByValue: true }, sessionId);
      if (result.result?.value) {
        const value = JSON.parse(result.result.value);
        if (value.status) return value;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const debug = await send("Runtime.evaluate", { expression: "JSON.stringify({url:location.href, ready:document.readyState, body:document.body?.innerText})", returnByValue: true }, sessionId);
    throw new Error(`Browser checks did not finish: ${debug.result?.value}`);
  } finally {
    socket?.close();
    if (child.exitCode === null) {
      const closed = new Promise((resolve) => child.once("close", resolve));
      child.kill("SIGKILL");
      await closed;
    }
  }
}
