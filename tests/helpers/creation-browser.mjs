import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const root = fileURLToPath(new URL('../../', import.meta.url));
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/** In-memory, labelled adapter fixture. No network or production test globals. */
export async function openCreationBrowser(executable, width = 1440, height = 1000) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'product-graph-creation-'));
  const child = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket, id = 0; const pending = new Map(), errors = [];
  const close = async () => {
    socket?.close(); for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Browser closed')); } pending.clear();
    if (child.exitCode === null) { const stopped = once(child, 'exit').catch(() => {}); child.kill('SIGKILL'); await Promise.race([stopped, pause(1500)]); }
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = ''; const timer = setTimeout(() => reject(new Error('Chromium did not start within 10 seconds')), 10000);
      const fail = error => { clearTimeout(timer); reject(error); };
      child.once('error', fail); child.once('exit', code => fail(new Error(`Chromium exited: ${code}`)));
      child.stderr.on('data', data => { output = (output + data).slice(-16000); const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    const url = new URL(endpoint); let page;
    for (let attempt = 0; attempt < 100 && !page; attempt++) {
      const targets = await (await fetch(`http://${url.host}/json/list`)).json();
      page = targets.find(target => target.type === 'page'); if (!page) await pause(25);
    }
    if (!page) throw new Error('No Chromium page target within 2.5 seconds');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      const item = pending.get(message.id); if (!item) return;
      pending.delete(message.id); clearTimeout(item.timer); if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 8000);
      pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
    });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const wait = async expression => { for (let n = 0; n < 100; n++) { if (await evaluate(expression)) return; await pause(25); } throw new Error(`Timed out: ${expression}; ${errors.join(' | ')}`); };
    const box = selector => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing element');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};})()`);
    const mouse = (type, point, buttons = 0) => send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
    const click = async selector => { const point = typeof selector === 'string' ? await box(selector) : selector; await mouse('mouseMoved', point); await mouse('mousePressed', point, 1); await mouse('mouseReleased', point); await pause(40); };
    const key = async value => { const codes = { Enter: 13, Escape: 27, Tab: 9, F2: 113, ' ': 32 }; await send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, text: value === 'Enter' ? '\r' : value.length === 1 ? value : '', windowsVirtualKeyCode: codes[value] || value.toUpperCase().charCodeAt(0) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, windowsVirtualKeyCode: codes[value] || value.toUpperCase().charCodeAt(0) }); await pause(30); };
    const fill = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    // In-memory module host: no HTTP access and no browser-policy changes. Only
    // import specifiers are remapped; production module bodies stay unchanged.
    const modules = ['authoring-model.js', 'canvas-edit-model.js', 'canvas-layout.js', 'creation-model.js', 'creation-shelf.js', 'direct-canvas.js'];
    const imports = {};
    for (const name of modules) {
      const source = (await fs.readFile(path.join(root, 'ui', name), 'utf8')).replace(/(['"])\.\/([a-z-]+\.js)\1/g, (_, quote, file) => `${quote}pg/${file}${quote}`);
      imports[`pg/${name}`] = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
    }
    const css = await Promise.all(['direct-canvas.css', 'creation-shelf.css'].map(name => fs.readFile(path.join(root, 'ui', name), 'utf8')));
    let html = await fs.readFile(path.join(root, 'tests/fixtures/creation-shelf.html'), 'utf8');
    html = html.replace(/(['"])\/ui\/([a-z-]+\.js)\1/g, (_, quote, file) => `${quote}pg/${file}${quote}`)
      .replace('<script type="module">', `<style>${css.join('\n')}</style><script type="importmap">${JSON.stringify({ imports })}</script><script type="module">`);
    const tree = await send('Page.getFrameTree');
    await send('Page.setDocumentContent', { frameId: tree.frameTree.frame.id, html });
    await wait('window.fixtureReady===true');
    const screenshot = async name => { if (!process.env.PRODUCT_GRAPH_CREATION_ARTIFACTS) return; const data = await send('Page.captureScreenshot', { format: 'png' }); await fs.mkdir(process.env.PRODUCT_GRAPH_CREATION_ARTIFACTS, { recursive: true }); await fs.writeFile(path.join(process.env.PRODUCT_GRAPH_CREATION_ARTIFACTS, path.basename(name)), Buffer.from(data.data, 'base64')); };
    return { send, evaluate, wait, box, mouse, click, key, fill, screenshot, errors, close };
  } catch (error) { await close(); throw error; }
}
