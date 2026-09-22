import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStudioBrowser } from './helpers/studio-browser.mjs';
const browser = process.env.PRODUCT_GRAPH_BROWSER;
const ui = fileURLToPath(new URL('../ui/', import.meta.url));
const fixture = { manifest: { name: 'Fragrance Rotation', projectId: 'fixture' }, nodes: [
  { id: 'feature:rotation', region: 'product', type: 'feature', title: 'Rotation', data: {} },
  { id: 'entity:bottle', region: 'domain', type: 'entity', title: 'Bottle', data: {} },
  { id: 'screen:detail', region: 'experience', type: 'screen', title: 'Bottle detail', data: {} },
  { id: 'rule:cooldown', region: 'domain', type: 'rule', title: 'Cooldown', data: {} },
], edges: [{ id: 'e1', from: 'feature:rotation', to: 'rule:cooldown', kind: 'uses' }], documents: [] };
function setup(graph) {
  window.__saveCount = 0; window.__saved = null; window.__saveFail = false; window.__saveDelay = 0; window.__confirm = true;
  window.confirm = () => window.__confirm;
  window.prompt = () => { throw new Error('A raw prompt must not be used for quick authoring'); };
  let serial = 0; if (!crypto.randomUUID) crypto.randomUUID = () => `ui-${++serial}`;
  window.fetch = async (url, options = {}) => {
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url === '/api/workspace') {
      if (options.method === 'POST') {
        window.__saveCount++; await new Promise(r => setTimeout(r, window.__saveDelay));
        if (window.__saveFail) return json({ message: 'Conflict: keep the working graph' }, 409);
        window.__saved = JSON.parse(options.body); graph = window.__saved.graph;
      }
      return json({ graph, layout: window.__saved?.layout || {}, diagnostics: [], focusAreas: [{ id: 'rotation', title: 'Rotation', rootIds: ['feature:rotation'], depth: 1 }], tours: [], library: { patterns: [], templates: [] }, workspaceRevision: `rev-${window.__saveCount}` });
    }
    if (url === '/api/proposals') return json({ proposals: [] });
    if (url.startsWith('/api/context?')) return json({ context: { why: [], whereUsed: [], impact: [], decisions: [], evidence: [] } });
    if (url === '/api/compare') return json({ nodesAdded: [], nodesRemoved: [], nodesChanged: [], edgesAdded: [], edgesRemoved: [] });
    throw new Error(`Unexpected fixture request ${url}`);
  };
}
async function checks() {
  const report = [], q = s => document.querySelector(s), pause = ms => new Promise(r => setTimeout(r, ms));
  const check = (condition, name) => { if (!condition) throw new Error(name); report.push(name); };
  const click = s => { const el = q(s); if (!el) throw new Error(`Missing ${s}`); el.click(); };
  const value = (s, v) => { const el = q(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const wait = async fn => { for (let i = 0; i < 100 && !fn(); i++) await pause(20); if (!fn()) throw new Error('UI did not reach expected state'); };
  const nodes = () => document.querySelectorAll('[data-graph-node]').length;
  const key = (selector, key, options = {}) => { const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }); q(selector).dispatchEvent(event); return event; };
  try {
    await wait(() => q('#save-state').textContent === 'Ready');
    check(nodes() === 4 && q('#quick-connect').disabled, 'Toolbar boots with actual core Studio state and disabled selection actions');
    key('#graph-canvas', 'N', { shiftKey: true }); check(!q('#quick-edit-dialog') && nodes() === 4, 'Add-related shortcut requires a selected source; it never creates an unconnected fallback');
    click('#add-node'); check(q('#quick-object-form') && !q('[name=quick-choice]:checked'), 'Existing Add entry opens explicit semantic palette, not a prompt or inferred type');
    value('#quick-title', 'Unfinished'); window.__confirm = false; click('#quick-cancel');
    check(q('#quick-edit-dialog').open && q('#quick-title').value === 'Unfinished', 'Cancel discard preserves form text');
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); check(unload.defaultPrevented, 'Unfinished form has a page-unload guard');
    window.__confirm = true; click('#quick-cancel');
    check(!q('#quick-edit-dialog') && q('#save-state').textContent === 'Ready', 'Discarded form does not dirty the model');
    click('#quick-add'); click('[name=quick-choice][value=feature]'); value('#quick-title', 'Record usage'); click('#quick-submit');
    const newId = q('#node-id').value;
    check(nodes() === 5 && newId.startsWith('product:'), 'Creates a draft object with generated stable ID');
    check(q('#save-state').textContent === 'Unsaved changes' && window.__saveCount === 0, 'Quick edits stay local until ordinary Save');
    click('#undo-button'); check(nodes() === 4, 'Existing graph Undo removes creation and its layout in one step');
    click('#redo-button'); check(nodes() === 5, 'Existing Redo restores creation');
    click('#save-button'); await wait(() => !q('#save-button').disabled);
    check(window.__saved.graph.nodes.length === 5 && window.__saved.graph.edges.length === 1, 'Existing Save sends whole graph, without invented edges');
    check(window.__saved.layout['project:overview'].positions[newId].pinned, 'New placement is persisted as view layout, not domain metadata');
    click('[data-node="feature:rotation"]'); click('#isolate-button');
    check(nodes() === 1, 'Isolate remains depth-zero before quick creation');
    const originalScope = q('#scope-title').textContent;
    const handle = q('[data-quick-related]'); handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9 })); handle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check(q('#quick-edit-dialog').open && q('#quick-kind').value === '', 'Selected-node plus opens related creation without implicit relationship meaning');
    click('[name=quick-choice][value=rule]'); value('#quick-title', 'Seven-day cooldown');
    check(!q('#quick-object-form').checkValidity(), 'Relationship meaning is required before atomic create+connect');
    value('#quick-kind', 'constrains'); value('#quick-direction', 'incoming');
    check(q('#quick-preview').textContent.includes('Seven-day cooldown — constrains → Rotation'), 'Direction and named endpoints are previewed before editing');
    click('#quick-submit'); const ruleId = q('#node-id').value;
    check(q('#scope-title').textContent === originalScope && nodes() >= 2, 'Reveal keeps focus roots and expands only its bounded neighborhood');
    click('#save-button'); await wait(() => !q('#save-button').disabled);
    check(window.__saved.graph.edges.some(e => e.from === ruleId && e.to === 'feature:rotation' && e.kind === 'constrains'), 'Saved relationship has exactly the chosen direction and meaning');
    check(window.__saved.graph.nodes.find(n => n.id === ruleId).status === 'draft', 'New definition is not labelled verified');
    click('#undo-button'); check(![...document.querySelectorAll('.node-title')].some(n => n.textContent === 'Seven-day cooldown'), 'Undo removes connected object and relationship together');
    click('#redo-button'); click('[data-node="feature:rotation"]');
    click('#add-edge'); value('#quick-target-search', 'Bottle');
    check(q('#quick-target').options.length === 3 && q('#quick-search-count').textContent.includes('whole current project'), 'Connect searches all project objects by name, including outside current focus');
    value('#quick-target', 'entity:bottle'); value('#quick-kind', 'supports'); click('#quick-swap');
    check(q('#quick-preview').textContent.includes('Bottle — supports → Rotation'), 'Existing connection direction is explicitly reversible');
    click('#quick-submit'); check(q('#scope-title').textContent === originalScope && q('#node-id').value === 'feature:rotation', 'Connecting existing objects preserves focus and selected starting object');
    click('#save-button'); await wait(() => !q('#save-button').disabled);
    check(window.__saved.graph.nodes.length === 6, 'Reusing an object never clones it');
    check(window.__saved.graph.edges.some(e => e.from === 'entity:bottle' && e.to === 'feature:rotation'), 'Existing object relation reaches the full graph payload');
    click('#quick-connect'); value('#quick-target', 'entity:bottle'); value('#quick-kind', 'supports'); click('#quick-swap'); click('#quick-submit');
    check(q('#quick-error').textContent.includes('already exists') && q('#quick-edit-dialog').open, 'Duplicate relationship is rejected with form retained'); click('#quick-cancel');
    value('#node-title', 'Inspector draft'); click('#quick-rename');
    check(!q('#quick-edit-dialog') && q('#node-title').value === 'Inspector draft', 'Quick actions do not discard an unapplied inspector draft');
    check(!key('#node-title', 'n').defaultPrevented && !q('#quick-edit-dialog'), 'Typing N in an input is not a graph shortcut');
    check(!key('#node-title', 'z', { ctrlKey: true }).defaultPrevented, 'Native text Undo remains available');
    q('#node-form').requestSubmit(); click('#save-button'); await wait(() => !q('#save-button').disabled);
    const beforeRenameId = q('#node-id').value;
    key('#graph-canvas', 'F2'); value('#quick-title', 'Rotation updated'); click('#quick-submit');
    check(q('#node-id').value === beforeRenameId && q('#node-title').value === 'Rotation updated', 'F2 rename updates title without changing stable ID');
    click('#save-button'); await wait(() => !q('#save-button').disabled);
    click('#quick-rename'); click('#quick-submit'); check(q('#save-state').textContent === 'Ready', 'Unchanged rename does not dirty or create an Undo entry');
    click('#quick-help'); check(q('#quick-edit-dialog').textContent.includes('Graph Undo/Redo remains separate'), 'Discoverable help explains actions and navigation boundaries'); click('#quick-close');
    check(!key('#search', 'c').defaultPrevented, 'Search typing is not a connection shortcut');
    const count = window.__saveCount; key('#graph-canvas', 's', { ctrlKey: true }); await wait(() => !q('#save-button').disabled);
    check(window.__saveCount === count + 1, 'Canvas Save shortcut uses the existing host Save path');
    click('#quick-add'); click('[name=quick-choice][value=screen]'); value('#quick-title', '<img src=x onerror=alert(1)>'); value('#quick-kind', 'supports'); click('#quick-reveal'); click('#quick-submit');
    check(!document.querySelector('img'), 'User-authored names are rendered as inert text');
    window.__saveFail = true; click('#save-button'); await wait(() => !q('#save-button').disabled);
    check(q('#save-state').textContent === 'Unsaved changes', 'Server save failure keeps the working graph dirty');
    window.__saveFail = false; window.__saveDelay = 80; click('#save-button'); click('#quick-add');
    check(!q('#quick-edit-dialog') && q('#quick-add').disabled, 'Authoring is blocked while the host is saving');
    await wait(() => !q('#save-button').disabled); window.__saveDelay = 0;
    click('#all-models-button'); click('[data-lens=overview]'); click('[data-node="feature:rotation"]'); click('#isolate-button');
    const svg = q('#graph-svg'), r = svg.getBoundingClientRect();
    svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.right - 15, clientY: r.bottom - 15, cancelable: true }));
    check(q('#quick-object-form') !== null, 'Double-clicking empty canvas offers creation at a visual position'); click('#quick-cancel');
    click('#delete-node'); check(nodes() === 0, 'Deleting focus root still yields an empty focus'); click('#quick-empty');
    check(!q('#quick-edit-dialog') && nodes() === 0, 'Missing focus root never silently creates an unrelated object');
    click('#undo-button'); check(nodes() >= 1, 'Root deletion remains recoverable through existing Undo');
    check(document.documentElement.scrollWidth <= innerWidth, 'Core authoring test host fits this viewport');
    document.documentElement.dataset.studioSmoke = 'passed';
  } catch (error) { document.documentElement.dataset.studioSmoke = 'failed'; report.push(`FAIL: ${error.message}`); }
  const out = document.createElement('pre'); out.id = 'studio-smoke-result'; out.hidden = true; out.textContent = JSON.stringify(report); document.body.append(out);
}
/** Real app.js, state, geometry, client and new tool. Unrelated tool/page integrations
 * and API responses are explicit fixtures. This is not the complete production shell. */
function html() {
  const stubs = {
    'studio-controls.js': 'export function initAppearance(){};export function navigateChoices(){};',
    'studio-pages.js': 'export function createStudioPages(){return {render(){},show(page){document.querySelector(".workspace").dataset.page=page;},openItem(){}};}',
    'project-session.js': 'export function initProjectSession(){}',
    'document-browser.js': 'export function initDocumentBrowser(){}',
    'visual-authoring.js': 'export function initVisualAuthoring(){}',
  };
  const cache = new Map();
  const mod = file => {
    if (cache.has(file)) return cache.get(file);
    let source = stubs[file] ?? fs.readFileSync(path.join(ui, file), 'utf8');
    source = source.replace(/from\s+(["'])(\.\/[^"']+)\1/g, (_, quote, relative) => `from ${JSON.stringify(mod(relative.slice(2)))}`);
    const result = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`; cache.set(file, result); return result;
  };
  const app = mod('app.js');
  const css = fs.readFileSync(path.join(ui, 'quick-edit.css'), 'utf8');
  let body = `<header><h1 id="project-name"></h1><p>Core Studio integration fixture · supporting panels and API are fixtures</p><div id="scope-breadcrumb"></div><nav class="page-nav"></nav></header><main class="workspace" data-page="model"><aside><div id="node-count"></div><nav id="focus-area-list"></nav><nav class="tool-list"><button data-tool="all">All models</button><button data-tool="decisions">Decisions</button><button data-tool="review">Review</button><button data-tool="library">Library</button></nav><label>Find in scope<input id="search"></label><div id="node-list"></div><button id="add-node" type="button">Add to focus</button></aside><section class="canvas-panel" id="graph-surface"><div class="controls"><span id="save-state"></span><button id="save-button">Save</button><button id="undo-button">Undo</button><button id="redo-button">Redo</button><button id="back-button">Back</button><button id="forward-button">Forward</button></div><h2 id="scope-title"></h2><p id="canvas-summary"></p><div id="lens-list"></div><p id="scope-summary"></p><p id="selection-visibility" hidden></p><div class="controls"><button id="isolate-button">Isolate</button><button id="expand-button">Expand</button><button id="all-models-button">All models</button><button id="clear-search-button">Clear search</button></div><div id="graph-canvas" tabindex="0"><svg id="graph-svg"></svg><div id="empty-state" hidden><h2>Empty</h2><p></p></div></div><div class="controls"><button id="zoom-in">+</button><button id="zoom-out">−</button><button id="fit-view">Fit</button><button id="auto-layout">Arrange</button><button id="unpin-selection">Unpin</button></div><button id="drawer-toggle">Details</button><div id="drawer-content" hidden></div></section><aside><span id="selection-type"></span><div id="inspector-empty"></div><form id="node-form" hidden><button type="button" id="focus-here-button">Focus here</button><button type="button" id="context-refresh">Refresh</button><label>Name<input id="node-title" required></label><label>ID<input id="node-id" readonly></label><label>Type<input id="node-type" required></label><label>Region<select id="node-region"></select></label><label>Status<input id="node-status"></label><label>Metadata<textarea id="node-data"></textarea></label><button type="submit">Apply object changes</button><button id="delete-node" type="button">Delete object</button></form><div id="context-sections"><div id="why-list"></div><div id="where-list"></div><div id="impact-list"></div><div id="source-list"></div></div><button id="add-edge" type="button">Add relationship</button><div id="edge-list"></div><span id="validation-count"></span><div id="validation-list"></div></aside></main><div id="toast" role="status"></div>`;
  const ids = new Set([...body.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  // Extra legacy buttons not involved in the new flow still bind against real elements.
  for (const [, id] of fs.readFileSync(path.join(ui, 'app.js'), 'utf8').matchAll(/\$\("([^"$]+)"\)/g)) if (!ids.has(id)) { ids.add(id); body += `<button hidden type="button" id="${id}">${id}</button>`; }
  return `<!doctype html><html><head><meta charset="utf-8"><style>:root{--ink:#292933;--paper:#fbf7ee;--node:#fdfaf2;--muted:#68636a;--line:#d3c8b6;--frame:#a69b88;--surface:#eee7da;--accent:#b8482b;--accent-wash:#f7e7dc;--danger:#ae3034;--display:Georgia,serif;font:13px system-ui;color:var(--ink);background:#f1ebdf}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0}body>header{padding:16px 22px}h1,h2{font-family:Georgia,serif;font-weight:500;margin:8px 0}p{line-height:1.5}.workspace{display:grid;grid-template-columns:190px minmax(320px,1fr) 240px;gap:12px;padding:12px}.workspace>aside,.canvas-panel{min-width:0;background:var(--paper);padding:14px;border:1px solid var(--line);border-radius:5px}label{display:block;margin:10px 0;font-size:11px}label>input,label>textarea,label>select{display:block;width:100%}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer;padding:7px 9px;border:1px solid var(--line);background:var(--node);border-radius:4px}button:disabled{opacity:.5}.controls,.tool-list{display:flex;gap:5px;flex-wrap:wrap}#node-list,#focus-area-list{display:grid;gap:6px;margin:12px 0}.node-button,.layer-button{text-align:left;display:flex;gap:8px}.node-copy small,.layer-label small{display:block;color:var(--muted);font-size:10px}.layer-number{margin-left:auto}#lens-list{display:flex;flex-wrap:wrap;gap:4px;font-size:11px}#graph-canvas{height:360px;position:relative}#graph-svg{width:100%;height:100%}.node-card{fill:var(--node);stroke:var(--frame)}.graph-node.selected .node-card{stroke:var(--accent);stroke-width:2}.node-title{font:16px Georgia,serif;fill:var(--ink)}.node-type{font:10px sans-serif;fill:var(--muted)}.edge-line{stroke:var(--frame);fill:none}.edge-label{font:10px sans-serif;fill:var(--muted)}#empty-state{position:absolute;inset:0;display:grid;place-content:center;text-align:center}#toast{position:fixed;bottom:15px;right:20px;max-width:380px;padding:12px;background:var(--paper);border:1px solid var(--line);opacity:0;pointer-events:none}#toast.show{opacity:1}.button-primary{background:var(--accent);color:var(--paper)}.text-button{border:0;background:transparent;color:var(--accent)}.eyebrow{font:10px monospace;letter-spacing:.08em;color:var(--accent)}${css}</style></head><body>${body}<script>(${setup.toString()})(${JSON.stringify(fixture)});</script><script type="module" src="${app}"></script><script type="module">(${checks.toString()})();</script></body></html>`;
}
for (const [width, height] of [[1440, 1000], [1024, 768]]) test(`Quick editing with actual core app at ${width}x${height}`, { skip: !browser, timeout: 40000 }, async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-quick-editor-'));
  try {
    const result = await runStudioBrowser(html(), { browser, profile, width, height, onReady: async command => {
      const out = process.env.PRODUCT_GRAPH_SCREENSHOTS; if (!out || width !== 1440) return;
      fs.mkdirSync(out, { recursive: true });
      await command('Runtime.evaluate', { expression: 'document.querySelector("#all-models-button").click();document.querySelector("[data-node=\\"feature:rotation\\"]").click();document.querySelector("#quick-related").click();document.querySelector("[name=quick-choice][value=rule]").click();document.querySelector("#quick-title").value="Seven-day cooldown";' });
      const image = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, 'quick-create.png'), Buffer.from(image.data, 'base64'));
      await command('Runtime.evaluate', { expression: 'document.querySelector("#quick-cancel").click();document.querySelector("#quick-connect").click();const find=document.querySelector("#quick-target-search");find.value="Bottle";find.dispatchEvent(new Event("input",{bubbles:true}));const dest=document.querySelector("#quick-target");dest.value="entity:bottle";dest.dispatchEvent(new Event("change",{bubbles:true}));const kind=document.querySelector("#quick-kind");kind.value="uses";kind.dispatchEvent(new Event("change",{bubbles:true}));' });
      const connection = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, 'connect-existing.png'), Buffer.from(connection.data, 'base64'));

    } });
    assert.equal(result.status, 'passed', result.report); console.log(result.report);
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
});
