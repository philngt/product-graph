import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('../../ui/', import.meta.url)));
/** Inline only this repository's static UI modules. Fixtures never execute remote resources. */
export function studioHTML(setup, fixture, checks) {
  const cache = new Map();
  const moduleURL = file => {
    if (cache.has(file)) return cache.get(file);
    if (!file.startsWith(root + path.sep) && path.dirname(file) !== root) throw new Error('Module outside UI root');
    const source = fs.readFileSync(file, 'utf8').replace(/from\s+(["'])(\.\/[^"']+)\1/g, (_, quote, relative) => `from ${JSON.stringify(moduleURL(path.resolve(path.dirname(file), relative)))}`);
    const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    cache.set(file, url); return url;
  };
  const app = moduleURL(path.join(root, 'app.js'));
  const css = ['styles.css', 'studio.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  return fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace(/<link rel="stylesheet"[^>]*>/g, '')
    .replace('</head>', `<style>${css}</style></head>`)
    .replace('<script type="module" src="/app.js"></script>', `<script>(${setup.toString()})(${JSON.stringify(fixture)});</script><script type="module" src="${app}"></script><script type="module">(${checks.toString()})();</script>`);
}

/** Actual Chromium DOM/CSS/JS; callers define API fixtures and assertions. */
export async function runStudioBrowser(html, { browser, profile, width = 1440, height = 1000, onReady } = {}) {
  const args = ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'];
  if (process.getuid?.() === 0) args.unshift('--no-sandbox');
  const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  const pending = new Map();
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`No browser endpoint: ${output}`)), 8000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.stderr.on('data', chunk => { output += chunk; const m = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data), entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id); clearTimeout(entry.timer);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 8000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params = {}) => send(method, params, sessionId);
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await command('Runtime.evaluate', { expression: `document.open(); document.write(${JSON.stringify(html)}); document.close();` });
    for (let i = 0; i < 200; i++) {
      const result = await command('Runtime.evaluate', { expression: 'JSON.stringify({status:document.documentElement.dataset.studioSmoke,report:document.querySelector("#studio-smoke-result")?.textContent})', returnByValue: true });
      const value = JSON.parse(result.result?.value || '{}');
      if (value.status) { if (onReady) await onReady(command); return value; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const debug = await command('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true });
    throw new Error(`Browser checks did not finish: ${debug.result?.value}`);
  } finally {
    pending.forEach(entry => clearTimeout(entry.timer));
    socket?.close();
    if (child.exitCode === null) { const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGKILL'); await closed; }
  }
}
