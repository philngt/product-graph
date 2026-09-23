import { OBJECT_CHOICES, RELATION_CHOICES, findConnectionTargets } from './canvas-edit-model.js';
import { CARD } from './canvas-layout.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svgElement = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; };

/** Direct manipulation adapter over the host's existing working graph and Undo/Save. */
export function createDirectCanvas({ state, positions, scopeIds, perform, showModel, startGesture, endGesture, notify }) {
  const svg = document.getElementById('graph-svg'), surface = document.getElementById('graph-canvas');
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/direct-canvas.css'; document.head.append(style);
  const toolbar = document.createElement('div'); toolbar.className = 'direct-toolbar'; toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', 'Selected object actions');
  toolbar.innerHTML = '<span id="direct-selected">Select an object</span><button type="button" data-direct="rename" title="Rename selected object (F2)">Rename</button><button type="button" data-direct="create" title="Add a related object (+)">＋ Related object</button><button type="button" data-direct="connect" title="Connect by name (C)">↗ Connect</button>';
  surface.before(toolbar);
  const hint = document.createElement('p'); hint.className = 'direct-hint'; hint.textContent = 'Double-click to rename or add · + adds a related object · Drag ↗ to connect · F2 / C work on a focused object'; surface.after(hint);
  let editor = null, draftChanged = false, gesture = null, suppressClickUntil = 0;
  const node = id => state.graph?.nodes.find(n => n.id === id);
  const blocked = () => {
    if (!state.graph || state.busy || state.dragging || editor || document.querySelector('dialog[open]')) return true;
    if (state.formDirty) { notify('Apply or discard the inspector draft before editing on the canvas. Your draft is unchanged.'); return true; }
    return false;
  };
  const elementFor = id => [...svg.querySelectorAll('[data-graph-node]')].find(el => el.dataset.graphNode === id);
  function worldPoint(x, y) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(x, y).matrixTransform(matrix.inverse());
  }
  function openEditor(title, body, anchorId, submit, first = 'input') {
    const d = document.createElement('dialog'); editor = d; draftChanged = false; let returnFocus = anchorId;
    d.className = 'direct-editor'; d.setAttribute('aria-labelledby', 'direct-editor-title');
    d.innerHTML = `<form><header><h3 id="direct-editor-title">${esc(title)}</h3><button type="button" data-cancel aria-label="Cancel edit">×</button></header>${body}<p id="direct-error" role="alert"></p><footer><span>Enter applies locally · Escape cancels</span><button class="button button-primary" id="direct-submit" type="submit">Apply</button></footer></form>`;
    const dispose = () => {
      if (editor !== d) return;
      editor = null; draftChanged = false; d.remove();
      (elementFor(returnFocus) || surface).focus({ preventScroll: true });
    };
    const close = () => { d.close(); dispose(); };
    d.addEventListener('cancel', e => { e.preventDefault(); close(); });
    d.addEventListener('close', dispose);
    d.querySelector('[data-cancel]').onclick = close;
    d.addEventListener('input', () => { draftChanged = true; d.querySelector('#direct-error').textContent = ''; });
    let composing = false;
    d.addEventListener('compositionstart', () => { composing = true; });
    d.addEventListener('compositionend', () => { composing = false; });
    d.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.isComposing || composing || e.keyCode === 229)) { e.preventDefault(); e.stopPropagation(); } });
    d.querySelector('form').onsubmit = event => {
      event.preventDefault(); if (composing) return;
      try {
        if (state.busy || state.dragging || state.formDirty) throw new Error('Finish the current save or inspector draft first.');
        if (submit(d) !== false) { returnFocus = state.selectedId || anchorId; close(); }
      } catch (error) { d.querySelector('#direct-error').textContent = error.message; }
    };
    document.body.append(d); d.showModal();
    const position = () => {
      const box = elementFor(anchorId)?.getBoundingClientRect() || surface.getBoundingClientRect();
      d.style.left = `${Math.max(12, Math.min(innerWidth - d.offsetWidth - 12, box.left))}px`;
      d.style.top = `${Math.max(12, Math.min(innerHeight - d.offsetHeight - 12, box.top))}px`;
    };
    position(); window.addEventListener('resize', position);
    const resize = new ResizeObserver(position); resize.observe(d);
    d.addEventListener('close', () => { window.removeEventListener('resize', position); resize.disconnect(); }, { once: true });
    const input = d.querySelector(first); input?.focus(); input?.select?.();
    return d;
  }
  function relationFields() {
    return `<label>What does this relationship mean?<select id="direct-kind" required><option value="">Choose explicitly…</option>${RELATION_CHOICES.map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('')}<option value="custom">Custom semantic relationship…</option></select></label><label id="direct-custom-row" hidden>Custom kind<input id="direct-custom" maxlength="80" placeholder="e.g. depends-on" /></label><p class="direct-note">This describes product meaning. It does not execute a workflow.</p>`;
  }
  function configureRelation(d) {
    const select = d.querySelector('#direct-kind');
    select.onchange = () => { const custom = select.value === 'custom'; d.querySelector('#direct-custom-row').hidden = !custom; d.querySelector('#direct-custom').required = custom; };
  }
  const relationValue = d => d.querySelector('#direct-kind').value === 'custom' ? d.querySelector('#direct-custom').value.trim() : d.querySelector('#direct-kind').value;
  function rename(id = state.selectedId) {
    if (blocked()) return;
    const n = node(id); if (!n) return notify('Select an existing object to rename.');
    const expectedTitle = n.title;
    openEditor('Rename object', `<label>Title<input id="direct-title" maxlength="200" required value="${esc(n.title)}" /></label><p class="direct-note">Only the title changes. Identity, relationships and metadata stay the same.</p>`, id,
      d => perform({ action: 'rename', id, expectedTitle, title: d.querySelector('#direct-title').value }));
  }
  function add(from, preferred) {
    if (blocked()) return;
    // Creating in a focus requires a real, explicitly related in-scope anchor.
    if (!from && state.scope.id !== 'project') from = state.scope.rootIds.find(id => node(id));
    if (state.scope.id !== 'project' && (!from || !scopeIds().has(from))) return notify('Choose an object in this focus, or open All models before adding.');
    if (from && !node(from)) return notify('Source object is missing.');
    showModel();
    const p = positions()[from];
    const point = preferred || (p ? { x: p.x + CARD.width + 100, y: p.y } : { x: 160, y: 120 });
    const d = openEditor(from ? 'Add related object' : 'Add product object', `${from ? `<p class="direct-source">From: <strong>${esc(node(from).title)}</strong></p>` : ''}<label>What does it represent?<select id="direct-choice" required><option value="">Choose object type…</option>${OBJECT_CHOICES.map(c => `<option value="${c.key}">${esc(c.label)}</option>`).join('')}</select></label><label>Title<input id="direct-title" required maxlength="200" placeholder="Name this product concept" /></label>${from ? relationFields() : ''}<p class="direct-note">Starts as a draft. The current lens may hide other object types; hidden is not deleted.</p>`, from,
      d => perform({ action: 'create', choice: d.querySelector('#direct-choice').value, title: d.querySelector('#direct-title').value, from, kind: from ? relationValue(d) : undefined }, point), '#direct-title');
    if (from) configureRelation(d);
  }
  function connect(from = state.selectedId, to) {
    if (blocked()) return;
    if (!node(from)) return notify('Select a source object before connecting.');
    const d = openEditor('Connect product objects', `<p class="direct-source">From: <strong>${esc(node(from).title)}</strong></p><label>Find destination by name<input id="direct-query" type="search" placeholder="Search this project" autocomplete="off" /></label><label>To<select id="direct-destination" size="5" required aria-describedby="direct-result-count"></select></label><p id="direct-result-count" class="direct-note"></p>${relationFields()}`, from,
      d => perform({ action: 'connect', from, to: d.querySelector('#direct-destination').value, kind: relationValue(d) }), to ? '#direct-kind' : '#direct-query');
    let firstResults = true;
    const results = () => {
      const previous = d.querySelector('#direct-destination').value || to || '';
      const { nodes, total } = findConnectionTargets(state.graph, from, d.querySelector('#direct-query').value);
      if (firstResults && to && node(to) && !nodes.some(n => n.id === to)) { nodes.unshift(node(to)); if (nodes.length > 80) nodes.pop(); }
      firstResults = false;
      d.querySelector('#direct-destination').innerHTML = nodes.map(n => `<option value="${esc(n.id)}">${esc(n.title)} · ${esc(n.type)} · ${esc(n.id)}</option>`).join('');
      const select = d.querySelector('#direct-destination'); select.value = nodes.some(n => n.id === previous) ? previous : '';
      d.querySelector('#direct-result-count').textContent = `${nodes.length} of ${total} matches in this project. Search to narrow; identities distinguish matching names.`;
    };
    // A drag destination must stay selectable even in a large project: filter by its name first.
    if (to && node(to)) d.querySelector('#direct-query').value = node(to).title;
    d.querySelector('#direct-query').oninput = results;
    results(); configureRelation(d);
  }
  function updateToolbar() {
    const n = node(state.selectedId);
    toolbar.querySelector('#direct-selected').textContent = n?.title || 'Select an object to edit';
    for (const b of toolbar.querySelectorAll('button')) b.disabled = !n || state.busy || Boolean(state.dragging);
  }
  function decorate() {
    updateToolbar();
    for (const element of svg.querySelectorAll('[data-graph-node]')) {
      // Siblings of the role=button card avoid nesting keyboard buttons inside a button.
      const id = element.dataset.graphNode, p = positions()[id]; if (!p) continue;
      const group = svgElement('g', { class: `direct-handles ${id === state.selectedId ? 'selected' : ''}`, 'data-handles-for': id });
      for (const [action, label, dy] of [['connect', '↗', -17], ['create', '+', 17]]) {
        const g = svgElement('g', { class: 'direct-handle', 'data-canvas-action': action, 'data-source': id, transform: `translate(${p.x + CARD.width / 2 + 18},${p.y + dy})`, role: 'button', tabindex: state.busy ? '-1' : '0', 'aria-disabled': String(state.busy), 'aria-label': `${action === 'connect' ? 'Connect from' : 'Add related to'} ${node(id).title}` });
        g.append(svgElement('circle', { r: 11 }));
        const text = svgElement('text', { 'text-anchor': 'middle', y: 4 }); text.textContent = label; g.append(text); group.append(g);
      }
      svg.append(group);
    }
  }
  function startConnection(event, from) {
    if (event.button !== 0 || blocked()) return;
    const p = positions()[from]; if (!p) return;
    startGesture();
    const line = svgElement('path', { class: 'direct-preview', 'aria-hidden': 'true' }); svg.append(line);
    const token = `${state.scope.id}:${state.view}`;
    let moved = false;
    function markTarget(x, y) {
      const destination = document.elementFromPoint(x, y)?.closest('[data-graph-node]');
      for (const el of svg.querySelectorAll('.direct-drop-target')) el.classList.remove('direct-drop-target');
      if (destination?.dataset.graphNode !== from) destination?.classList.add('direct-drop-target');
      return destination?.dataset.graphNode;
    }
    const move = e => {
      if (e.pointerId !== event.pointerId) return;
      if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 4) return;
      moved = true;
      const q = worldPoint(e.clientX, e.clientY); if (!q) return;
      const startX = p.x + CARD.width / 2 + 18;
      line.setAttribute('d', `M ${startX} ${p.y - 17} Q ${(startX + q.x) / 2} ${p.y - 17}, ${q.x} ${q.y}`);
      markTarget(e.clientX, e.clientY);
    };
    const finish = (cancel, e) => {
      if (e?.pointerId !== undefined && e.pointerId !== event.pointerId) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancelled); window.removeEventListener('blur', cancelled); window.removeEventListener('keydown', key, true); svg.removeEventListener('lostpointercapture', cancelled);
      if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
      const to = !cancel && moved && e ? markTarget(e.clientX, e.clientY) : null;
      line.remove(); for (const el of svg.querySelectorAll('.direct-drop-target')) el.classList.remove('direct-drop-target');
      gesture = null; endGesture(); updateToolbar(); suppressClickUntil = performance.now() + 120;
      if (cancel || token !== `${state.scope.id}:${state.view}`) return;
      if (!moved) connect(from);
      else if (to && to !== from) connect(from, to);
      else notify('Connection cancelled. Drop on another object, or use Connect to find it by name.');
    };
    const up = e => finish(false, e), cancelled = e => finish(true, e);
    const key = e => { e.preventDefault(); e.stopImmediatePropagation(); if (e.key === 'Escape') finish(true); };
    gesture = { cancel: () => finish(true) };
    svg.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancelled); window.addEventListener('blur', cancelled); window.addEventListener('keydown', key, true); svg.addEventListener('lostpointercapture', cancelled);
    updateToolbar();
  }
  // Capture handles before host node-drag/background-pan handlers see the event.
  svg.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-canvas-action]'); if (!handle) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (handle.dataset.canvasAction === 'connect') startConnection(event, handle.dataset.source);
  }, true);
  svg.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const handle = event.target.closest('[data-canvas-action]'); if (!handle) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (handle.dataset.canvasAction === 'create') add(handle.dataset.source);
    else connect(handle.dataset.source); // Keyboard/programmatic click; pointer gesture already consumed its click.
  }, true);
  svg.addEventListener('keydown', event => {
    if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    const handle = event.target.closest('[data-canvas-action]'), element = event.target.closest('[data-graph-node]');
    if (handle && ['Enter', ' '].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      (handle.dataset.canvasAction === 'create' ? add : connect)(handle.dataset.source); return;
    }
    if (!element) return;
    if (!['F2', 'c', 'C', '+', 'Insert'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const id = element.dataset.graphNode;
    if (event.key === 'F2') rename(id); else if (event.key.toLowerCase() === 'c') connect(id); else add(id);
  }, true);
  surface.addEventListener('dblclick', event => {
    if (event.target.closest('button, input, select, [data-canvas-action]')) return;
    // Host render replaces card DOM on first selection; the dblclick target may be the SVG.
    const card = event.target.closest('[data-graph-node]') || document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-graph-node]');
    event.preventDefault();
    if (card) rename(card.dataset.graphNode);
    else add(undefined, worldPoint(event.clientX, event.clientY));
  });
  for (const b of toolbar.querySelectorAll('button')) b.onclick = () => ({ rename, create: () => add(state.selectedId), connect })[b.dataset.direct]();
  window.addEventListener('beforeunload', e => { if (editor && draftChanged) { e.preventDefault(); e.returnValue = ''; } });
  return { decorate, updateToolbar, rename, add, connect, suppressClick: () => { suppressClickUntil = performance.now() + 120; }, cancelGesture: () => gesture?.cancel() };
}
