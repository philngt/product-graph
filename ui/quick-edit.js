import { OBJECT_CHOICES, RELATION_CHOICES, createObjectPlan, connectObjectsPlan, renameObjectPlan, findObjects } from './quick-edit-model.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NS = 'http://www.w3.org/2000/svg';

/** draw.io-inspired interaction ideas, implemented independently over the existing model. */
export function initQuickEdit({ state, apply, showModel, save, fit, toast }) {
  const $ = id => document.getElementById(id);
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/quick-edit.css'; document.head.append(style);
  const bar = document.createElement('div'); bar.className = 'quick-edit-toolbar'; bar.setAttribute('aria-label', 'Model authoring');
  bar.innerHTML = `<div><button id="quick-add" class="button button-secondary" type="button">＋ Add object</button><button id="quick-related" class="button button-secondary" type="button">＋ Add related</button><button id="quick-connect" class="button button-secondary" type="button">↗ Connect existing</button><button id="quick-rename" class="button button-secondary" type="button">Rename</button></div><button id="quick-help" class="text-button" type="button">Canvas help ?</button>`;
  $('lens-list').before(bar);
  const emptyAction = document.createElement('button'); emptyAction.id = 'quick-empty'; emptyAction.className = 'button button-primary'; emptyAction.type = 'button'; emptyAction.textContent = 'Add your first object';
  $('empty-state').append(emptyAction);
  let active = null, draftDirty = false;
  const node = id => state.graph?.nodes.find(n => n.id === id);
  const blocked = () => !state.graph || state.busy || Boolean(state.dragging);
  const canOpen = () => {
    if (blocked() || document.querySelector('dialog[open]')) return false;
    if (state.formDirty) { showModel(); toast('Apply your inspector draft first. It has not been discarded.'); $('node-title')?.focus(); return false; }
    return true;
  };
  function close(discard = true) {
    if (!active) return;
    if (discard && draftDirty && !confirm('Discard the unfinished form? No product changes have been made by this form.')) return;
    const current = active, opener = current.opener;
    active = null; draftDirty = false; current.dialog.close(); current.dialog.remove();
    if (opener?.isConnected) opener.focus({ preventScroll: true }); else $('graph-canvas').focus({ preventScroll: true });
  }
  function modal(title, subtitle, body) {
    const dialog = document.createElement('dialog'); dialog.className = 'quick-edit-dialog'; dialog.id = 'quick-edit-dialog'; dialog.setAttribute('aria-labelledby', 'quick-edit-title');
    dialog.innerHTML = `<header><div><p class="eyebrow">DEFINE PRODUCT MEANING</p><h2 id="quick-edit-title">${esc(title)}</h2><p>${esc(subtitle)}</p></div><button id="quick-close" type="button" class="icon-button" aria-label="Close">×</button></header>${body}`;
    active = { dialog, opener: document.activeElement }; draftDirty = false;
    document.body.append(dialog); dialog.querySelector('#quick-close').onclick = () => close();
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dialog.addEventListener('input', () => { draftDirty = true; });
    dialog.addEventListener('change', () => { draftDirty = true; });
    dialog.showModal(); return dialog;
  }
  const footer = label => `<p id="quick-error" class="quick-edit-error" role="alert"></p><footer><span>One undoable change · Save persists the whole model</span><button type="button" id="quick-cancel" class="button button-secondary">Cancel</button><button id="quick-submit" class="button button-primary" type="submit">${label}</button></footer>`;
  const relationshipFields = () => `<label>Relationship meaning<select id="quick-kind" required><option value="">Choose explicitly…</option>${RELATION_CHOICES.map(([kind, label]) => `<option value="${kind}">${esc(label)}</option>`).join('')}<option value="_custom">Other relationship…</option></select></label><label id="quick-custom-row" hidden>Custom relationship name<input id="quick-custom" maxlength="80" placeholder="e.g. presents" pattern="[a-z][a-z0-9:._-]{0,79}" /></label>`;
  function wireRelation(dialog, preview) {
    const select = dialog.querySelector('#quick-kind'), custom = dialog.querySelector('#quick-custom');
    const meaning = () => select.value === '_custom' ? custom.value.trim() : select.value;
    const update = () => { const isCustom = select.value === '_custom'; dialog.querySelector('#quick-custom-row').hidden = !isCustom; custom.required = isCustom; preview(meaning()); };
    select.onchange = update; custom.oninput = update; update(); return meaning;
  }
  function bindForm(dialog, submit) {
    dialog.querySelector('#quick-cancel').onclick = () => close();
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      if (blocked() || state.formDirty) { dialog.querySelector('#quick-error').textContent = 'The model is busy or has an unapplied inspector draft. Your form is retained.'; return; }
      try { if (submit() === false) return; close(false); }
      catch (error) { dialog.querySelector('#quick-error').textContent = error.message; }
    };
  }
  function create({ anchorId, point } = {}) {
    if (!canOpen()) return;
    // In a focus, its valid root is the explicit anchor. Never widen a missing focus silently.
    if (anchorId === undefined && state.scope.id !== 'project') anchorId = state.scope.rootIds.find(id => node(id));
    if (state.scope.id !== 'project' && !anchorId) { toast('The focus object is missing. Open All models or go Back before adding an object.'); return; }
    const anchor = anchorId ? node(anchorId) : null;
    if (anchorId && !anchor) { toast('The related object no longer exists.'); return; }
    showModel();
    const d = modal(anchor ? 'Add a related object' : 'Add a product object', anchor ? `Connected to ${anchor.title}. Choose the meaning and direction before creating it.` : 'Choose what it represents. IDs are assigned automatically; no code or workflow is executed.', `<form id="quick-object-form"><fieldset class="quick-object-choices"><legend>What are you defining?</legend>${OBJECT_CHOICES.map(choice => `<label><input name="quick-choice" type="radio" value="${choice.id}" required><span><strong>${esc(choice.label)}</strong><small>${esc(choice.hint)}</small></span></label>`).join('')}</fieldset><label>Name<input id="quick-title" required maxlength="200" autocomplete="off" placeholder="e.g. Record usage" /></label><details><summary>Details (optional)</summary><label>Description<textarea id="quick-description" rows="2" maxlength="2000"></textarea></label></details>${anchor ? `<div class="quick-relationship-box"><p>Related object: <strong>${esc(anchor.title)}</strong></p><label>Direction<select id="quick-direction"><option value="outgoing">Existing object → New object</option><option value="incoming">New object → Existing object</option></select></label>${relationshipFields()}<p id="quick-preview" class="quick-edge-preview" aria-live="polite"></p></div>` : ''}<label class="quick-check"><input id="quick-reveal" type="checkbox" checked>Show the result in this focus: switch to Overview, clear search and expand its neighborhood when needed (up to 8 hops).</label>${footer(anchor ? 'Create & connect' : 'Create object')}</form>`);
    const title = d.querySelector('#quick-title');
    let relationship = () => '';
    const preview = () => { if (!anchor) return; const forward = d.querySelector('#quick-direction').value === 'outgoing'; d.querySelector('#quick-preview').textContent = `${forward ? anchor.title : title.value || 'New object'} — ${relationship() || 'choose meaning'} → ${forward ? title.value || 'New object' : anchor.title}`; };
    if (anchor) { relationship = wireRelation(d, () => preview()); d.querySelector('#quick-direction').onchange = preview; title.oninput = preview; preview(); }
    bindForm(d, () => {
      const plan = createObjectPlan(state.graph, { choice: d.querySelector('[name=quick-choice]:checked')?.value, title: title.value, description: d.querySelector('#quick-description').value, anchorId: anchor?.id, kind: relationship(), direction: anchor ? d.querySelector('#quick-direction').value : undefined });
      return apply(plan, { action: 'create', anchorId: anchor?.id, point, reveal: d.querySelector('#quick-reveal').checked });
    });
    d.querySelector('[name=quick-choice]').focus();
  }
  function connect(id = state.selectedId) {
    if (!canOpen()) return;
    const source = node(id); if (!source) { toast('Select a product object first.'); return; }
    showModel();
    const d = modal('Connect existing objects', 'Search by name, type or ID. Reuse an object instead of making a copy. This does not change your focus.', `<form id="quick-connect-form"><p>Starting object: <strong>${esc(source.title)}</strong></p><label>Find another object<input id="quick-target-search" type="search" placeholder="Search this project…" autocomplete="off"></label><label>Destination<select id="quick-target" size="5" required aria-describedby="quick-search-count"></select></label><p id="quick-search-count" role="status"></p><div class="quick-relationship-box">${relationshipFields()}<button id="quick-swap" type="button" class="text-button">⇄ Reverse direction</button><p id="quick-preview" class="quick-edge-preview" aria-live="polite"></p></div>${footer('Create relationship')}</form>`);
    const destination = d.querySelector('#quick-target'), search = d.querySelector('#quick-target-search'); let reverse = false;
    let meaning = () => '';
    const preview = () => { const other = node(destination.value); d.querySelector('#quick-preview').textContent = `${reverse ? other?.title || 'Choose object' : source.title} — ${meaning() || 'choose meaning'} → ${reverse ? source.title : other?.title || 'Choose object'}`; };
    function results() {
      const previous = destination.value, result = findObjects(state.graph, search.value, source.id);
      destination.innerHTML = `<option value="">Choose an object…</option>` + result.nodes.map(n => `<option value="${esc(n.id)}">${esc(n.title)} · ${esc(n.type)} · ${esc(n.id)}</option>`).join('');
      destination.value = result.nodes.some(n => n.id === previous) ? previous : '';
      d.querySelector('#quick-search-count').textContent = `${result.nodes.length} of ${result.total} matches · searches the whole current project, including objects outside this focus`;
      preview();
    }
    meaning = wireRelation(d, preview); search.oninput = results; destination.onchange = preview;
    d.querySelector('#quick-swap').onclick = () => { reverse = !reverse; draftDirty = true; preview(); }; results();
    bindForm(d, () => {
      const plan = connectObjectsPlan(state.graph, { from: reverse ? destination.value : source.id, to: reverse ? source.id : destination.value, kind: meaning() });
      // The user's selected source remains selected even when the semantic arrow is reversed.
      return apply({ ...plan, selectedId: source.id }, { action: 'connect' });
    });
    search.focus();
  }
  function rename(id = state.selectedId) {
    if (!canOpen()) return;
    const selected = node(id); if (!selected) { toast('Select a product object first.'); return; }
    const d = modal('Rename object', 'Its stable ID and existing relationships stay unchanged.', `<form><label>Name<input id="quick-title" maxlength="200" required value="${esc(selected.title)}" autocomplete="off"></label>${footer('Update name')}</form>`);
    const expectedTitle = selected.title;
    bindForm(d, () => apply(renameObjectPlan(state.graph, { id: selected.id, title: d.querySelector('#quick-title').value, expectedTitle }), { action: 'rename' }));
    d.querySelector('#quick-title').focus(); d.querySelector('#quick-title').select();
  }
  function help() {
    if (document.querySelector('dialog[open]')) return;
    const d = modal('Work faster on the canvas', 'Buttons and forms provide the same actions. Shortcuts never replace text-editing keys inside inputs.', `<div class="quick-help"><p><kbd>N</kbd> Add object · <kbd>Shift N</kbd> Add related · <kbd>C</kbd> Connect existing</p><p><kbd>F2</kbd> Rename selected · <kbd>F</kbd> Fit view · <kbd>?</kbd> Help</p><p><kbd>Ctrl / ⌘ S</kbd> Save model from the canvas</p><p>Double-click empty canvas to create at that position. Use the ＋ beside the selected object to create a related object. Drag the background to pan; Fit view restores the view.</p><p>These shortcuts are active only while the model canvas has keyboard focus. Graph Undo/Redo remains separate from Back/Forward navigation.</p><p>Every new relationship needs an explicit meaning. Position, proximity and arrows do not authorize execution. All edits remain local until Save.</p></div>`);
    d.querySelector('#quick-close').focus();
  }
  function refresh() {
    const disabled = blocked(), hasSelection = Boolean(node(state.selectedId));
    for (const id of ['quick-add', 'quick-empty']) $(id).disabled = disabled;
    for (const id of ['quick-related', 'quick-connect', 'quick-rename']) $(id).disabled = disabled || !hasSelection;
    emptyAction.textContent = state.scope.id === 'project' ? 'Add a product object' : 'Add a related object';
  }
  function decorate(svg, positions) {
    svg.querySelectorAll('[data-quick-related]').forEach(el => el.remove());
    const selected = node(state.selectedId), position = positions[state.selectedId];
    if (blocked() || !selected || !position) return;
    const g = document.createElementNS(NS, 'g'); g.dataset.quickRelated = selected.id; g.classList.add('quick-related-handle');
    g.setAttribute('transform', `translate(${position.x + 130},${position.y})`); g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', `Add an object related to ${selected.title}`);
    const circle = document.createElementNS(NS, 'circle'); circle.setAttribute('r', '13');
    const label = document.createElementNS(NS, 'text'); label.setAttribute('text-anchor', 'middle'); label.setAttribute('y', '5'); label.textContent = '+';
    g.append(circle, label); svg.append(g);
    g.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    g.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); create({ anchorId: selected.id }); });
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); create({ anchorId: selected.id }); } });
  }
  const addRelated = () => { if (!node(state.selectedId)) { toast('Select an object before adding a related object.'); return; } create({ anchorId: state.selectedId }); };
  $('quick-add').onclick = () => create(); $('quick-related').onclick = addRelated;
  $('quick-connect').onclick = () => connect(); $('quick-rename').onclick = () => rename(); $('quick-help').onclick = help; emptyAction.onclick = () => create();
  $('graph-canvas').addEventListener('dblclick', event => {
    if (event.target.closest('[data-graph-node], [data-quick-related], .edge-line, .edge-label, button')) return;
    const svg = $('graph-svg');
    // The host redraws selection; a browser may retarget the second click to SVG.
    if ([...svg.querySelectorAll('[data-graph-node]')].some(el => { const r = el.getBoundingClientRect(); return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom; })) return;
    const matrix = svg.getScreenCTM();
    const p = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : undefined;
    event.preventDefault(); create({ point: p && { x: p.x, y: p.y } });
  });
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.repeat || document.querySelector('dialog[open]') || !event.target.closest?.('#graph-canvas') || event.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') { event.preventDefault(); save(); return; }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase(), action = key === 'n' ? (event.shiftKey ? addRelated : () => create()) : key === 'c' ? connect : key === 'f2' ? rename : key === 'f' ? fit : key === '?' ? help : null;
    if (action) { event.preventDefault(); action(); }
  });
  window.addEventListener('beforeunload', event => { if (active && draftDirty) { event.preventDefault(); event.returnValue = ''; } });
  refresh();
  return { create, connect, rename, refresh, decorate };
}
