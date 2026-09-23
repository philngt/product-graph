import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
/** Actual Chromium input/DOM. The caller supplies a labelled host, not a live backend. */
export async function launch(browser, width, height) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-drawio-'));
  const child = spawn(browser, [...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), '--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let ws, seq = 0; const pending = new Map(), errors = [];
  const close = async () => { pending.forEach(p => clearTimeout(p.timer)); ws?.close(); if (child.exitCode === null) { const ended = new Promise(r => child.once('close', r)); child.kill('SIGKILL'); await ended; } fs.rmSync(dir, { recursive: true, force: true }); };
  try {
    const address = await new Promise((resolve, reject) => { let logs = ''; const timer = setTimeout(() => reject(new Error(logs)), 8000); child.on('error', e => { clearTimeout(timer); reject(e); }); child.stderr.on('data', data => { logs += data; const m = logs.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } }); });
    ws = new WebSocket(address); await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data), p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 8000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' }); const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId); await command('Runtime.enable', {}); await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; };
    const wait = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 30)); } throw new Error('Condition timed out: ' + expression + '\n' + await evaluate('document.body.innerText')); };
    return { command, evaluate, wait, close, errors,
      fill: (selector, value) => evaluate(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}`),
      click: selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),
      mouse: (type, p, buttons = 0) => command('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 }),
      key: key => command('Input.dispatchKeyEvent', { type: 'keyDown', key }),
    };
  } catch (e) { await close(); throw e; }
}
