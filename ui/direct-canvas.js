import { OBJECT_CHOICES, RELATION_CHOICES, findConnectionTargets } from './canvas-edit-model.js';
import { observedEdge } from './authoring-model.js';
import { CARD, connectorGeometry } from './canvas-layout.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svgElement = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; };

/** Direct adapter over the existing host commit/Undo/Save path. Never writes files. */
export function createDirectCanvas({ state, positions, scopeIds, perform, showModel, startGesture, endGesture, notify }) {
  const svg = document.getElementById('graph-svg'), surface = document.getElementById('graph-canvas');
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/direct-canvas.css'; document.head.append(style);
  const toolbar = document.createElement('div'); toolbar.className = 'direct-toolbar'; toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', 'Selected object actions');
  toolbar.innerHTML = '<span id="direct-selected">Select an object</span><button type="button" data-direct="add" title="Add to current scope (N)">＋ Add object</button><button type="button" data-direct="rename" title="Rename (F2)">Rename</button><button type="button" data-direct="create" title="Add a related object (+)">＋ Related</button><button type="button" data-direct="connect" title="Connect by name (C)">↗ Connect</button><button type="button" data-direct="help" title="Canvas help (?)">?</button>';
  surface.before(toolbar);
  const hint = document.createElement('p'); hint.className = 'direct-hint'; hint.textContent = 'Drag ↗ onto an object to connect, or empty canvas to create + connect · Click a relationship to edit · F2 / C / N / ?'; surface.after(hint);
  let editor = null, draftChanged = false, gesture = null, suppressClickUntil = 0;
  const node = id => state.graph?.nodes.find(n => n.id === id);
  const blocked = () => {
    if (!state.graph || state.busy || state.dragging || editor || document.querySelector('dialog[open]')) return true;
    if (state.formDirty) { notify('Apply or discard the inspector draft before editing on the canvas. Your draft is unchanged.'); return true; }
    return false;
  };
  const elementFor = id => [...svg.querySelectorAll('[data-graph-node]')].find(el => el.dataset.graphNode === id);
  function worldPoint(x, y) { const matrix = svg.getScreenCTM(); return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : null; }
  function openEditor(title, body, anchorId, submit, first = 'input') {
    const d = document.createElement('dialog'); editor = d; draftChanged = false; let returnFocus = anchorId;
    d.className = 'direct-editor'; d.setAttribute('aria-labelledby', 'direct-editor-title');
    d.innerHTML = `<form><header><h3 id="direct-editor-title">${esc(title)}</h3><button type="button" data-cancel aria-label="Cancel edit">×</button></header>${body}<p id="direct-error" role="alert"></p><footer><span>Apply changes locally · Save persists</span>${submit ? '<button class="button button-primary" id="direct-submit" type="submit">Apply</button>' : ''}</footer></form>`;
    const dispose = () => { if (editor !== d) return; editor = null; draftChanged = false; d.remove(); (elementFor(returnFocus) || surface).focus({ preventScroll: true }); };
    const close = (applied = false) => { if (!applied && draftChanged && !confirm('Discard these unapplied canvas edits?')) return; d.close(); dispose(); };
    d.addEventListener('cancel', e => { e.preventDefault(); close(); }); d.addEventListener('close', dispose);
    d.querySelector('[data-cancel]').onclick = () => close();
    for (const event of ['input', 'change']) d.addEventListener(event, () => { draftChanged = true; d.querySelector('#direct-error').textContent = ''; });
    let composing = false;
    d.addEventListener('compositionstart', () => { composing = true; }); d.addEventListener('compositionend', () => { composing = false; });
    d.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.isComposing || composing || e.keyCode === 229)) { e.preventDefault(); e.stopPropagation(); } });
    const finish = action => {
      try {
        if (composing || state.busy || state.dragging || state.formDirty) throw new Error('Finish the current save or inspector draft first.');
        if (action() !== false) { returnFocus = state.selectedId || anchorId; close(true); }
      } catch (error) { d.querySelector('#direct-error').textContent = error.message; }
    };
    d.querySelector('form').onsubmit = event => { event.preventDefault(); if (!composing && submit && d.querySelector('form').reportValidity()) finish(() => submit(d)); };
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
    return { dialog: d, finish };
  }
  function relationFields() {
    return `<label>What does this relationship mean?<select id="direct-kind" required><option value="">Choose explicitly…</option>${RELATION_CHOICES.map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('')}<option value="custom">Custom semantic relationship…</option></select></label><label id="direct-custom-row" hidden>Custom kind<input id="direct-custom" maxlength="80" placeholder="e.g. depends-on" /></label><p class="direct-note">Describes product meaning. No workflow is executed.</p>`;
  }
  function configureRelation(d, current = '') {
    const select = d.querySelector('#direct-kind');
    if (current) {
      select.value = RELATION_CHOICES.some(([kind]) => kind === current) ? current : 'custom';
      d.querySelector('#direct-custom').value = current;
    }
    select.onchange = () => { const custom = select.value === 'custom'; d.querySelector('#direct-custom-row').hidden = !custom; d.querySelector('#direct-custom').required = custom; };
    select.onchange();
  }
  const relationValue = d => d.querySelector('#direct-kind').value === 'custom' ? d.querySelector('#direct-custom').value.trim() : d.querySelector('#direct-kind').value;
  function rename(id = state.selectedId) {
    if (blocked()) return;
    const n = node(id); if (!n) return notify('Select an existing object to rename.');
    const expectedTitle = n.title;
    openEditor('Rename object', `<label>Title<input id="direct-title" maxlength="200" required value="${esc(n.title)}" /></label><p class="direct-note">Identity, relationships, documents and metadata stay the same.</p>`, id,
      d => perform({ action: 'rename', id, expectedTitle, title: d.querySelector('#direct-title').value }));
  }
  function add(from, preferred) {
    if (blocked()) return;
    if (!from && state.scope.id !== 'project') from = state.scope.rootIds.find(id => node(id));
    if (state.scope.id !== 'project' && (!from || !scopeIds().has(from))) return notify('Choose an object in this focus, or open All models before adding.');
    if (from && !node(from)) return notify('Source object is missing.');
    showModel();
    const p = positions()[from], point = preferred || (p ? { x: p.x + CARD.width + 100, y: p.y } : { x: 160, y: 120 });
    const { dialog: d } = openEditor(from ? 'Add related object' : 'Add product object', `${from ? `<p class="direct-source">From: <strong>${esc(node(from).title)}</strong></p>` : ''}<label>What does it represent?<select id="direct-choice" required><option value="">Choose object type…</option>${OBJECT_CHOICES.map(c => `<option value="${c.key}">${esc(c.label)}</option>`).join('')}</select></label><label>Title<input id="direct-title" required maxlength="200" placeholder="Name this product concept" /></label>${from ? relationFields() : ''}<p class="direct-note">New object and relationship form one Undo step. New objects are drafts. Your current lens may hide other types.</p>`, from,
      d => perform({ action: 'create', choice: d.querySelector('#direct-choice').value, title: d.querySelector('#direct-title').value, from, kind: from ? relationValue(d) : undefined }, point), '#direct-title');
    if (from) configureRelation(d);
  }
  function destinationFields() { return '<label>Find destination by name<input id="direct-query" type="search" placeholder="Search this project" autocomplete="off" /></label><label>To<select id="direct-destination" size="5" required aria-describedby="direct-result-count"></select></label><p id="direct-result-count" class="direct-note"></p>'; }
  function wireDestination(d, from, to, allowExistingSelf = false) {
    let first = true;
    const results = () => {
      const previous = d.querySelector('#direct-destination').value || to || '';
      const { nodes, total } = findConnectionTargets(state.graph, from, d.querySelector('#direct-query').value);
      if (first && to && node(to) && (to !== from || allowExistingSelf) && !nodes.some(n => n.id === to)) { nodes.unshift(node(to)); if (nodes.length > 80) nodes.pop(); }
      first = false;
      d.querySelector('#direct-destination').innerHTML = nodes.map(n => `<option value="${esc(n.id)}">${esc(n.title)} · ${esc(n.type)} · ${esc(n.id)}</option>`).join('');
      d.querySelector('#direct-destination').value = nodes.some(n => n.id === previous) ? previous : '';
      d.querySelector('#direct-result-count').textContent = `${nodes.length} shown · ${total} search matches. IDs disambiguate names. Search the whole project without changing focus.`;
    };
    if (to && node(to)) d.querySelector('#direct-query').value = node(to).title;
    d.querySelector('#direct-query').oninput = results; results();
  }
  function connect(from = state.selectedId, to) {
    if (blocked()) return;
    if (!node(from)) return notify('Select a source object before connecting.');
    const { dialog: d } = openEditor('Connect product objects', `<p class="direct-source">From: <strong>${esc(node(from).title)}</strong></p>${destinationFields()}${relationFields()}`, from,
      d => perform({ action: 'connect', from, to: d.querySelector('#direct-destination').value, kind: relationValue(d) }), to ? '#direct-kind' : '#direct-query');
    wireDestination(d, from, to); configureRelation(d);
  }
  function editEdge(index) {
    if (blocked()) return;
    const observed = observedEdge(state.graph, index), edge = observed.value, selectedId = state.selectedId;
    const { dialog: d, finish } = openEditor('Edit relationship', `<p class="direct-source">From: <strong>${esc(node(edge.from)?.title || edge.from)}</strong></p>${destinationFields()}${relationFields()}<p class="direct-note">Changes keep identity and metadata. Only destination and meaning change. Delete removes this relationship, never its objects.</p><button type="button" id="direct-delete-edge" class="button button-danger">Delete relationship</button>`, edge.from,
      d => { const ok = perform({ action: 'update-edge', observed, selectedId, to: d.querySelector('#direct-destination').value, kind: relationValue(d) }); if (ok !== false) notify('Relationship reviewed. Save the model to persist.'); return ok; }, '#direct-kind');
    wireDestination(d, edge.from, edge.to, edge.from === edge.to); configureRelation(d, edge.kind);
    d.querySelector('#direct-delete-edge').onclick = () => { if (!confirm('Delete this relationship? Its objects and documents will be kept.')) return; finish(() => { const ok = perform({ action: 'delete-edge', observed, selectedId }); if (ok !== false) notify('Relationship removed locally. Undo restores it; Save persists.'); return ok; }); };
  }
  function help() {
    if (!state.graph || state.busy || state.dragging || editor || document.querySelector('dialog[open]')) return;
    openEditor('Canvas help', '<dl class="direct-shortcuts"><dt>N / Add object</dt><dd>Add in the current scope; choose explicit meaning.</dd><dt>+ / Insert</dt><dd>Add related to the focused object.</dd><dt>C</dt><dd>Find and connect an existing object, even outside the current lens.</dd><dt>F2</dt><dd>Rename the focused object.</dd><dt>Drag ↗</dt><dd>Drop on an object to connect, on empty canvas to create + connect, or outside to cancel.</dd><dt>Relationship / Tab + Enter</dt><dd>Edit a connector’s meaning or destination.</dd><dt>Escape</dt><dd>Cancel a gesture; confirm discarding a changed form.</dd><dt>Undo / Save model</dt><dd>Edits are local and reversible. Save still writes the full graph.</dd></dl>', state.selectedId, null, '[data-cancel]');
  }
  function updateToolbar() {
    const n = node(state.selectedId); toolbar.querySelector('#direct-selected').textContent = n?.title || 'Select an object to edit';
    for (const b of toolbar.querySelectorAll('button')) b.disabled = !state.graph || state.busy || Boolean(state.dragging) || (!['add', 'help'].includes(b.dataset.direct) && !n);
  }
  function decorate() {
    updateToolbar();
    svg.querySelectorAll('.direct-handles, .direct-edge-hit').forEach(el => el.remove());
    const visible = new Set([...svg.querySelectorAll('[data-graph-node]')].map(el => el.dataset.graphNode)), lanes = new Map();
    state.graph.edges.forEach((edge, index) => {
      if (!visible.has(edge.from) || !visible.has(edge.to)) return;
      const pair = JSON.stringify([edge.from, edge.to].sort()), lane = lanes.get(pair) || 0; lanes.set(pair, lane + 1);
      const geometry = connectorGeometry(positions()[edge.from], positions()[edge.to], edge.from === edge.to, lane);
      const hit = svgElement('path', { class: 'direct-edge-hit', d: geometry.path, 'data-edge-index': index, role: 'button', tabindex: state.busy ? '-1' : '0', 'aria-disabled': String(state.busy), 'aria-label': `Edit relationship: ${node(edge.from).title} ${edge.kind} ${node(edge.to).title}` });
      const title = svgElement('title'); title.textContent = 'Click or press Enter to edit the relationship'; hit.append(title);
      svg.insertBefore(hit, svg.querySelector('[data-graph-node]'));
    });
    for (const element of svg.querySelectorAll('[data-graph-node]')) {
      const id = element.dataset.graphNode, p = positions()[id]; if (!p) continue;
      const group = svgElement('g', { class: `direct-handles ${id === state.selectedId ? 'selected' : ''}`, 'data-handles-for': id });
      for (const [action, label, dy] of [['connect', '↗', -17], ['create', '+', 17]]) {
        const g = svgElement('g', { class: 'direct-handle', 'data-canvas-action': action, 'data-source': id, transform: `translate(${p.x + CARD.width / 2 + 18},${p.y + dy})`, role: 'button', tabindex: state.busy ? '-1' : '0', 'aria-disabled': String(state.busy), 'aria-label': `${action === 'connect' ? 'Connect from' : 'Add related to'} ${node(id).title}` });
        g.append(svgElement('circle', { r: 11 })); const text = svgElement('text', { 'text-anchor': 'middle', y: 4 }); text.textContent = label; g.append(text); group.append(g);
      }
      svg.append(group);
    }
  }
  function startConnection(event, from) {
    if (event.button !== 0 || blocked()) return;
    const p = positions()[from]; if (!p) return;
    startGesture(); const line = svgElement('path', { class: 'direct-preview', 'aria-hidden': 'true' }); svg.append(line);
    const token = `${state.scope.id}:${state.view}`; let moved = false, done = false;
    function markTarget(x, y) {
      const destination = document.elementFromPoint(x, y)?.closest('[data-graph-node]');
      svg.querySelectorAll('.direct-drop-target').forEach(el => el.classList.remove('direct-drop-target'));
      if (destination?.dataset.graphNode !== from && svg.contains(destination)) destination?.classList.add('direct-drop-target');
      return svg.contains(destination) ? destination?.dataset.graphNode : null;
    }
    const move = e => {
      if (e.pointerId !== event.pointerId || done) return;
      if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 4) return;
      moved = true; const q = worldPoint(e.clientX, e.clientY); if (!q) return;
      const startX = p.x + CARD.width / 2 + 18;
      line.setAttribute('d', `M ${startX} ${p.y - 17} Q ${(startX + q.x) / 2} ${p.y - 17}, ${q.x} ${q.y}`); markTarget(e.clientX, e.clientY);
    };
    const finish = (cancel, e) => {
      if (done || e?.pointerId !== undefined && e.pointerId !== event.pointerId) return; done = true;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancelled); window.removeEventListener('blur', cancelled); window.removeEventListener('keydown', key, true); svg.removeEventListener('lostpointercapture', cancelled);
      if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
      const hit = !cancel && moved && e ? document.elementFromPoint(e.clientX, e.clientY) : null;
      const to = hit?.closest('[data-graph-node]')?.dataset.graphNode;
      const blank = hit && (hit === svg || hit === surface) && !to;
      const point = blank ? worldPoint(e.clientX, e.clientY) : null;
      line.remove(); svg.querySelectorAll('.direct-drop-target').forEach(el => el.classList.remove('direct-drop-target'));
      gesture = null; endGesture(); updateToolbar(); suppressClickUntil = performance.now() + 120;
      if (cancel || token !== `${state.scope.id}:${state.view}`) return;
      if (!moved) connect(from);
      else if (to && to !== from && svg.contains(hit)) connect(from, to);
      else if (blank && point) add(from, point);
      else notify('Connection cancelled. Drop on another object or empty canvas.');
    };
    const up = e => finish(false, e), cancelled = e => finish(true, e);
    const key = e => { e.preventDefault(); e.stopImmediatePropagation(); if (e.key === 'Escape') finish(true); };
    gesture = { cancel: () => finish(true) };
    svg.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancelled); window.addEventListener('blur', cancelled); window.addEventListener('keydown', key, true); svg.addEventListener('lostpointercapture', cancelled); updateToolbar();
  }
  svg.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-canvas-action]'), edge = event.target.closest('[data-edge-index]'); if (!handle && !edge) return;
    event.preventDefault(); event.stopImmediatePropagation(); if (handle?.dataset.canvasAction === 'connect') startConnection(event, handle.dataset.source);
  }, true);
  svg.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const edge = event.target.closest('[data-edge-index]'), handle = event.target.closest('[data-canvas-action]'); if (!edge && !handle) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (edge) editEdge(Number(edge.dataset.edgeIndex));
    else (handle.dataset.canvasAction === 'create' ? add : connect)(handle.dataset.source);
  }, true);
  surface.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable=true]') || document.querySelector('dialog[open]')) return;
    const edge = event.target.closest('[data-edge-index]'), handle = event.target.closest('[data-canvas-action]'), element = event.target.closest('[data-graph-node]');
    if (edge && ['Enter', ' ', 'F2'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); editEdge(Number(edge.dataset.edgeIndex)); return; }
    if (handle && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); (handle.dataset.canvasAction === 'create' ? add : connect)(handle.dataset.source); return; }
    if (event.key === '?') { event.preventDefault(); help(); return; }
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); add(event.shiftKey ? element?.dataset.graphNode || state.selectedId : undefined); return; }
    if (!element || !['F2', 'c', 'C', '+', 'Insert'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); const id = element.dataset.graphNode;
    if (event.key === 'F2') rename(id); else if (event.key.toLowerCase() === 'c') connect(id); else add(id);
  }, true);
  surface.addEventListener('dblclick', event => {
    if (event.target.closest('button,input,select,[data-canvas-action],[data-edge-index]')) return;
    const card = event.target.closest('[data-graph-node]') || document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-graph-node]');
    event.preventDefault(); if (card) rename(card.dataset.graphNode); else add(undefined, worldPoint(event.clientX, event.clientY));
  });
  for (const b of toolbar.querySelectorAll('button')) b.onclick = () => ({ rename, create: () => add(state.selectedId), add: () => add(), connect, help })[b.dataset.direct]();
  window.addEventListener('beforeunload', e => { if (editor && draftChanged) { e.preventDefault(); e.returnValue = ''; } });
  return { decorate, updateToolbar, rename, add, connect, editEdge, help, suppressClick: () => { suppressClickUntil = performance.now() + 120; }, cancelGesture: () => gesture?.cancel() };
}
