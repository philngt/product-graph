import { spawn } from 'node:child_process';

/** Chromium rendering with an explicit test-only API transport.
 * Browser → CDP binding → the real local HTTP server. This is NOT a normal
 * browser-to-localhost networking test or a replacement for the full Studio suite.
 */
export async function launchAuthoringBrowser({ browser, profile, baseURL, width = 1440, height = 1000 }) {
  const args = ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'];
  if (process.getuid?.() === 0) args.unshift('--no-sandbox');
  const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const pending = new Map(), requests = [], errors = [];
  let ws, sequence = 0, session;
  async function close() {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
    pending.clear(); ws?.close();
    if (child.exitCode === null) { const ended = new Promise(resolve => child.once('close', resolve)); child.kill('SIGKILL'); await ended; }
  }
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let logs = ''; const timer = setTimeout(() => reject(new Error(`Chromium startup timeout: ${logs}`)), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.stderr.on('data', data => { logs += data; const match = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
      pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data), entry = pending.get(message.id);
      if (entry) { clearTimeout(entry.timer); pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
      if (message.method === 'Runtime.bindingCalled' && message.params.name === '__authoringTestTransport') {
        const payload = JSON.parse(message.params.payload);
        (async () => {
          if (!payload.url.startsWith('/api/')) throw new Error('Test transport only accepts project APIs');
          requests.push(payload);
          const response = await fetch(baseURL + payload.url, { method: payload.method, headers: payload.headers, ...(payload.body !== undefined ? { body: payload.body } : {}) });
          return { status: response.status, body: await response.json() };
        })().then(result => send('Runtime.evaluate', { expression: `window.__authoringTestReceive(${JSON.stringify(payload.id)}, ${JSON.stringify(result)})` }, session)).catch(error => {
          errors.push(error.message);
        });
      }
    });
    const target = await send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId: session } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }));
    const command = (method, params = {}) => send(method, params, session);
    await command('Runtime.enable'); await command('Runtime.addBinding', { name: '__authoringTestTransport' });
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const evaluate = async expression => {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    };
    return { command, evaluate, requests, errors, close };
  } catch (error) { await close(); throw error; }
}
