import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { fixture } from './helpers/authoring-fixture.ts';
import { launchAuthoringBrowser } from './helpers/authoring-browser-driver.mjs';
import { createWorkspaceHandler } from '../src/workspace-server.ts';
import { loadGraph } from '../src/io.ts';
import { loadSketch, saveSketch } from '../src/visual-authoring.ts';
const browser = process.env.PRODUCT_GRAPH_BROWSER;
const moduleURL = file => `data:text/javascript;base64,${fs.readFileSync(new URL(file, import.meta.url)).toString('base64')}`;
// The host callback contract is a fixture. The tool, project client, HTTP APIs and
// temporary project files are real. No production source is transformed for testing.
function html(id) {
  const theme = `:root{--ink:#292933;--paper:#fbf7ee;--node:#fdfaf2;--muted:#68636a;--line:#d3c8b6;--frame:#a69b88;--surface:#eee7da;--accent:#b8482b;--accent-wash:#f7e7dc;--warning:#916115;--display:Georgia,serif;--grid:#8275600e;font:14px Arial;background:#f1ebdf;color:var(--ink)}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0}button{cursor:pointer;color:inherit}button:disabled{opacity:.45;cursor:not-allowed}button,input,textarea,select{font:inherit}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:3px}h2,h3,h4,p{margin:0}h3,h4{font-family:var(--display);font-weight:500}h3{font-size:22px}h4{font-size:19px;margin:12px 0}.eyebrow{font:10px monospace;letter-spacing:.09em;color:var(--accent)}.button{border:1px solid var(--line);background:transparent;padding:9px 12px;border-radius:3px;font-size:12px}.button-primary{background:var(--accent);border-color:var(--accent);color:var(--paper)}.text-button{border:0;background:none;color:var(--accent);font-size:11px;padding:7px 0}.icon-button,.compact-button{padding:6px 9px;background:none;border:1px solid var(--line);border-radius:3px;font-size:11px}.tag{display:inline-block;border:1px solid var(--line);padding:5px 7px;font:9px monospace;color:var(--accent)}.paper-card{border:1px solid var(--line);background:var(--node);padding:16px;border-radius:4px}summary{font-size:12px;color:var(--muted);cursor:pointer}details{margin:14px 0}`;
  const css = fs.readFileSync(new URL('../ui/visual-authoring.css', import.meta.url), 'utf8');
  return `<!doctype html><html><head><style>${theme}\n${css}</style></head><body><header style="padding:24px;border-bottom:1px solid var(--frame);font:italic 28px Georgia">Product Graph <small style="font:12px Arial">Fragrance Rotation · tool integration fixture</small></header><div class="tool-list" style="padding:24px"></div><main id="host-status"></main>
<script type="module">
import { initVisualAuthoring } from '${moduleURL('../ui/visual-authoring.js')}';
import { createProjectClient } from '${moduleURL('../ui/project-client.js')}';
let sequence=0; const pending=new Map();
// about:blank is not a secure origin; localhost supplies this API in production.
if (!crypto.randomUUID) { let ids=0; crypto.randomUUID=()=> 'browser-note-'+(++ids); }
window.__authoringTestReceive=(id,result)=>{pending.get(id)?.(result);pending.delete(id)};
const fetcher=async(url,options={})=>{
 const id=++sequence;const waiting=new Promise(resolve=>pending.set(id,resolve));
 window.__authoringTestTransport(JSON.stringify({id,url,method:options.method||'GET',headers:Object.fromEntries(new Headers(options.headers)),body:options.body}));
 const result=await waiting;return {ok:result.status>=200&&result.status<300,status:result.status,json:async()=>result.body};
};
const client=createProjectClient('/project/${id}/',fetcher);let current=(await client.request('/api/workspace')).graph;
window.__dirty=false;window.__confirm=true;window.confirm=()=>window.__confirm;window.__inspected=null;
window.__download=null;const blobs=new Map();const originalCreate=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=originalCreate(blob);blobs.set(url,blob);return url};HTMLAnchorElement.prototype.click=function(){window.__download={name:this.download,blob:blobs.get(this.href)}};
window.__readGraph=()=>current;
initVisualAuthoring({request:client.request,graph:()=>current,scope:()=>({id:'rotation',title:'Rotation',rootIds:['feature:rotation'],depth:2}),dirty:()=>window.__dirty,busy:()=>false,onProposal:p=>{window.__proposal=p},apply:async(id,revision)=>{const result=await client.request('/api/proposals/'+id+'/apply',{method:'POST',headers:{'X-Product-Graph-Proposal-Revision':revision},body:'{}'});current=result.graph;return true},inspect:id=>{window.__inspected=id},review:()=>{window.__reviewOpened=true}});
window.__ready=true;
</script></body></html>`;
}
for (const [width, height] of [[1440, 1000], [1024, 768]]) test(`Visual authoring UI + real API handlers via test transport (${width}×${height})`, { skip: !browser, timeout: 50000 }, async t => {
  const f = fixture(t), server = http.createServer(createWorkspaceHandler(f.home));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const driver = await launchAuthoringBrowser({ browser, profile: path.join(f.home, 'chrome'), baseURL: `http://127.0.0.1:${server.address().port}`, width, height });
  t.after(driver.close);
  const ev = driver.evaluate, checks = [];
  const check = async (expression, name) => { assert.ok(await ev(expression), name); checks.push(name); };
  const wait = async expression => { for (let i = 0; i < 200; i++) { if (await ev(expression)) return; await new Promise(r => setTimeout(r, 25)); } throw new Error('Wait failed: ' + expression + '\n' + await ev('document.body.innerText')); };
  const click = selector => ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const value = (selector, text) => ev(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  const shot = async name => { if (process.env.PRODUCT_GRAPH_SCREENSHOTS && width === 1440) { const out = await driver.command('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(process.env.PRODUCT_GRAPH_SCREENSHOTS, { recursive: true }); fs.writeFileSync(path.join(process.env.PRODUCT_GRAPH_SCREENSHOTS, name + '.png'), Buffer.from(out.data, 'base64')); } };
  await ev(`document.open();document.write(${JSON.stringify(html(f.project.id))});document.close()`);
  await wait('window.__ready'); await click('#open-authoring'); await wait('document.querySelectorAll("[data-note]").length===3');
  await check('document.querySelector("#authoring-dialog").open', 'Opens as a Studio tool');
  await check('document.querySelector("#sketch-save-state").textContent.includes("unconfirmed")', 'Saved sketches are not labelled accepted requirements');
  const before = loadGraph(f.root);
  await click('[data-select="feature-note"]'); await click('[data-select="rule-note"]');
  await check('document.querySelectorAll("[data-select][aria-pressed=true]").length===2', 'Explicit multi-selection works');
  await shot('sketch');
  await click('#sketch-define');
  await value('[data-mapping="feature-note"] .mapping-kind', 'existing:feature:rotation');
  await value('[data-mapping="rule-note"] .mapping-kind', 'rule');
  await value('[data-mapping="rule-note"] .mapping-title', 'Seven-day cooldown');
  await value('[data-mapping="rule-note"] .mapping-inputs', 'Bottle[], UsageRecord[]');
  await value('[data-mapping="rule-note"] .mapping-outputs', 'Recommendation?');
  await value('[data-mapping="rule-note"] .mapping-reference', 'Features/Rotation/Score.swift');
  await check('document.querySelector("#definition-relations select").value===""', 'Untyped arrows default to no semantic relationship');
  await check('!document.querySelector("#definition-form").checkValidity()', 'Unacknowledged assumption blocks a proposal');
  await click('[data-mapping="rule-note"] .mapping-confirm');
  await value('#definition-relations select', 'constrains');
  await click('#definition-propose'); await wait('!document.querySelector("#definition-review").hidden && !document.querySelector("#sketch-close").disabled');
  assert.deepEqual(loadGraph(f.root), before); checks.push('Proposal creation leaves graph unchanged on disk');
  await check('document.querySelector("#definition-apply").disabled', 'Apply requires review acknowledgement');
  await check('document.querySelector("#definition-json").textContent.includes("sourceNotes")', 'Review exposes original source snapshots');
  await shot('define-review');
  await click('#definition-approved'); await click('#definition-apply');
  await wait('document.querySelector("#definition-summary").textContent.startsWith("applied") && !document.querySelector("#sketch-close").disabled');
  assert.equal(loadGraph(f.root).nodes.length, before.nodes.length + 1); checks.push('Approved proposal creates one real product object, reuses the other');
  await check('JSON.parse(document.querySelector("#definition-json").textContent).commands.find(c=>c.type==="create-node").node.data.implementationContract.executable===false', 'Low-code contract remains non-executable');
  await check('document.querySelector("#definition-apply").disabled', 'Applied proposal cannot be replayed');
  await click('[data-stage="context"]');
  await value('#task-context-task', 'Implement cooldown and verify the no-match outcome');
  await click('#task-context-sketch'); await click('#task-context-build');
  await wait('!document.querySelector("#task-context-result").hidden && !document.querySelector("#context-export-json").disabled');
  await check('document.querySelector("#task-context-output").textContent.includes("constraint:offline")', 'Required project constraint reaches the task context');
  await check('document.querySelector("#task-context-output").textContent.includes("Avoid recently used")', 'Actual linked Markdown body is included');
  await check('document.querySelector("#task-context-gaps").textContent.includes("Unresolved assumption")', 'Unconfirmed source is explicitly separated from model meaning');
  await check('document.querySelector("#task-context-budget-report").textContent.includes("not measured tokens")', 'Budget is labelled honestly');
  await shot('task-context');
  await click('#context-export-json');
  await check('window.__download.name.endsWith(".json")', 'JSON context is exportable');
  await check('(async () => (JSON.parse(await window.__download.blob.text())).permissions.execute===false)()', 'Export does not grant execution');
  await value('#task-context-task', 'A changed task');
  await check('document.querySelector("#task-context-result").hidden', 'Editing the task invalidates the visible context build');
  await click('[data-stage="sketch"]'); await click('[data-drag="feature-note"]');
  await ev('document.querySelector("[data-drag=feature-note]").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');
  await check('document.querySelector("#sketch-save-state").textContent.includes("unsaved")', 'Keyboard layout change becomes a sketch draft, not a graph edit');
  await click('#sketch-undo');
  await check('document.querySelector("#sketch-save-state").textContent.includes("saved · unconfirmed")', 'Sketch Undo restores source state independently');
  await value('#sketch-text', 'A new idea to keep locally'); await click('#sketch-capture');
  await check('document.querySelectorAll("[data-note]").length===4', 'Capture creates a visual note');
  await check('!window.dispatchEvent(new Event("beforeunload",{cancelable:true}))', 'Window unload guard detects an unsaved sketch');
  await ev('window.__confirm=false'); await click('#sketch-close');
  await check('document.querySelector("#authoring-dialog").open', 'Cancelled discard keeps draft and tool open');
  await ev('window.__confirm=true');
  // Another writer changes the real note file; saving must keep the UI draft on conflict.
  const saved = loadSketch(f.root); saved.board.notes[0].text = 'External edit'; saveSketch(f.root, { expectedRevision: saved.boardRevision, board: saved.board });
  await click('#sketch-save'); await wait('document.querySelector("#authoring-message").textContent.includes("changed on disk")');
  await check('document.querySelectorAll("[data-note]").length===4', 'Revision conflict preserves unsaved local notes');
  assert.equal(loadSketch(f.root).board.notes.length, 3); checks.push('Conflict does not overwrite the external source');
  await click('#sketch-close'); await check('!document.querySelector("#authoring-dialog").open', 'Explicit discard closes the tool');
  await check('document.activeElement.id==="open-authoring"', 'Closing restores keyboard focus');
  await ev('window.__dirty=true'); await click('#open-authoring'); await wait('document.querySelectorAll("[data-note]").length===3 && !document.querySelector("#sketch-close").disabled');
  await click('[data-stage="context"]');
  await check('document.querySelector("#task-context-build").disabled', 'Unsaved product edits block saved-context handoff');
  assert.ok(driver.requests.every(r => r.url.startsWith(`/api/projects/${f.project.id}/`))); checks.push('Every request remains bound to one project');
  assert.deepEqual(driver.errors, []);
  console.log(JSON.stringify({ width, checks }, null, 2));
});
