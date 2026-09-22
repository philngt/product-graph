import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

/** Small CDP harness over real localhost routes; no intercepted API responses. */
export async function launchBrowser(executable) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-browser-'));
  const args = ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'];
  if (process.getuid?.() === 0) args.unshift('--no-sandbox');
  const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket; const pending = new Map();
  const close = async () => {
    pending.forEach(item => clearTimeout(item.timer)); socket?.close();
    if (child.exitCode === null) { const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGKILL'); await closed; }
    fs.rmSync(profile, { recursive: true, force: true });
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Browser did not start: ${output}`)), 8000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let nextId = 0;
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data), item = pending.get(message.id); if (!item) return;
      pending.delete(message.id); clearTimeout(item.timer);
      message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 8000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    async function tab(width = 1440, height = 1000) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const command = (method, params) => send(method, params, sessionId);
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      const evaluate = async expression => {
        const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result?.value;
      };
      const wait = async expression => {
        for (let i = 0; i < 100; i++) {
          try { if (await evaluate(expression)) return; } catch { /* A page navigation replaces the execution context. */ }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(`Condition failed: ${expression}\n${await evaluate('document.body.innerText')}`);
      };
      const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      const fill = (selector, value, event = 'input') => evaluate(`{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));}`);
      const screenshot = async name => {
        const directory = process.env.PRODUCT_GRAPH_SCREENSHOTS; if (!directory) return;
        fs.mkdirSync(directory, { recursive: true });
        const { data } = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(directory, name), Buffer.from(data, 'base64'));
      };
      return { command, evaluate, wait, click, fill, screenshot, goto: url => command('Page.navigate', { url }) };
    }
    return { tab, close };
  } catch (error) { await close(); throw error; }
}
