import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStudioBrowser } from './helpers/studio-browser.mjs';
import { saveGraph } from '../src/io.ts';
import { loadImplementation, saveImplementation } from '../src/implementation-targets.ts';
import { buildImplementationContext } from '../src/implementation-context.ts';
import { buildTaskContext } from '../src/task-context.ts';

const browser = process.env.PRODUCT_GRAPH_BROWSER;
const ui = fileURLToPath(new URL('../ui/', import.meta.url));
function seed(directory) {
  const graph = { manifest: { projectId: 'demo', schemaVersion: '1', framework: '1', name: 'Fragrance Rotation' }, nodes: [
    { id: 'feature:rotation', type: 'feature', region: 'product', title: 'Rotation recommendation' },
    { id: 'entity:bottle', type: 'entity', region: 'domain', title: 'Bottle' },
    { id: 'test:rotation', type: 'acceptance-criterion', region: 'quality', title: 'Explain the recommendation' },
  ], edges: [{ from: 'feature:rotation', to: 'entity:bottle', kind: 'uses' }, { from: 'feature:rotation', to: 'test:rotation', kind: 'verified-by' }], documents: [] };
  saveGraph(directory, graph);
  const snap = loadImplementation(directory);
  const bindings = [{ nodeId: 'feature:rotation', mode: 'custom', slot: '', reference: 'src/rotation.ts' }];
  const config = { ...snap.config, targets: [
    { id: 'web', name: 'Web application', role: 'interface', environment: 'browser', language: 'TypeScript', framework: 'React', storage: 'Local store', notes: 'The same product rules, delivered on the web.', template: null, bindings },
    { id: 'api', name: 'Backend API', role: 'backend', environment: 'server', language: 'Java', framework: 'Spring Boot', storage: 'PostgreSQL', notes: 'Server-side responsibility remains an explicit implementation decision.', template: null, bindings: [{ ...bindings[0], reference: 'RotationService.java' }] },
  ] };
  const snapshot = saveImplementation(directory, { expectedRevision: snap.revision, config });
  const context = buildImplementationContext(directory, { targetId: 'web', expectedRevision: snapshot.revision, context: { task: 'Implement rotation', rootIds: ['feature:rotation'] } }, buildTaskContext);
  return { snapshot, context, graph };
}
function setup(fixture) {
  let snapshot = fixture.snapshot, revision = 0, uuid = 0;
  window.__host = { graph: fixture.graph, dirty: false, formDirty: false, selectedId: 'feature:rotation', scope: { rootIds: ['feature:rotation'] } };
  window.__calls = []; window.__failSave = false; window.__delayContext = 0;
  window.confirm = () => true;
  if (!crypto.randomUUID) crypto.randomUUID = () => `browser-${++uuid}`;
  window.fetch = async (url, options = {}) => {
    window.__calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : null });
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    if (!url.startsWith('/api/projects/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/')) throw new Error('Wrong project route');
    if (url.endsWith('/implementation/context')) {
      await new Promise(r => setTimeout(r, window.__delayContext)); return json(fixture.context);
    }
    if (url.endsWith('/implementation')) {
      if (options.method === 'POST') {
        if (window.__failSave) return json({ message: 'Conflict: keep your draft and reconcile' }, 409);
        const payload = JSON.parse(options.body);
        snapshot = { ...snapshot, config: payload.config, revision: `fixture-${++revision}` };
        snapshot.inspection = snapshot.config.targets.map(t => ({ targetId: t.id, template: null, findings: [], compatible: false,
          generation: { available: false }, bindings: t.bindings.map(b => ({ ...b, title: snapshot.nodes.find(n => n.id === b.nodeId)?.title || b.nodeId, status: b.mode === 'custom' ? 'custom-declared' : 'deferred', message: 'Declaration only; no execution.' })) }));
      }
      return json(snapshot);
    }
    throw new Error('Unexpected request');
  };
}
async function checks() {
  const checks = [], q = s => document.querySelector(s), sleep = ms => new Promise(r => setTimeout(r, ms));
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  const click = s => { const e = q(s); if (!e) throw new Error(`Missing ${s}`); e.click(); };
  const input = (s, value) => { q(s).value = value; q(s).dispatchEvent(new Event('input', { bubbles: true })); };
  const until = async predicate => { for (let i = 0; i < 100 && !predicate(); i++) await sleep(20); if (!predicate()) throw new Error('Timed out waiting for UI'); };
  try {
    await until(() => q('[data-target=web]'));
    const modelBefore = JSON.stringify(window.__host.graph);
    check(q('#page-heading').textContent === 'Implementation targets', 'Targets has a platform-neutral heading');
    check(document.querySelectorAll('[data-target]').length === 2, 'Multiple deployment targets are visible');
    check(q('#target-detail').textContent.includes('TypeScript') && !q('#target-detail').textContent.includes('SwiftUI'), 'Web target does not silently become a SwiftUI target');
    check([...document.querySelectorAll('button')].some(b => b.disabled && b.textContent === 'Generate application'), 'Generation remains explicitly disabled');
    click('[data-target=api]'); check(q('#target-detail').textContent.includes('Spring Boot'), 'Selecting a backend keeps its own deployment choices');
    click('[data-target=web]');
    window.__host.dirty = true; click('#target-add'); check(!q('dialog') && q('#targets-message').textContent.includes('Save'), 'Unsaved host model blocks target editing');
    window.__host.dirty = false; click('#target-add');
    check(q('dialog').open, 'Add target opens an editable modal');
    check(q('[name=environment]').value === '' && q('[name=framework]').value === '', 'New targets do not assume a language or platform');
    input('[name=name]', 'iPhone application'); input('[name=environment]', 'iOS'); input('[name=language]', 'Swift'); input('[name=framework]', 'SwiftUI');
    click('#binding-add'); input('[data-field=nodeId]', 'feature:rotation'); input('[data-field=mode]', 'custom'); input('[data-field=reference]', 'Rotation.swift');
    click('#target-save'); await until(() => !q('dialog'));
    check(document.querySelectorAll('[data-target]').length === 3, 'Saving adds a third target without replacing existing targets');
    check(q('#target-detail').textContent.includes('Rotation.swift'), 'Custom implementation reference is retained as a declaration');
    check(JSON.stringify(window.__host.graph) === modelBefore, 'Target Save never mutates product semantics');
    const write = window.__calls.find(c => c.method === 'POST' && c.url.endsWith('/implementation'));
    check(write.body.config.targets[2].bindings[0].nodeId === 'feature:rotation', 'Targets bind the same product object ID');
    check(Boolean(write.body.expectedRevision), 'Save uses the observed implementation revision');
    click('#target-edit'); input('[name=name]', 'Unapplied target draft'); window.confirm = () => false; click('[data-close]');
    check(q('dialog').open && q('[name=name]').value === 'Unapplied target draft', 'Cancelling discard preserves target draft');
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); check(unload.defaultPrevented, 'Unloading warns about the independent target draft');
    window.confirm = () => true; click('[data-close]'); await until(() => !q('dialog')); check(!q('dialog'), 'Explicit discard closes draft without saving');
    check(q('#target-detail').textContent.includes('iPhone application'), 'Discard keeps the saved target name');
    click('#target-edit'); input('[name=storage]', 'SwiftData'); window.__failSave = true; click('#target-save');
    await until(() => q('#target-form-error')?.textContent.includes('Conflict'));
    check(q('[name=storage]').value === 'SwiftData' && !q('#target-save').disabled, 'Conflicts retain fields and allow recovery');
    window.__failSave = false; click('#target-save'); await until(() => !q('dialog'));
    check(q('#target-detail').textContent.includes('SwiftData'), 'Retry saves retained target edits');
    click('[data-target=web]'); click('#target-context');
    input('#target-context-form [name=task]', 'Implement rotation'); click('#target-context-form button[type=submit]');
    await until(() => q('#target-context-result') && !q('#target-context-result').hidden);
    check(q('#target-context-result pre').textContent.includes('productgraph.implementation-context.v1'), 'Context preview shows the versioned target artifact');
    const call = window.__calls.find(c => c.url.endsWith('/implementation/context'));
    check(call.body.targetId === 'web' && call.body.context.rootIds[0] === 'feature:rotation', 'Context request uses an explicit target and product root');
    check(Boolean(q('#target-export-json')) && Boolean(q('#target-export-markdown')), 'JSON and Markdown exports use the retained result');
    input('#target-context-form [name=task]', 'New task'); check(q('#target-context-result').hidden, 'Changing task invalidates the visible export');
    window.__delayContext = 80; click('#target-context-form button[type=submit]'); input('#target-context-form [name=task]', 'Changed while building'); await sleep(150);
    check(q('#target-context-result').hidden, 'Late context result cannot revive an obsolete request');
    click('[data-close]'); await until(() => !q('dialog'));
    click('[data-target=api]'); click('#target-delete'); check(q('dialog').textContent.includes('custom files are kept'), 'Delete confirmation explains ownership boundary');
    click('#target-confirm-remove'); await until(() => !q('dialog'));
    check(document.querySelectorAll('[data-target]').length === 2 && !q('[data-target=api]'), 'Delete removes only selected target configuration');
    check(JSON.stringify(window.__host.graph) === modelBefore, 'Delete and context reads do not rewrite graph');
    click('[data-target=web]');
    check(document.documentElement.scrollWidth <= innerWidth, 'Targets layout fits viewport without page-level horizontal overflow');
    check(window.__calls.every(c => c.url.startsWith('/api/projects/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/')), 'Every request stays bound to the current project client');
    check(!document.querySelector('img, iframe'), 'No untrusted media or external content is rendered');
    document.documentElement.dataset.studioSmoke = 'passed';
  } catch (e) { document.documentElement.dataset.studioSmoke = 'failed'; checks.push(`FAIL: ${e.message}`); }
  const out = document.createElement('pre'); out.id = 'studio-smoke-result'; out.hidden = true; out.textContent = JSON.stringify(checks); document.body.append(out);
}
function html(fixture) {
  const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const client = url(fs.readFileSync(path.join(ui, 'project-client.js'), 'utf8'));
  const targets = url(fs.readFileSync(path.join(ui, 'implementation-targets.js'), 'utf8').replace("'./project-client.js'", JSON.stringify(client)));
  const css = fs.readFileSync(path.join(ui, 'implementation-targets.css'), 'utf8');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root{--paper:#faf6ec;--surface:#fffaf2;--ink:#302d29;--muted:#776f64;--line:#d9d1c2;--accent:#b75637;--warning:#965b26}*{box-sizing:border-box}body{margin:0;padding:32px;background:#f4efe4;color:var(--ink);font:14px system-ui}button{font:inherit;color:inherit}h2,h3{font-family:Georgia,serif}h2{font-size:32px;margin:8px 0}h3{font-size:23px}.page-heading{display:flex;justify-content:space-between;align-items:start;gap:16px}.eyebrow{font-size:11px;letter-spacing:.14em;color:var(--muted)}.paper-card{padding:22px;background:var(--paper);border:1px solid var(--line);border-radius:7px}.button{border:1px solid var(--line);background:var(--surface);border-radius:5px;padding:10px 15px}.button-primary{background:var(--accent);color:white}.button:disabled{opacity:.5}.tag{display:inline-block;font-size:11px;padding:5px 8px;border:1px solid var(--line);border-radius:4px}header.host{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);margin-bottom:28px;padding-bottom:16px}header.host strong{font-family:Georgia,serif;font-size:25px}[hidden]{display:none!important}${css}</style></head><body><header class="host"><strong>Product Graph · Fragrance Rotation</strong><span>Targets module · test host</span></header><main id="host"></main><script>(${setup.toString()})(${JSON.stringify(fixture)});</script><script type="module">import {createImplementationTargets} from ${JSON.stringify(targets)};import {createProjectClient} from ${JSON.stringify(client)};const tool=createImplementationTargets({state:window.__host,request:createProjectClient('/project/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/').request});document.querySelector('#host').append(tool.element);tool.open();(${checks.toString()})();</script></body></html>`;
}
for (const [width, height] of [[1440, 1000], [1024, 768]]) test(`Implementation targets UI at ${width}x${height}`, { skip: !browser, timeout: 40000 }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-target-browser-'));
  const project = path.join(home, 'project'); fs.mkdirSync(project);
  try {
    const result = await runStudioBrowser(html(seed(project)), { browser, profile: path.join(home, 'chrome'), width, height, onReady: async command => {
      const out = process.env.PRODUCT_GRAPH_SCREENSHOTS;
      if (!out || width !== 1440) return;
      fs.mkdirSync(out, { recursive: true });
      const image = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, 'targets.png'), Buffer.from(image.data, 'base64'));
      await command('Runtime.evaluate', { expression: "document.querySelector('#target-edit').click()" });
      const edit = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, 'target-editor.png'), Buffer.from(edit.data, 'base64'));
    } });
    assert.equal(result.status, 'passed', result.report); console.log(result.report);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
