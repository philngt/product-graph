import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { ProjectRegistry } from '../src/project-registry.ts';
import { startWorkspaceServer } from '../src/workspace-server.ts';
import { loadGraph, saveGraph } from '../src/io.ts';
import { launchBrowser } from './helpers/live-browser.mjs';

const browser = process.env.PRODUCT_GRAPH_LIVE_BROWSER;
async function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-live-'));
  const registry = new ProjectRegistry(home);
  const a = registry.create('Fragrance Rotation', 'Keep a collection in meaningful rotation.');
  const b = registry.create('Home Materials', 'A local passport for the materials in your home.');
  const c = registry.create('Rare Plant Genealogy', 'Preserve the origin of every plant.');
  fs.writeFileSync(path.join(a.root, 'documents/rotation.md'), '# Rotation rules\n\nKeep recommendations explainable.\n\n## Cooldown\n\nAvoid recently used bottles.\n\n[Overview](overview.md)\n\n<script>window.documentInjected=true</script>\n');
  fs.appendFileSync(path.join(a.root, 'documents/overview.md'), '\n[Rotation](rotation.md)\n');
  fs.mkdirSync(path.join(a.root, 'projections')); fs.writeFileSync(path.join(a.root, 'projections/domain.md'), '# Generated domain\n');
  const server = startWorkspaceServer(home, 0); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchBrowser(browser);
  t.after(async () => { await chrome.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(home, { recursive: true, force: true }); });
  return { home, registry, a, b, c, base, chrome };
}
const ready = (tab, name) => tab.wait(`document.querySelector('#project-name')?.textContent === ${JSON.stringify(name)} && document.querySelector('#save-state')?.textContent==='Ready'`);
async function switchTo(tab, id) {
  await tab.click('#switch-project'); await tab.wait(`document.querySelector('[data-project-id="${id}"]')`);
  await tab.click(`[data-project-id="${id}"]`);
}

test('real browser project catalog: create, open existing, search, recency, forget without deleting', { skip: !browser, timeout: 40000 }, async t => {
  const { registry, a, b, c, base, chrome } = await fixture(t), tab = await chrome.tab();
  await tab.goto(base); await tab.wait(`document.querySelectorAll('.project-card').length===3`);
  await tab.screenshot('projects.png');
  await tab.fill('#project-search', 'Home');
  assert.equal(await tab.evaluate(`document.querySelectorAll('.project-card').length`), 1);
  await tab.fill('#project-search', '');
  await tab.click(`[data-forget="${c.id}"]`); await tab.click('#forget-project [data-confirm]');
  await tab.wait(`document.querySelectorAll('.project-card').length===2`);
  assert.ok(fs.existsSync(path.join(c.root, 'project.json')));
  await tab.click('#open-project'); await tab.fill('#project-path', c.root); await tab.evaluate(`document.querySelector('#project-form').requestSubmit()`);
  await ready(tab, c.name);
  assert.equal(registry.list().length, 3);
  assert.ok(registry.list().some(item => item.root === c.root && item.lastOpenedAt));
  await tab.goto(base); await tab.wait(`document.querySelector('#new-project')`);
  await tab.click('#new-project'); await tab.fill('#project-name-input', 'Created in browser');
  await tab.fill('#project-description', 'A real on-disk product.'); await tab.evaluate(`document.querySelector('#project-form').requestSubmit()`);
  await ready(tab, 'Created in browser');
  const created = registry.list().find(item => item.name === 'Created in browser'); assert.ok(created);
  assert.equal(loadGraph(created.root).manifest.description, 'A real on-disk product.');
  assert.equal(loadGraph(a.root).manifest.name, a.name); assert.equal(loadGraph(b.root).manifest.name, b.name);
});

test('real browser switching: cancel/save/discard, failed-save guard and two-tab isolation', { skip: !browser, timeout: 50000 }, async t => {
  const { a, b, base, chrome } = await fixture(t), tab = await chrome.tab(), other = await chrome.tab(1024, 768);
  await tab.goto(`${base}/project/${a.id}/`); await ready(tab, a.name);
  await other.goto(`${base}/project/${b.id}/`); await ready(other, b.name);
  assert.equal(await other.evaluate(`document.querySelector('#switch-project').getClientRects().length>0`), true);
  await tab.click('#node-list [data-node="product:root"]'); await tab.fill('#node-title', 'Changed A');
  await switchTo(tab, b.id); await tab.wait(`document.querySelector('#switch-guard[open]')`);
  await tab.screenshot('switch-project.png');
  await tab.click('#switch-cancel');
  assert.equal(await tab.evaluate(`document.querySelector('#node-title').value`), 'Changed A');
  assert.equal(await tab.evaluate(`location.pathname`), `/project/${a.id}/`);
  await switchTo(tab, b.id); await tab.wait(`document.querySelector('#switch-save')`); await tab.click('#switch-save');
  await ready(tab, b.name);
  assert.equal(loadGraph(a.root).nodes[0].title, 'Changed A'); assert.equal(loadGraph(b.root).nodes[0].title, b.name);
  assert.equal(await tab.evaluate(`document.querySelector('#undo-button').disabled && document.querySelector('#back-button').disabled`), true);
  assert.equal(await other.evaluate(`document.querySelector('#project-name').textContent`), b.name);
  await tab.click('#node-list [data-node="product:root"]'); await tab.fill('#node-title', 'Discard B');
  await switchTo(tab, a.id); await tab.wait(`document.querySelector('#switch-discard')`); await tab.click('#switch-discard');
  await ready(tab, a.name);
  assert.equal(loadGraph(b.root).nodes[0].title, b.name);
  // Change the disk after loading A; UI must not leave or overwrite it on a failed save.
  const changed = loadGraph(a.root); changed.nodes[0].title = 'External revision'; saveGraph(a.root, changed);
  await tab.click('#node-list [data-node="product:root"]'); await tab.fill('#node-title', 'Stale local draft');
  await switchTo(tab, b.id); await tab.wait(`document.querySelector('#switch-save')`); await tab.click('#switch-save');
  await tab.wait(`document.querySelector('#switch-error')?.textContent.includes('Not saved')`);
  assert.equal(await tab.evaluate('location.pathname'), `/project/${a.id}/`);
  assert.equal(loadGraph(a.root).nodes[0].title, 'External revision');
  await tab.click('#switch-cancel'); assert.equal(await tab.evaluate(`document.querySelector('#node-title').value`), 'Stale local draft');
});

test('real browser documents: exact read-only source, outline, links/backlinks and graph context', { skip: !browser, timeout: 40000 }, async t => {
  const { a, base, chrome } = await fixture(t), tab = await chrome.tab();
  await tab.goto(`${base}/project/${a.id}/`); await ready(tab, a.name);
  await tab.click('#open-documents'); await tab.wait(`document.querySelectorAll('[data-document-path]').length===3`);
  await tab.click('[data-document-path="documents/overview.md"]'); await tab.wait(`document.querySelector('#document-source')?.value.startsWith('# Product overview')`);
  await tab.screenshot('documents.png');
  assert.equal(await tab.evaluate(`document.querySelector('#document-source').readOnly`), true);
  assert.equal(await tab.evaluate(`document.querySelectorAll('#document-outline button').length`), 2);
  await tab.evaluate(`document.querySelectorAll('#document-outline button')[1].click()`);
  assert.ok(await tab.evaluate(`document.querySelector('#document-source').selectionEnd > document.querySelector('#document-source').selectionStart`));
  assert.equal(await tab.evaluate(`document.querySelector('#document-nodes').textContent.includes('Fragrance Rotation')`), true);
  await tab.click('#document-links [data-read-path="documents/rotation.md"]');
  await tab.wait(`document.querySelector('#document-source').value.includes('Cooldown')`);
  assert.equal(await tab.evaluate('window.documentInjected'), undefined);
  assert.equal(await tab.evaluate(`document.querySelector('#document-source').value.includes('<script>')`), true);
  assert.equal(await tab.evaluate(`document.querySelector('#document-backlinks').textContent.includes('Product overview')`), true);
  await tab.fill('#document-kind', 'generated', 'change');
  assert.equal(await tab.evaluate(`document.querySelectorAll('[data-document-path]').length`), 1);
  await tab.fill('#document-search', 'missing'); assert.equal(await tab.evaluate(`document.querySelectorAll('[data-document-path]').length`), 0);
  await tab.fill('#document-search', ''); await tab.fill('#document-kind', 'all', 'change');
  fs.writeFileSync(path.join(a.root, 'documents/rotation.md'), '# Updated outside Studio\n');
  await tab.click('#documents-refresh'); await tab.wait(`document.querySelector('#document-source').value===${JSON.stringify('# Updated outside Studio\n')}`);
  await tab.click('[data-document-path="documents/overview.md"]'); await tab.wait(`document.querySelector('[data-inspect-node]')`); await tab.click('[data-inspect-node="product:root"]');
  assert.equal(await tab.evaluate(`document.querySelector('#document-browser')===null && document.querySelector('#node-id').value==='product:root'`), true);
  assert.equal(await tab.evaluate(`document.querySelector('#save-state').textContent`), 'Ready');
  assert.equal(loadGraph(a.root).nodes[0].title, a.name);
});
