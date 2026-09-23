import { escapeHTML, searchObjects } from './studio-presentation.js';
import { icon, paintIcons } from './studio-icons.js';

/** Session-only presentation. The host owns model changes, navigation and draft guards. */
export function initStudioExperience({ state, showPage, inspect, focus, addObject, openProposals }) {
  const $ = id => document.getElementById(id);
  let palette = null, focusMode = false;
  paintIcons();
  const trigger = $('command-button'), focusButton = $('canvas-focus');
  const isTyping = element => element?.closest?.('input,textarea,select,[contenteditable=true]');
  const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));
  const canNavigate = () => state.graph && !state.busy && !state.dragging;
  function toggleFocus(next = !focusMode) {
    if (!canNavigate() || document.querySelector('.workspace').dataset.page !== 'model') return;
    focusMode = next;
    focusButton.focus({ preventScroll: true });
    document.querySelector('.workspace').dataset.canvasFocus = String(focusMode);
    for (const selector of ['.sidebar', '.inspector']) document.querySelector(selector).inert = focusMode;
    focusButton.setAttribute('aria-pressed', String(focusMode));
    focusButton.setAttribute('aria-label', focusMode ? 'Exit canvas focus mode' : 'Enter canvas focus mode');
    focusButton.title = focusMode ? 'Exit focus mode (Escape or Shift F)' : 'Focus mode (Shift F)';
  }
  focusButton.onclick = () => toggleFocus();
  $('empty-add').onclick = () => addObject();
  $('empty-recover').onclick = () => document.querySelector('[data-tool="all"]').click();
  $('save-feedback-dismiss').onclick = () => { $('save-feedback').hidden = true; };

  function openPalette() {
    if (!canNavigate() || dialogOpen()) return;
    const opener = document.activeElement;
    palette = document.createElement('dialog');
    palette.id = 'command-palette'; palette.className = 'command-palette';
    palette.setAttribute('aria-labelledby', 'command-palette-title');
    palette.innerHTML = `<header><h2 id="command-palette-title">Find your next step.</h2><button id="command-close" class="icon-button" type="button" aria-label="Close search">${icon('close')}</button></header><div class="command-search">${icon('search')}<input id="command-query" type="search" role="combobox" aria-label="Search project objects and commands" aria-controls="command-results" aria-expanded="true" aria-autocomplete="list" placeholder="Search objects, focus areas or actions…" autocomplete="off" autofocus></div><p id="command-count" role="status"></p><div id="command-results" role="listbox" aria-label="Search results"></div><footer><span>↑ ↓ navigate · Enter open · Esc close</span><span>Current project only</span></footer>`;
    document.body.append(palette);
    const dialog = palette, query = dialog.querySelector('#command-query'), list = dialog.querySelector('#command-results');
    let results = [], active = 0;
    function close() { if (dialog.open) dialog.close(); }
    dialog.addEventListener('close', () => { dialog.remove(); if (palette === dialog) palette = null; if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus({ preventScroll: true }); }, { once: true });
    dialog.querySelector('#command-close').onclick = close;
    const actions = [
      { title: 'Add an object', detail: 'Define a feature, entity, rule or screen', glyph: 'plus', run: addObject },
      { title: 'Sketch & define', detail: 'Capture ideas and review their meaning', glyph: 'sketch', run: () => document.querySelector('#open-authoring')?.click() },
      { title: 'Project overview', detail: 'Intent, focus areas and working changes', glyph: 'graph', run: () => showPage('overview') },
      { title: 'Pattern & template library', detail: 'Inspect reusable definitions', glyph: 'library', run: () => showPage('library') },
      { title: 'Implementation targets', detail: 'Configure targets; no generator implied', glyph: 'target', run: () => showPage('build') },
      { title: 'Documents', detail: 'Read saved source files with context', glyph: 'document', run: () => document.querySelector('#open-documents')?.click() },
      { title: 'Review agent proposals', detail: 'Review before changing product meaning', glyph: 'review', run: openProposals },
    ];
    function draw() {
      active = 0;
      const text = query.value.trim().toLocaleLowerCase();
      const commands = actions.filter(a => `${a.title} ${a.detail}`.toLocaleLowerCase().includes(text)).map(a => ({ ...a, group: 'Action' }));
      const areas = (state.focusAreas || []).filter(a => a.title.toLocaleLowerCase().includes(text)).slice(0, 8).map(area => ({ title: area.title, detail: 'Open this focus area', glyph: 'graph', group: 'Focus', run: () => focus(area) }));
      const objects = searchObjects(state.graph.nodes, query.value, 30).map(node => ({ title: node.title, detail: `${node.type} · ${node.id}`, glyph: 'cursor', group: 'Inspect', run: () => inspect(node.id) }));
      results = [...commands, ...areas, ...objects].slice(0, 40);
      list.innerHTML = results.map((r, i) => `<button type="button" id="command-result-${i}" role="option" aria-selected="${i === 0}" tabindex="-1" data-result="${i}">${icon(r.glyph)}<span><strong>${escapeHTML(r.title)}</strong><small>${escapeHTML(r.detail)}</small></span><em>${r.group}</em></button>`).join('') || '<div class="command-empty">No matches. Try a name, type or stable ID.</div>';
      dialog.querySelector('#command-count').textContent = results.length ? `${results.length} results · Inspect keeps the current focus` : 'No results in this project';
      list.querySelectorAll('[data-result]').forEach(b => b.onclick = () => choose(Number(b.dataset.result)));
      mark();
    }
    function mark() {
      list.querySelectorAll('[data-result]').forEach((b, i) => b.setAttribute('aria-selected', String(i === active)));
      if (results.length) { query.setAttribute('aria-activedescendant', `command-result-${active}`); list.children[active]?.scrollIntoView({ block: 'nearest' }); }
      else query.removeAttribute('aria-activedescendant');
    }
    function choose(index) {
      const result = results[index];
      if (!result || !canNavigate()) return;
      close();
      if (focusMode) toggleFocus(false);
      result.run();
    }
    query.oninput = draw;
    query.onkeydown = event => {
      if (event.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = Math.max(0, Math.min(results.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))); mark(); }
      if (event.key === 'Enter') { event.preventDefault(); choose(active); }
    };
    dialog.showModal(); draw(); query.focus();
  }
  trigger.onclick = openPalette;
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.altKey) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      if (!dialogOpen()) { event.preventDefault(); openPalette(); } return;
    }
    if (dialogOpen() || isTyping(event.target) || event.metaKey || event.ctrlKey) return;
    if (event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFocus(); }
    if (event.key === 'Escape' && focusMode) { event.preventDefault(); toggleFocus(false); }
    if (event.key === '/' && canNavigate()) {
      event.preventDefault(); if (focusMode) toggleFocus(false);
      $('search').focus(); $('search').select();
    }
  });
  return {
    refresh() {
      paintIcons();
      for (const [id, glyph, label] of [['open-authoring', 'sketch', 'Sketch & define'], ['open-documents', 'document', 'Documents']]) {
        const button = $(id);
        if (button && !button.dataset.experienceIcon) { button.innerHTML = `${icon(glyph)}<span>${label}</span>`; button.dataset.experienceIcon = 'true'; }
      }
      trigger.disabled = !canNavigate();
      if (focusMode && document.querySelector('.workspace').dataset.page !== 'model') {
        focusMode = false; document.querySelector('.workspace').dataset.canvasFocus = 'false';
        for (const selector of ['.sidebar', '.inspector']) document.querySelector(selector).inert = false;
        focusButton.setAttribute('aria-pressed', 'false'); focusButton.setAttribute('aria-label', 'Enter canvas focus mode'); focusButton.title = 'Focus mode (Shift F)';
      }
      const pending = state.proposals.filter(p => p.status === 'pending').length;
      $('pending-proposal-count').textContent = String(pending); $('pending-proposal-count').hidden = !pending;
    },
    openPalette,
  };
}
