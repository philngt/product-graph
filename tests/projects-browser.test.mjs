import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './helpers/live-browser.mjs';

const browser = process.env.PRODUCT_GRAPH_BROWSER;
const ui = fileURLToPath(new URL('../ui/', import.meta.url));
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const fixture = { a: A, b: B };

function setup({ a, b }) {
  const roots = [{ id: a, name: 'Fragrance Rotation', root: '/Users/demo/Products/fragrance-rotation', description: 'A more intentional fragrance collection.', available: true, lastOpenedAt: null }, { id: b, name: 'Home Materials', root: '/Users/demo/Products/home-materials', description: 'A material passport for your home.', available: true, lastOpenedAt: null }];
  const graph = { manifest: { projectId: a, name: roots[0].name }, nodes: [{ id: 'product:root', region: 'product', type: 'product', title: 'Fragrance Rotation', data: {} }], edges: [], documents: [{ id: 'doc:overview', title: 'Product overview', path: 'documents/overview.md', links: ['product:root'] }] };
  const overview = '# Product overview\n\nBuild a local collection manager.\n\n## Intent\n\nUse the collection intentionally.\n\n[Rotation](rotation.md)\n';
  const docs = [
    { path: 'documents/overview.md', title: 'Product overview', kind: 'source', available: true, nodeIds: ['product:root'], content: overview },
    { path: 'documents/rotation.md', title: 'Rotation rules', kind: 'source', available: true, nodeIds: [], content: '# Rotation rules\n\n## Cooldown\n\n<script>window.injected=true</script>\n' },
    { path: 'projections/domain.md', title: 'Generated domain', kind: 'generated', available: true, nodeIds: [], content: '# Generated domain\n' },
  ];
  window.__fixture = { roots, graph, docs, saves: 0, conflict: false, revision: 'rev:1', writeTargets: [], a, b };
  window.fetch = async (input, options = {}) => {
    const f = window.__fixture, url = new URL(input, 'http://fixture'), method = options.method || 'GET';
    const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    const payload = () => JSON.parse(options.body || '{}');
    if (url.pathname === '/api/projects') {
      if (method === 'POST') { const project = { id: '33333333-3333-4333-8333-333333333333', ...payload(), root: '/Users/demo/Products/new', available: true }; f.roots.push(project); return respond({ project }); }
      return respond({ projects: structuredClone(f.roots), managedDirectory: '/Users/demo/.productgraph/projects' });
    }
    if (url.pathname === '/api/projects/open') {
      const project = f.roots.find(item => item.root === payload().path);
      return project ? respond({ project }) : respond({ message: 'Project folder not found' }, 404);
    }
    const match = url.pathname.match(/^\/api\/projects\/([^/]+)(.*)$/);
    if (!match) throw new Error(`Unexpected request: ${url.pathname}`);
    const [, id, suffix] = match;
    if (!suffix) {
      const project = f.roots.find(item => item.id === id);
      if (method === 'DELETE') { f.roots.splice(f.roots.indexOf(project), 1); return respond({ filesDeleted: false }); }
      return respond({ project });
    }
    if (suffix === '/visit') return respond({ ok: true });
    if (suffix === '/workspace') {
      if (method === 'POST') {
        f.writeTargets.push(id);
        if (f.conflict) return respond({ message: 'Project changed on disk' }, 409);
        if (new Headers(options.headers).get('X-Product-Graph-Revision') !== f.revision) return respond({ message: 'Wrong revision' }, 409);
        f.graph = payload().graph; f.saves++; f.revision = `rev:${f.saves + 1}`;
      }
      return respond({ graph: structuredClone(f.graph), layout: {}, focusAreas: [], library: { patterns: [], templates: [] }, diagnostics: [], tours: [], workspaceRevision: f.revision });
    }
    if (suffix === '/proposals') return respond({ proposals: [] });
    if (suffix === '/context') return respond({ context: { why: [], whereUsed: [], impact: [], decisions: [], evidence: [] } });
    if (suffix === '/documents') return respond({ documents: f.docs, notices: [], truncated: false });
    if (suffix === '/documents/read') {
      const doc = structuredClone(f.docs.find(item => item.path === url.searchParams.get('path')));
      await new Promise(resolve => setTimeout(resolve, doc.path.includes('rotation') ? 150 : 5));
      return respond({ ...doc, revision: 'sha256:1234567890abcdef', bytes: doc.content.length, headings: [{ title: 'Product overview', level: 1, line: 1 }, { title: 'Intent', level: 2, line: 5 }], nodes: doc.nodeIds.length ? f.graph.nodes : [], links: doc.path.includes('overview') ? [f.docs[1]] : [], backlinks: doc.path.includes('rotation') ? [f.docs[0]] : [], truncated: false });
    }
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
}

// Exercise actual UI modules. Only network and full-page navigation are test boundaries.
function html(entry, studio) {
  const cache = new Map();
  const moduleURL = name => {
    if (cache.has(name)) return cache.get(name);
    let source = fs.readFileSync(path.join(ui, name), 'utf8');
    if (name === 'workspace-ui.js') source = source.replace('location.assign(href);', 'window.__destination = href;');
    if (name === 'app.js') source = source.replace('createProjectClient(location.pathname)', `createProjectClient('/project/${A}/')`);
    source = source.replace(/from\s+(["'])(\.\/[^"']+)\1/g, (_, quote, relative) => `from ${JSON.stringify(moduleURL(relative.slice(2)))}`);
    const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    cache.set(name, url); return url;
  };
  const css = ['styles.css', 'studio.css', 'projects.css'].map(file => fs.readFileSync(path.join(ui, file), 'utf8')).join('\n');
  return fs.readFileSync(path.join(ui, studio ? 'index.html' : 'projects.html'), 'utf8')
    .replace(/<link rel="stylesheet"[^>]*>/g, '')
    .replace('</head>', `<link rel="stylesheet" data-workspace-style href="data:text/css;base64,${Buffer.from(css).toString('base64')}"></head>`)
    .replace(/<script type="module" src="\/(app|projects).js"><\/script>/, `<script>(${setup.toString().replaceAll("</script", "<\\/script")})(${JSON.stringify(fixture)});</script><script type="module" src="${moduleURL(entry)}"></script>`);
}
async function page(t, studio, width = 1440) {
  const chrome = await launchBrowser(browser); t.after(chrome.close);
  const tab = await chrome.tab(width, 1000);
  await tab.evaluate(`document.open();document.write(${JSON.stringify(html(studio ? 'app.js' : 'projects.js', studio))});document.close();`);
  await tab.wait(studio ? `document.querySelector('#save-state')?.textContent==='Ready'` : `document.querySelectorAll('.project-card').length===2`);
  return tab;
}
async function switchPrompt(tab) {
  await tab.click('#switch-project'); await tab.wait(`document.querySelector('[data-project-id="${B}"]')`); await tab.click(`[data-project-id="${B}"]`); await tab.wait(`document.querySelector('#switch-guard[open]')`);
}

test('browser fixtures: project cards, filters, create/open/remove and recoverable errors', { skip: !browser, timeout: 30000 }, async t => {
  const tab = await page(t, false);
  await tab.screenshot('projects.png');
  await tab.fill('#project-search', 'Home'); assert.equal(await tab.evaluate(`document.querySelectorAll('.project-card').length`), 1);
  await tab.fill('#project-search', '');
  await tab.click('#open-project'); await tab.fill('#project-path', '/missing'); await tab.evaluate(`document.querySelector('#project-form').requestSubmit()`);
  await tab.wait(`document.querySelector('#project-form-error').textContent==='Project folder not found'`);
  assert.equal(await tab.evaluate('window.__destination'), undefined);
  await tab.fill('#project-path', '/Users/demo/Products/home-materials'); await tab.evaluate(`document.querySelector('#project-form').requestSubmit()`);
  await tab.wait(`window.__destination==='/project/${B}/'`); await tab.click('#project-form-cancel');
  await tab.click(`[data-forget="${B}"]`); await tab.click('#forget-project [data-cancel]'); assert.equal(await tab.evaluate('window.__fixture.roots.length'), 2);
  await tab.click(`[data-forget="${B}"]`); await tab.click('#forget-project [data-confirm]'); await tab.wait(`document.querySelectorAll('.project-card').length===1`);
  await tab.click('#new-project'); await tab.fill('#project-name-input', 'A new product'); await tab.fill('#project-description', 'Plain files'); await tab.evaluate(`document.querySelector('#project-form').requestSubmit()`);
  await tab.wait(`window.__destination.includes('33333333')`); assert.equal(await tab.evaluate('window.__fixture.roots[1].name'), 'A new product');
});

test('browser fixtures: switching cancels, saves correct project, blocks conflicts, discards explicitly', { skip: !browser, timeout: 30000 }, async t => {
  const tab = await page(t, true, 1024);
  assert.equal(await tab.evaluate(`document.querySelector('#switch-project').getClientRects().length>0`), true);
  await tab.click('#node-list [data-node="product:root"]'); await tab.fill('#node-title', 'Changed A');
  await switchPrompt(tab); await tab.screenshot('switch-project.png'); await tab.click('#switch-cancel');
  assert.equal(await tab.evaluate(`document.querySelector('#node-title').value`), 'Changed A'); assert.equal(await tab.evaluate('window.__destination'), undefined);
  await switchPrompt(tab); await tab.click('#switch-save'); await tab.wait(`window.__destination==='/project/${B}/'`);
  assert.equal(await tab.evaluate('window.__fixture.graph.nodes[0].title'), 'Changed A');
  assert.equal(await tab.evaluate('window.__fixture.saves'), 1);
  assert.deepEqual(await tab.evaluate('window.__fixture.writeTargets'), [A]);
  // A fresh JS context models a new tab/reload for conflict and discard checks.
  const other = await page(t, true); await other.click('#node-list [data-node="product:root"]'); await other.fill('#node-title', 'Unsaved');
  await other.evaluate('window.__fixture.conflict=true'); await switchPrompt(other); await other.click('#switch-save');
  await other.wait(`document.querySelector('#switch-error').textContent.includes('Not saved')`);
  assert.equal(await other.evaluate('window.__destination'), undefined); assert.equal(await other.evaluate('window.__fixture.saves'), 0);
  await other.click('#switch-cancel'); assert.equal(await other.evaluate(`document.querySelector('#node-title').value`), 'Unsaved');
  await switchPrompt(other); await other.click('#switch-discard'); await other.wait(`window.__destination==='/project/${B}/'`);
  assert.equal(await other.evaluate('window.__fixture.graph.nodes[0].title'), 'Fragrance Rotation');
});

test('browser fixtures: document source/outline/backlinks, filter and late-read protection', { skip: !browser, timeout: 30000 }, async t => {
  const tab = await page(t, true); await tab.click('#open-documents'); await tab.wait(`document.querySelectorAll('[data-document-path]').length===3`);
  await tab.click('[data-document-path="documents/overview.md"]'); await tab.wait(`document.querySelector('#document-source').value.startsWith('# Product overview')`);
  await tab.screenshot('documents.png'); assert.equal(await tab.evaluate(`document.querySelector('#document-source').readOnly`), true);
  await tab.evaluate(`document.querySelectorAll('#document-outline button')[1].click()`);
  assert.ok(await tab.evaluate(`document.querySelector('#document-source').selectionEnd>document.querySelector('#document-source').selectionStart`));
  await tab.click('#document-links [data-read-path="documents/rotation.md"]'); await tab.wait(`document.querySelector('#document-source').value.includes('Cooldown')`);
  assert.equal(await tab.evaluate('window.injected'), undefined); assert.equal(await tab.evaluate(`document.querySelector('#document-backlinks').textContent.includes('Product overview')`), true);
  await tab.click('[data-document-path="documents/rotation.md"]'); await tab.click('[data-document-path="documents/overview.md"]');
  await new Promise(resolve => setTimeout(resolve, 300)); assert.equal(await tab.evaluate(`document.querySelector('#document-source').value.startsWith('# Product overview')`), true);
  await tab.fill('#document-kind', 'generated', 'change'); assert.equal(await tab.evaluate(`document.querySelectorAll('[data-document-path]').length`), 1);
  await tab.fill('#document-search', 'nothing'); assert.equal(await tab.evaluate(`document.querySelectorAll('[data-document-path]').length`), 0);
  await tab.fill('#document-search', ''); await tab.fill('#document-kind', 'all', 'change');
  await tab.click('[data-document-path="documents/overview.md"]'); await tab.wait(`document.querySelector('[data-inspect-node]')`); await tab.click('[data-inspect-node="product:root"]');
  assert.equal(await tab.evaluate(`document.querySelector('#document-browser')===null && document.querySelector('#node-id').value==='product:root'`), true);
  assert.equal(await tab.evaluate(`document.querySelector('#save-state').textContent`), 'Ready');
});
