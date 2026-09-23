import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ui = fileURLToPath(new URL('../../ui/', import.meta.url));
// Only unrelated page/tool adapters are replaced. The actual app.js, graph state,
// client, canvas geometry, index.html, styles and new editing modules run unchanged.
const adapters = {
  'studio-pages.js': `export function createStudioPages(){return {show:()=>{},render:()=>{},openItem:()=>{}}}`,
  'studio-controls.js': `export function initAppearance(){};export function navigateChoices(){}`,
  'project-session.js': `export function initProjectSession(){}`,
  'document-browser.js': `export function initDocumentBrowser(){}`,
  'visual-authoring.js': `export function initVisualAuthoring(){}`,
};
function setup(initial) {
  let saved = structuredClone(initial), revision = 'snapshot:1', sequence = 0;
  window.__requests = []; window.__saveFail = false; window.__saveDelay = 0; window.__contextDelay = 0; window.__confirm = true;
  window.__saved = () => structuredClone(saved);
  window.confirm = () => window.__confirm;
  window.prompt = () => { throw new Error('Direct canvas must not ask for an ID through prompt()'); };
  if (!crypto.randomUUID) crypto.randomUUID = () => `fixture-${++sequence}`;
  window.fetch = async (url, options = {}) => {
    const method = options.method || 'GET', headers = Object.fromEntries(new Headers(options.headers));
    window.__requests.push({ url, method, headers, body: options.body ? JSON.parse(options.body) : null });
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url === '/api/workspace') {
      if (method === 'POST') {
        await new Promise(resolve => setTimeout(resolve, window.__saveDelay));
        if (window.__saveFail || headers['x-product-graph-revision'] !== revision) return json({ message: 'Save conflict: keep the working graph' }, 409);
        const submitted = JSON.parse(options.body); saved.graph = submitted.graph; saved.layout = submitted.layout; revision = `snapshot:${++sequence}`;
      }
      return json({ ...saved, workspaceRevision: revision });
    }
    if (url === '/api/proposals') return json({ proposals: [{ id: 'test-proposal', title: 'Fixture proposal', status: 'pending', source: 'agent' }] });
    if (url.startsWith('/api/context?')) {
      await new Promise(resolve => setTimeout(resolve, window.__contextDelay));
      return json({ context: { why: [], whereUsed: [], impact: [], decisions: [], evidence: [] } });
    }
    if (url.endsWith('/preview')) return json({ proposal: { id: 'test-proposal' }, proposalRevision: 'review:1', canApply: true, diagnostics: [], diff: { nodesAdded: [], nodesChanged: [], edgesAdded: [] } });
    if (url === '/api/compare') return json({ nodesAdded: [], nodesRemoved: [], nodesChanged: [], edgesAdded: [], edgesRemoved: [] });
    throw new Error(`Unexpected fixture route: ${url}`);
  };
  document.querySelector('.sidebar-footnote').textContent = 'Canvas integration fixture · other tool adapters isolated';
}
export function canvasHTML(seed) {
  const cache = new Map(), data = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  const module = name => {
    if (cache.has(name)) return cache.get(name);
    const code = (adapters[name] ?? fs.readFileSync(path.join(ui, name), 'utf8')).replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (_, quote, file) => `from ${JSON.stringify(module(file.slice(2)))}`);
    const url = data(code); cache.set(name, url); return url;
  };
  const css = ['styles.css', 'studio.css', 'studio-design.css', 'direct-canvas.css'].map(name => fs.readFileSync(path.join(ui, name), 'utf8')).join('\n');
  return fs.readFileSync(path.join(ui, 'index.html'), 'utf8').replace(/<link rel="stylesheet"[^>]*>/g, '').replace('</head>', `<style>${css}</style></head>`)
    .replace('<script type="module" src="/app.js"></script>', `<script src="${data(`(${setup.toString()})(${JSON.stringify(seed)})`)}"></script><script type="module" src="${module('app.js')}"></script>`);
}
export async function openCanvas(browser, seed, width = 1440, height = 1000) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-direct-browser-'));
  const args = ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${home}`, 'about:blank'];
  if (process.getuid?.() === 0) args.unshift('--no-sandbox');
  const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket, sequence = 0; const pending = new Map(), errors = [];
  const close = async () => {
    for (const p of pending.values()) clearTimeout(p.timer); socket?.close();
    if (child.exitCode === null) { const ended = new Promise(resolve => child.once('close', resolve)); child.kill('SIGKILL'); await ended; }
    fs.rmSync(home, { recursive: true, force: true });
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let logs = ''; const timer = setTimeout(() => reject(new Error(`Browser startup timeout: ${logs}`)), 10000);
      child.once('error', e => { clearTimeout(timer); reject(e); });
      child.stderr.on('data', data => { logs += data; const m = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    socket.addEventListener('message', event => {
      const m = JSON.parse(event.data), p = pending.get(m.id);
      if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 8000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params = {}) => send(method, params, sessionId);
    await command('Runtime.enable'); await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const evaluate = async expression => {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    };
    const wait = async expression => {
      for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 20)); }
      throw new Error(`Wait failed: ${expression}\n${await evaluate('document.body.innerText')}\n${errors.join('\n')}`);
    };
    const box = selector => evaluate(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing: '+${JSON.stringify(selector)});el.scrollIntoView({block:'nearest',inline:'nearest'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()`);
    const mouse = (type, p, buttons = 0, clickCount = 1) => command('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount });
    const click = async (selector, double = false) => {
      let p = await box(selector); await mouse('mouseMoved', p);
      await mouse('mousePressed', p, 1); await mouse('mouseReleased', p);
      if (double) { p = await box(selector); await mouse('mousePressed', p, 1, 2); await mouse('mouseReleased', p, 0, 2); }
    };
    const key = async (key, code = key, modifiers = 0) => {
      const virtual = { Enter: 13, Escape: 27, F2: 113, Tab: 9, c: 67, Insert: 45, z: 90 }[key] || 0;
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode: virtual, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode: virtual });
    };
    const fill = (selector, value) => evaluate(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}`);
    const screenshot = async name => {
      if (!process.env.PRODUCT_GRAPH_SCREENSHOTS) return;
      fs.mkdirSync(process.env.PRODUCT_GRAPH_SCREENSHOTS, { recursive: true });
      const image = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(process.env.PRODUCT_GRAPH_SCREENSHOTS, name), Buffer.from(image.data, 'base64'));
    };
    const load = async seed => {
      await command('Page.navigate', { url: 'about:blank' });
      await wait("document.readyState==='complete' && !document.querySelector('#graph-svg')");
      await evaluate(`document.open();document.write(${JSON.stringify(canvasHTML(seed))});document.close()`);
      await wait(`document.querySelector('#project-name')?.textContent===${JSON.stringify(seed.graph.manifest.name)} && document.querySelector('#save-state')?.textContent==='Ready'`);
    };
    await load(seed);
    return { close, command, evaluate, wait, box, mouse, click, key, fill, screenshot, errors, load };
  } catch (error) { await close(); throw error; }
}
