import test from 'node:test';
import assert from 'node:assert/strict';
import { openCanvas } from './helpers/direct-canvas-browser.mjs';
const browser = process.env.PRODUCT_GRAPH_BROWSER;
const seed = () => ({ graph: { manifest: { projectId: 'fragrance', name: 'Fragrance Rotation', schemaVersion: '1' }, nodes: [
  { id: 'a', title: 'Record usage', region: 'workflow', type: 'step', status: 'draft', data: { retained: { important: true } }, document: 'doc:brief' },
  { id: 'b', title: 'Bottle', region: 'domain', type: 'entity', status: 'draft', data: {} },
  { id: 'c', title: 'Usage history', region: 'domain', type: 'entity', status: 'draft', data: {} },
], edges: [], documents: [{ id: 'doc:brief', title: 'Product brief', path: 'documents/brief.md', links: ['a'] }] },
layout: {}, focusAreas: [{ id: 'usage', title: 'Record usage', rootIds: ['a'], depth: 0 }], library: { templates: [], patterns: [] }, diagnostics: [], tours: [] });
const card = id => `[data-graph-node="${id}"]`;
const handle = (id, action) => `[data-canvas-action="${action}"][data-source="${id}"]`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function finishName(p, title) { await p.fill('#direct-title', title); await p.click('#direct-submit'); await p.wait(`!document.querySelector('.direct-editor')`); }
async function applyForm(p) { await p.click('#direct-submit'); await p.wait(`!document.querySelector('.direct-editor')`); }

for (const [width, height] of [[1440, 1000], [1024, 768]]) {
  test(`Canvas forms, keyboard, Undo and Save integration (${width}x${height})`, { skip: !browser, timeout: 45000 }, async t => {
    const p = await openCanvas(browser, seed(), width, height); t.after(p.close);
    const ev = p.evaluate;
    assert.equal(await ev(`document.querySelector('#undo-button').disabled`), true);
    await p.click(card('a')); assert.equal(await ev(`document.querySelector('#undo-button').disabled`), true);
    assert.equal(await ev(`document.querySelector('#node-id').value`), 'a');
    const camera = await ev(`document.querySelector('#graph-svg').getAttribute('viewBox')`);
    await p.click(card('a'), true); await p.wait(`document.querySelector('#direct-title')`);
    await p.fill('#direct-title', 'Cancelled title'); await p.key('Escape');
    assert.equal(await ev(`document.querySelector('#node-title').value`), 'Record usage');
    assert.equal(await ev(`document.querySelector('#undo-button').disabled`), true);
    assert.equal(await ev(`document.activeElement.dataset.graphNode`), 'a');
    await p.key('F2'); await p.wait(`document.querySelector('#direct-title')`);
    await p.key('Enter'); await p.wait(`!document.querySelector('.direct-editor')`);
    assert.equal(await ev(`document.querySelector('#undo-button').disabled`), true);
    await p.key('F2'); await p.wait(`document.querySelector('#direct-title')`);
    await p.fill('#direct-title', '   '); await p.click('#direct-submit');
    assert.match(await ev(`document.querySelector('#direct-error').textContent`), /1–200/);
    await p.fill('#direct-title', 'Ghi nhận sử dụng');
    await ev(`document.querySelector('#direct-title').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));document.querySelector('.direct-editor form').requestSubmit()`);
    assert.ok(await ev(`document.querySelector('.direct-editor')?.open`));
    await ev(`document.querySelector('#direct-title').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));document.querySelector('#direct-title').focus()`);
    await p.key('Enter'); await p.wait(`!document.querySelector('.direct-editor')`);
    assert.equal(await ev(`document.querySelector('#node-title').value`), 'Ghi nhận sử dụng');
    assert.equal(await ev(`document.querySelector('#graph-svg').getAttribute('viewBox')`), camera);
    await p.click('#undo-button'); assert.equal(await ev(`document.querySelector('#node-title').value`), 'Record usage');
    await p.click('#redo-button'); assert.equal(await ev(`document.querySelector('#node-title').value`), 'Ghi nhận sử dụng');
    // Related creation is one Undo entry including relationship and positioning.
    await p.click('#isolate-button');
    await p.click(handle('a', 'create')); await p.wait(`document.querySelector('#direct-choice')`);
    assert.equal(await ev(`document.querySelector('#direct-kind').value`), '');
    await p.fill('#direct-choice', 'step'); await p.fill('#direct-title', 'Validate input');
    assert.equal(await ev(`document.querySelector('.direct-editor form').checkValidity()`), false);
    await p.fill('#direct-kind', 'precedes');
    if (width === 1440) await p.screenshot('canvas-add-related.png');
    await applyForm(p);
    const newId = await ev(`document.querySelector('#node-id').value`);
    assert.notEqual(newId, 'a'); assert.equal(await ev(`document.querySelectorAll('[data-graph-node]').length`), 2);
    assert.match(await ev(`document.querySelector('#scope-summary').textContent`), /2 of 2/);
    await p.click('#undo-button'); assert.equal(await ev(`document.querySelectorAll('[data-graph-node]').length`), 1);
    await p.click('#redo-button'); assert.equal(await ev(`document.querySelectorAll('[data-graph-node]').length`), 2);
    await p.click('#all-models-button');
    await p.click(card('a')); await p.key('c'); await p.wait(`document.querySelector('#direct-query')`);
    await p.fill('#direct-query', 'Bottle'); await p.fill('#direct-destination', 'b'); await p.fill('#direct-kind', 'reads');
    if (width === 1440) await p.screenshot('canvas-connect-by-name.png');
    await applyForm(p);
    await p.click('[data-direct=connect]'); await p.fill('#direct-query', 'Bottle'); await p.fill('#direct-destination', 'b'); await p.fill('#direct-kind', 'reads'); await p.click('#direct-submit');
    assert.match(await ev(`document.querySelector('#direct-error').textContent`), /already exists/); await p.key('Escape');
    // Save still submits the complete graph, not only the isolated/filtered view.
    await p.click('#isolate-button'); await ev('window.__saveFail=true'); await p.click('#save-button');
    await p.wait(`document.querySelector('#save-feedback-text').textContent.includes('conflict')`);
    assert.equal(await ev(`document.querySelector('#save-state').textContent`), 'Unsaved changes');
    await ev('window.__saveFail=false'); await p.click('#save-button'); await p.wait(`document.querySelector('#save-state').textContent==='Ready'`);
    const saved = await ev('window.__saved()');
    assert.equal(saved.graph.nodes.length, 4); assert.equal(saved.graph.edges.length, 2); assert.equal(saved.graph.documents.length, 1);
    assert.deepEqual(saved.graph.nodes.find(n => n.id === 'a').data, { retained: { important: true } });
    assert.equal(saved.graph.nodes.find(n => n.id === 'a').document, 'doc:brief');
    assert.ok(Object.values(saved.layout).some(l => l.positions[newId]?.pinned));
    assert.ok((await ev('window.__requests')).filter(r => r.url === '/api/workspace' && r.method === 'POST').every(r => r.headers['x-product-graph-revision']));
    await p.load(saved); assert.equal(await ev(`document.querySelectorAll('[data-graph-node]').length`), 4);
    if (width === 1440) { await p.click(card('a')); await p.screenshot('canvas-direct-overview.png'); }
    assert.deepEqual(p.errors, []);
  });
  test(`Real pointer gestures and cancellation (${width}x${height})`, { skip: !browser, timeout: 45000 }, async t => {
    const p = await openCanvas(browser, seed(), width, height); t.after(p.close); const ev = p.evaluate;
    await p.click(card('a'));
    const initialCamera = await ev(`document.querySelector('#graph-svg').getAttribute('viewBox')`);
    const start = await p.box(handle('a', 'connect')), end = await p.box(card('b'));
    await p.mouse('mouseMoved', start); await p.mouse('mousePressed', start, 1); await p.mouse('mouseMoved', end, 1);
    assert.equal(await ev(`document.querySelectorAll('.direct-preview').length`), 1);
    assert.equal(await ev(`document.querySelectorAll('.edge-line').length`), 0);
    await p.key('Escape'); await p.mouse('mouseReleased', end); await sleep(140);
    assert.equal(await ev(`document.querySelectorAll('.direct-preview').length`), 0);
    assert.equal(await ev(`document.querySelector('#undo-button').disabled`), true);
    assert.equal(await ev(`document.querySelector('#graph-svg').getAttribute('viewBox')`), initialCamera);
    // Cancellation delivered by the browser/device also removes the transient preview.
    await ev(`window.addEventListener('pointerdown',e=>window.__pointer=e.pointerId,{once:true,capture:true})`);
    await p.mouse('mousePressed', start, 1); await p.mouse('mouseMoved', end, 1);
    assert.equal(await ev('Number.isInteger(window.__pointer)'), true);
    await ev(`window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.__pointer}))`);
    await p.mouse('mouseReleased', end); await sleep(140);
    assert.equal(await ev(`document.querySelectorAll('.direct-preview').length`), 0);
    assert.equal(await ev(`document.querySelector('#undo-button').disabled`), true);
    assert.equal(await ev(`document.querySelector('.direct-editor')===null`), true);
    // Drop on a real object; meaning is still explicit and no edge exists before Apply.
    await p.mouse('mousePressed', start, 1); await p.mouse('mouseMoved', end, 1); await p.mouse('mouseReleased', end); await sleep(140);
    await p.wait(`document.querySelector('#direct-kind')`);
    assert.equal(await ev(`document.querySelector('#direct-destination').value`), 'b');
    assert.equal(await ev(`document.querySelector('#direct-kind').value`), '');
    assert.equal(await ev(`document.querySelectorAll('.edge-line').length`), 0);
    await p.fill('#direct-kind', 'reads'); await applyForm(p);
    assert.equal(await ev(`document.querySelectorAll('.edge-line').length`), 1);
    await p.click('#undo-button'); assert.equal(await ev(`document.querySelectorAll('.edge-line').length`), 0);
    await p.click('#save-button'); await p.wait(`document.querySelector('#save-state').textContent==='Ready'`);
    // No-movement handle click opens searchable connection form without moving a card.
    await p.click(handle('a', 'connect')); await p.wait(`document.querySelector('#direct-query')`); await p.key('Escape'); await sleep(140);
    assert.equal(await ev(`document.querySelector('#save-state').textContent`), 'Ready');
    const point = await p.box(card('a')), moved = { x: point.x + 30, y: point.y + 35 };
    const beforeTransform = await ev(`document.querySelector('[data-graph-node=a]').getAttribute('transform')`);
    await p.mouse('mousePressed', point, 1); await p.mouse('mouseMoved', moved, 1); await p.mouse('mouseReleased', moved); await sleep(140);
    assert.notEqual(await ev(`document.querySelector('[data-graph-node=a]').getAttribute('transform')`), beforeTransform);
    await p.click('#undo-button'); assert.equal(await ev(`document.querySelector('[data-graph-node=a]').getAttribute('transform')`), beforeTransform);
    // Empty-space drop opens create-and-connect, but allocating still requires Apply.
    const s = await p.box(handle('a', 'connect')), frame = await ev(`(()=>{const r=document.querySelector('#graph-canvas').getBoundingClientRect();return {x:r.right-8,y:r.bottom-8}})()`);
    await p.mouse('mousePressed', s, 1); await p.mouse('mouseMoved', frame, 1); await p.mouse('mouseReleased', frame); await sleep(140);
    assert.equal(await ev(`document.querySelectorAll('.edge-line').length`), 0); assert.equal(await ev(`document.querySelectorAll('[data-graph-node]').length`), 3);
    assert.equal(await ev(`Boolean(document.querySelector('#direct-choice'))`), true);
    await p.click('[data-cancel]');
    assert.equal(await ev(`document.querySelector('.direct-editor')===null`), true);
    assert.equal(await ev(`document.querySelectorAll('[data-graph-node]').length`), 3);
    assert.deepEqual(p.errors, []);
  });
}

test('Inspector draft, IME/native undo, hidden lens, busy save and untrusted titles', { skip: !browser, timeout: 45000 }, async t => {
  const p = await openCanvas(browser, seed()); t.after(p.close); const ev = p.evaluate;
  await p.click(card('a')); await p.fill('#node-title', 'Inspector work not applied');
  await p.click('[data-direct=rename]'); assert.equal(await ev(`document.querySelector('.direct-editor')===null`), true);
  assert.equal(await ev(`document.querySelector('#node-title').value`), 'Inspector work not applied');
  await p.click('[data-lens=domain]'); await sleep(50); assert.equal(await ev(`document.querySelector('#node-title').value`), 'Inspector work not applied');
  await p.click('#node-form button[type=submit]'); await p.click('[data-direct=rename]');
  await p.fill('#direct-title', '<img src=x onerror=window.injected=true>');
  const before = await ev(`document.querySelector('#node-title').value`);
  await ev(`document.querySelector('#direct-title').focus()`); await p.key('z', 'KeyZ', 2);
  assert.equal(await ev(`document.querySelector('#node-title').value`), before);
  await p.fill('#direct-title', '<img src=x onerror=window.injected=true>');
  assert.equal(await ev(`!window.dispatchEvent(new Event('beforeunload',{cancelable:true}))`), true);
  await applyForm(p); assert.equal(await ev('window.injected'), undefined); assert.equal(await ev(`document.querySelector('#graph-svg img')===null`), true);
  // A type hidden by the current lens remains in the full graph and selection inspector.
  await p.click('[data-direct=create]'); await p.fill('#direct-choice', 'screen'); await p.fill('#direct-title', 'Usage detail'); await p.fill('#direct-kind', 'supports'); await applyForm(p);
  assert.match(await ev(`document.querySelector('#selection-visibility').textContent`), /hidden by this lens/);
  await ev('window.__saveDelay=150'); await p.click('#save-button');
  await ev(`document.querySelector('#add-node').click()`); assert.equal(await ev(`document.querySelector('.direct-editor')===null`), true);
  await p.wait(`document.querySelector('#save-state').textContent==='Ready'`);
  assert.equal((await ev('window.__saved()')).graph.nodes.length, 4);
  // Proposal application must remain blocked with a new direct edit that is not saved.
  await p.click('#all-models-button'); await p.click('[data-lens=overview]'); await p.click(card('a')); await p.click('[data-direct=rename]'); await finishName(p, 'Another local edit');
  await p.click('[data-tool=review]'); await p.click('[data-proposal-apply]');
  assert.match(await ev(`document.querySelector('#toast').textContent`), /save your model/);
  assert.equal((await ev('window.__requests')).filter(r => r.url.endsWith('/apply')).length, 0);
  assert.deepEqual(p.errors, []);
});

test('Blank canvas creation, keyboard-only handles and custom relation', { skip: !browser, timeout: 45000 }, async t => {
  const data = seed(); data.graph.nodes = []; data.graph.documents = []; data.focusAreas = [];
  const p = await openCanvas(browser, data); t.after(p.close); const ev = p.evaluate;
  await ev(`document.querySelector('#graph-canvas').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:300,clientY:300}))`); await p.wait(`document.querySelector('#direct-title')`);
  assert.equal(await ev(`document.querySelector('#direct-kind')===null`), true);
  await p.fill('#direct-choice', 'entity'); await p.fill('#direct-title', 'Bottle'); await applyForm(p);
  const source = await ev(`document.querySelector('#node-id').value`);
  assert.equal(await ev(`document.querySelectorAll('[data-graph-node]').length`), 1);
  await ev(`document.querySelector('[data-graph-node]').focus()`); await p.key('Insert');
  await p.wait(`document.querySelector('#direct-choice')`);
  await p.fill('#direct-choice', 'step'); await p.fill('#direct-title', 'Record usage');
  await p.fill('#direct-kind', 'custom'); await p.fill('#direct-custom', 'used-by'); await applyForm(p);
  const added = await ev(`document.querySelector('#node-id').value`);
  assert.notEqual(source, added);
  await ev(`document.querySelector(${JSON.stringify(handle(source, 'connect'))}).focus()`); await p.key('Enter');
  await p.wait(`document.querySelector('#direct-query')`);
  await p.fill('#direct-query', 'Record'); await p.fill('#direct-destination', added); await p.fill('#direct-kind', 'relates-to'); await applyForm(p);
  assert.equal(await ev(`document.querySelectorAll('.edge-line').length`), 2);
  await p.click('#save-button'); await p.wait(`document.querySelector('#save-state').textContent==='Ready'`);
  const saved = await ev('window.__saved()');
  assert.deepEqual(saved.graph.edges.map(e => e.kind), ['used-by', 'relates-to']);
  assert.ok(saved.graph.edges.every(e => e.data.executable === false));
  assert.deepEqual(p.errors, []);
});
