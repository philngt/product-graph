import { creationChoices, creationPlacement } from './creation-model.js';
import { CARD, connectorGeometry } from './canvas-layout.js';

const NS = 'http://www.w3.org/2000/svg';
const CORE = new Set(['feature', 'entity', 'flow', 'step', 'rule', 'screen']);
// Icons are presentation only; every kind/description comes from authoring-model.
const ICONS = {
  feature: 'M12 3 15 9 21 12 15 15 12 21 9 15 3 12 9 9Z',
  entity: 'M4 7 12 3 20 7 20 17 12 21 4 17Z M4 7 12 11 20 7 M12 11V21',
  flow: 'M3 5H9V11H3Z M15 13H21V19H15Z M9 8H18V13',
  step: 'M4 5H20V19H4Z M8 12H16 M13 9 16 12 13 15',
  rule: 'M12 3 21 12 12 21 3 12Z M9 12 11 14 15 10',
  screen: 'M3 4H21V18H3Z M3 8H21 M8 21H16',
  service: 'M4 4H10V10H4Z M14 14H20V20H14Z M14 4H20V10H14Z M7 10V17H14',
  plan: 'M4 6H20V20H4Z M8 6V3H16V6 M4 11H20 M10 11V14H14V11',
  constraint: 'M12 3 20 6V12Q20 18 12 21Q4 18 4 12V6Z M8 12H16',
  decision: 'M12 3V11 M12 11 5 18 M12 11 19 18 M3 14V20H9 M15 20H21V14',
  criterion: 'M4 4H20V20H4Z M8 12 11 15 17 9',
};
const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[key] || ICONS.entity}" /></svg>`;
const element = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; };

/** Pointer/keyboard adapter over directCanvas.add. Owns no product mutations. */
export function createCreationShelf({ state, svg, surface, toolbar, positions, scopeIds, blocked, add, startGesture, endGesture, notify, suppressClick }) {
  const lifetime = new AbortController();
  const on = (el, type, handler, options = {}) => el.addEventListener(type, handler, { ...options, signal: lifetime.signal });
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/creation-shelf.css'; document.head.append(style);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'creation-toggle';
  toggle.setAttribute('aria-controls', 'creation-shelf'); toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `${icon('entity')}<span>Building blocks</span>`; toolbar.prepend(toggle);
  const shelf = document.createElement('aside'); shelf.id = 'creation-shelf'; shelf.className = 'creation-shelf'; shelf.hidden = true;
  shelf.setAttribute('aria-label', 'Create product objects');
  shelf.innerHTML = '<header><div><span class="creation-eyebrow">CREATE</span><h3>Building blocks</h3></div><button type="button" data-close aria-label="Close building blocks">×</button></header><p class="creation-intro">Drag onto the canvas.<br>Or click a block, then a position.</p><label class="creation-search"><span class="creation-sr">Search building blocks</span><input type="search" placeholder="Find a building block…" autocomplete="off" /></label><div class="creation-list"></div><p class="creation-empty" hidden>No matching blocks. Try “flow”, “rule” or “screen”.</p><footer><strong>Place → Name → Create draft</strong><span>Connections always need your meaning.</span></footer>';
  surface.append(shelf); surface.classList.add('has-creation-shelf');
  const status = document.createElement('div'); status.className = 'creation-status'; status.hidden = true;
  status.innerHTML = '<p role="status" aria-live="polite"></p><div><button type="button" data-center>Place in center</button><button type="button" data-cancel-place>Cancel <kbd>Esc</kbd></button></div>';
  surface.append(status);
  const search = shelf.querySelector('input'), list = shelf.querySelector('.creation-list'), message = status.querySelector('p');
  let active = null, press = null, ignoreClickUntil = 0;
  const token = () => JSON.stringify([state.scope.id, state.scope.rootIds, state.scope.depth, state.view]);
  const say = text => { if (message.textContent !== text) message.textContent = text; };
  const world = (x, y) => {
    try { const matrix = svg.getScreenCTM(); return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : null; }
    catch { return null; }
  };
  function setOpen(open, focus = false) {
    if (!open) cancel();
    shelf.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    if (focus) (open ? search : toggle).focus({ preventScroll: true });
  }
  function renderChoices() {
    list.replaceChildren(); const choices = creationChoices(search.value), filtering = Boolean(search.value.trim());
    const more = document.createElement('details'); more.className = 'creation-more';
    const summary = document.createElement('summary'); summary.textContent = 'More building blocks'; more.append(summary);
    const core = document.createElement('div'), extra = document.createElement('div'); core.className = extra.className = 'creation-grid';
    for (const choice of choices) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'creation-block';
      button.dataset.creationChoice = choice.key; button.dataset.region = choice.region;
      button.setAttribute('aria-label', `Place ${choice.label}`); button.title = `${choice.help} Drag, or click then choose a position.`;
      button.innerHTML = `${icon(choice.key)}<strong></strong><small></small><span class="creation-grip" aria-hidden="true">⠿</span>`;
      button.querySelector('strong').textContent = choice.label; button.querySelector('small').textContent = choice.help;
      (CORE.has(choice.key) || filtering ? core : extra).append(button);
    }
    list.append(core); if (extra.childElementCount) { more.append(extra); list.append(more); }
    shelf.querySelector('.creation-empty').hidden = choices.length > 0; refresh();
  }
  function releasePress() {
    const previous = press; press = null;
    if (previous?.button.hasPointerCapture?.(previous.id)) previous.button.releasePointerCapture(previous.id);
  }
  function clear() {
    const previous = active; active = null; releasePress();
    previous?.preview?.remove(); previous?.line?.remove();
    svg.querySelectorAll('.creation-target').forEach(el => el.classList.remove('creation-target'));
    surface.classList.remove('creation-placing'); shelf.removeAttribute('data-placing'); status.hidden = true;
    if (previous) endGesture(); refresh();
    return previous;
  }
  function cancel(text) {
    const hadGesture = Boolean(active || press); clear();
    if (hadGesture) { ignoreClickUntil = performance.now() + 200; suppressClick(); if (text) notify(text); }
  }
  function refresh() {
    if (active && (active.graph !== state.graph || active.token !== token() || state.busy || state.formDirty)) {
      cancel('Placement cancelled because the model or focus changed. Nothing was created.'); return;
    }
    const unavailable = !state.graph || state.busy || Boolean(state.dragging && !active);
    toggle.disabled = unavailable;
    for (const button of list.querySelectorAll('button')) button.disabled = unavailable;
    for (const button of toolbar.querySelectorAll('[data-direct]')) {
      if (active) button.disabled = true;
      else button.disabled = !state.graph || state.busy || Boolean(state.dragging) || (!['add', 'help'].includes(button.dataset.direct) && !state.graph?.nodes.some(n => n.id === state.selectedId));
    }
  }
  function begin(choice, mode) {
    if (active) cancel();
    if (!choice || blocked()) return false;
    active = { choice, mode, graph: state.graph, token: token() }; startGesture();
    surface.classList.add('creation-placing'); shelf.dataset.placing = choice.key; status.hidden = false;
    status.querySelector('[data-center]').hidden = mode === 'drag';
    say(mode === 'drag' ? `Drop ${choice.label} on the canvas. Release outside to cancel.` : `Place ${choice.label}: click the canvas, or press Enter for its center. Esc cancels.`);
    refresh(); return true;
  }
  function placementAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit.closest('.creation-shelf, .creation-status') || !(hit === surface || svg.contains(hit))) return null;
    const node = hit.closest('[data-graph-node]');
    if (!node && hit.closest('[data-canvas-action], [data-edge-index]')) return null;
    return creationPlacement({ graph: state.graph, scope: state.scope, scopeIds: scopeIds(), positions: positions(), point: world(x, y), sourceId: node?.dataset.graphNode });
  }
  function previewAt(x, y) {
    if (!active) return;
    refresh(); if (!active) return;
    svg.querySelectorAll('.creation-target').forEach(el => el.classList.remove('creation-target'));
    let plan, failure;
    try { plan = placementAt(x, y); } catch (error) { failure = error.message; }
    active.plan = plan;
    if (!plan) { active.preview?.remove(); active.line?.remove(); say(failure || 'Move onto empty canvas or an object. Release outside to cancel.'); return; }
    if (!active.preview) {
      const group = element('g', { class: 'creation-preview', 'aria-hidden': 'true' });
      group.append(element('rect', { x: -CARD.width / 2, y: -CARD.height / 2, width: CARD.width, height: CARD.height, rx: 9 }));
      const title = element('text', { x: -CARD.width / 2 + 16, y: -7 }); title.textContent = active.choice.label;
      const subtitle = element('text', { class: 'creation-preview-note', x: -CARD.width / 2 + 16, y: 15 }); subtitle.textContent = 'Name and confirm next';
      group.append(title, subtitle); active.preview = group;
    }
    active.preview.setAttribute('transform', `translate(${plan.position.x},${plan.position.y})`); svg.append(active.preview);
    if (plan.from) {
      const source = state.graph.nodes.find(n => n.id === plan.from);
      say(`Create ${active.choice.label} related to “${source.title}”. Choose relationship meaning next.`);
      [...svg.querySelectorAll('[data-graph-node]')].find(el => el.dataset.graphNode === plan.from)?.classList.add('creation-target');
      if (positions()[plan.from]) {
        active.line ||= element('path', { class: 'creation-link-preview', 'aria-hidden': 'true' });
        active.line.setAttribute('d', connectorGeometry(positions()[plan.from], plan.position).path); svg.append(active.line);
      }
    } else { active.line?.remove(); say(`Create ${active.choice.label} here. Name it before anything is added.`); }
  }
  function finish(plan) {
    if (!active) return;
    const current = active;
    if (current.graph !== state.graph || current.token !== token() || state.busy || state.formDirty) return cancel('Placement cancelled. Review the current model and try again.');
    clear(); ignoreClickUntil = performance.now() + 200; suppressClick();
    if (!plan) { notify('Placement cancelled. Drop on empty canvas or an object.'); return; }
    // add() rechecks host locks and opens a form; no product data has changed yet.
    add(plan.from, plan.position, current.choice.key);
  }
  function finishAt(x, y) {
    try { finish(placementAt(x, y)); } catch (error) { cancel(error.message); }
  }
  function center() {
    if (!active) return;
    // Ignore overlay hit-testing for this explicit, accessible placement command.
    const rect = svg.getBoundingClientRect();
    try { finish(creationPlacement({ graph: state.graph, scope: state.scope, scopeIds: scopeIds(), positions: positions(), point: world(rect.left + rect.width / 2, rect.top + rect.height / 2) })); }
    catch (error) { cancel(error.message); }
  }
  on(toggle, 'click', () => setOpen(shelf.hidden, true));
  on(shelf.querySelector('[data-close]'), 'click', () => setOpen(false, true));
  on(search, 'input', renderChoices);
  on(status.querySelector('[data-center]'), 'click', center);
  on(status.querySelector('[data-cancel-place]'), 'click', () => { cancel('Placement cancelled. Nothing was created.'); toggle.focus(); });
  // Contain library events: typing or selecting text must not trigger canvas shortcuts/pan.
  on(shelf, 'keydown', event => event.stopPropagation());
  on(shelf, 'dblclick', event => event.stopPropagation());
  on(shelf, 'dragstart', event => event.preventDefault());
  on(shelf, 'pointerdown', event => {
    event.stopPropagation();
    const button = event.target.closest('[data-creation-choice]');
    if (!button || event.button !== 0 || event.isPrimary === false || active || blocked()) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, button, choice: creationChoices().find(c => c.key === button.dataset.creationChoice) };
    button.setPointerCapture?.(event.pointerId);
  });
  on(shelf, 'lostpointercapture', event => { if (press?.id === event.pointerId) cancel('Placement cancelled. Nothing was created.'); });
  on(list, 'click', event => {
    const button = event.target.closest('[data-creation-choice]'); if (!button) return;
    event.stopPropagation(); if (performance.now() < ignoreClickUntil) return;
    const choice = creationChoices().find(c => c.key === button.dataset.creationChoice);
    if (begin(choice, 'place')) surface.focus({ preventScroll: true });
  });
  on(window, 'pointermove', event => {
    if (press) {
      if (event.pointerId !== press.id) return;
      if (!active && Math.hypot(event.clientX - press.x, event.clientY - press.y) >= 6) {
        if (!begin(press.choice, 'drag')) { releasePress(); return; }
      }
    }
    if (active) previewAt(event.clientX, event.clientY);
  });
  on(window, 'pointerup', event => {
    if (!press || press.id !== event.pointerId) return;
    if (active?.mode === 'drag') finishAt(event.clientX, event.clientY); else releasePress();
  });
  on(window, 'pointercancel', event => { if (press?.id === event.pointerId || active?.mode === 'place' && event.isPrimary) cancel('Placement cancelled. Nothing was created.'); });
  on(window, 'blur', () => cancel());
  on(document, 'studio:page', () => cancel());
  on(window, 'keydown', event => {
    if (!active && !press) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel('Placement cancelled. Nothing was created.'); toggle.focus(); }
    else if (active?.mode === 'place' && event.key === 'Enter' && !event.isComposing && !event.target.closest('button,input,textarea,select')) { event.preventDefault(); event.stopImmediatePropagation(); center(); }
  }, { capture: true });
  on(surface, 'pointerdown', event => {
    if (active?.mode === 'place' && !event.target.closest('.creation-shelf, .creation-status')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, { capture: true });
  on(surface, 'click', event => {
    if (event.target.closest('.creation-shelf, .creation-status')) return;
    if (active?.mode === 'place') { event.preventDefault(); event.stopImmediatePropagation(); finishAt(event.clientX, event.clientY); }
  }, { capture: true });
  renderChoices();
  return { refresh, cancel, open: () => setOpen(true, true), destroy: () => { cancel(); lifetime.abort(); shelf.remove(); status.remove(); toggle.remove(); style.remove(); surface.classList.remove('has-creation-shelf'); } };
}
