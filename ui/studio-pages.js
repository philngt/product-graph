import { neighborhood, regionOf } from './studio-state.js';
import { createImplementationTargets } from './implementation-targets.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = value => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);

/** Pages share the product graph; Targets owns only separate implementation configuration. */
export function createStudioPages({ state, focus, inspect, lens, model, review }) {
  let page = 'model', kind = 'all', query = '';
  const $ = id => document.getElementById(id);
  const dialog = $('library-dialog');
  const targets = createImplementationTargets({ state });
  document.querySelector('button[data-page=build]').textContent = 'Targets';
  let opener = null;
  const closeDialog = () => { dialog.close(); if (opener?.isConnected) opener.focus(); };
  $('library-dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
  const library = () => [
    ...(state.library.patterns || []).map((definition, index) => ({ definition, kind: 'pattern', key: `pattern-${index}` })),
    ...(state.library.templates || []).map((definition, index) => ({ definition, kind: 'template', key: `template-${index}` })),
  ];
  function openItem(key, button) {
    const item = library().find(entry => entry.key === key); if (!item) return;
    opener = button;
    const d = item.definition;
    $('library-dialog-title').textContent = d.title || d.name || d.id || 'Library definition';
    $('library-dialog-summary').textContent = text(d.problem || d.description || d.target || 'No description provided.');
    $('library-dialog-meta').textContent = `${item.kind} · ${d.version || 'unversioned'} · ${d.id || 'No ID'}`;
    $('library-dialog-json').textContent = JSON.stringify(d, null, 2);
    dialog.showModal();
  }
  function show(next) {
    if (state.dragging || !['overview', 'model', 'library', 'build'].includes(next)) return;
    page = next;
    render();
    $('page-heading')?.focus({ preventScroll: true });
  }
  function renderOverview() {
    const graph = state.graph;
    const intents = graph.nodes.filter(n => regionOf(n) === 'intent');
    const counts = new Map(); graph.nodes.forEach(n => counts.set(regionOf(n), (counts.get(regionOf(n)) || 0) + 1));
    const changes = graph.nodes.filter(n => JSON.stringify(n) !== JSON.stringify(state.baseline?.nodes.find(old => old.id === n.id)));
    return `<div class="page-heading"><div><p class="eyebrow">PROJECT OVERVIEW</p><h2 id="page-heading" tabindex="-1">${esc(graph.manifest.name)}</h2><p>One product model. A connected place to think, decide and build.</p></div><span class="paper-note">Start with a feature.<br>Keep the whole product in view.</span></div>
      <div class="overview-grid"><section class="paper-card vision-card"><h3>Product intent</h3><p class="display-copy">${esc(intents[0]?.title || 'Define why this product should exist.')}</p><p>${esc(text(intents[0]?.data?.description || graph.manifest.description || 'Intent, rules and experience stay connected to the same model.'))}</p><button class="text-button" data-overview-lens="product">Explore product intent →</button></section>
      <section class="paper-card"><h3>Model inventory</h3><div class="inventory"><div><strong>${graph.nodes.length}</strong><span>objects</span></div><div><strong>${graph.edges.length}</strong><span>relationships</span></div><div><strong>${graph.documents.length}</strong><span>documents</span></div></div><p>Counts from the working graph, not a readiness score.</p></section>
      <section class="paper-card"><h3>Saved validation</h3><strong class="large-number">${state.diagnostics.length}</strong><p>${state.dirty ? 'Local changes need validation after saving.' : 'Findings from the last saved model.'}</p><button class="text-button" data-overview-lens="verification">Open verification →</button></section></div>
      <div class="section-heading"><h3>Focus areas</h3><span>Work on a product concept, not a folder.</span></div>
      <div class="focus-card-grid">${state.focusAreas.map((area, i) => `<button class="paper-card focus-card" data-overview-focus="${i}"><span class="card-index">${String(i + 1).padStart(2, '0')}</span><h3>${esc(area.title)}</h3><p>${esc(area.description || 'Explore the connected product model.')}</p><footer>${neighborhood(graph, area.rootIds, area.depth).size} connected objects <span>Open focus ↗</span></footer></button>`).join('') || '<p class="empty-copy">No focus areas defined. Open the model and focus on an object to begin.</p>'}</div>
      <div class="overview-bottom"><section class="paper-card"><h3>One model, multiple lenses</h3><div class="region-grid">${[...counts].map(([region, count]) => `<button data-overview-lens="${region === 'decision' ? 'decisions' : region === 'quality' ? 'verification' : region === 'intent' ? 'product' : region}"><i class="region-dot ${esc(region)}"></i>${esc(region)}<strong>${count}</strong></button>`).join('')}</div></section>
      <section class="paper-card"><h3>Working changes</h3>${changes.slice(0, 4).map(n => `<button class="change-row" data-overview-node="${esc(n.id)}">${esc(n.title)}<span>${esc(regionOf(n))} ↗</span></button>`).join('') || '<p>No changed or added objects in this working copy.</p>'}<p class="muted">Review changes also includes removals and relationship changes.</p><button class="text-button" data-overview-review>Review full diff →</button></section></div>`;
  }
  function renderLibrary() {
    const items = library().filter(item => (kind === 'all' || item.kind === kind) && `${text(item.definition.title)} ${text(item.definition.id)} ${text(item.definition.problem)} ${text(item.definition.target)}`.toLowerCase().includes(query.toLowerCase().trim()));
    $('library-results').innerHTML = items.map(({ definition: d, kind: type, key }) => `<button class="paper-card library-card" data-library-item="${key}"><div class="library-sketch ${type}" aria-hidden="true"><span>◇</span><i></i><span>◇</span><i></i><span>◇</span></div><div class="library-card-heading"><span class="tag">${type}</span><small>${esc(d.version || 'Unversioned')}</small></div><h3>${esc(d.title || d.name || d.id || 'Untitled definition')}</h3><p>${esc(text(d.problem || d.description || d.target || 'Inspect the local definition.'))}</p><footer>Inspect definition <span>↗</span></footer></button>`).join('') || `<p class="empty-copy">${library().length ? 'No matching library definitions.' : 'Library is empty. Add local definitions under patterns/ or templates/.'}</p>`;
    $('library-count').textContent = `${items.length} definitions · read only`;
    $('library-results').querySelectorAll('[data-library-item]').forEach(button => button.addEventListener('click', () => openItem(button.dataset.libraryItem, button)));
  }
  function render() {
    if (!state.graph) return;
    document.querySelector('.workspace').dataset.page = page;
    $('graph-surface').hidden = page !== 'model';
    $('studio-page').hidden = page === 'model';
    $('page-library').hidden = page !== 'library';
    $('page-content').hidden = page === 'library';
    document.querySelectorAll('[data-page]').forEach(b => { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.page === page)); });
    $('context-heading').textContent = state.scope.title;
    $('context-copy').textContent = `${state.view} lens · ${state.scope.id === 'project' ? 'entire project' : `depth ${state.scope.depth}`} · one canonical model`;
    if (page === 'overview') $('page-content').innerHTML = renderOverview();
    if (page === 'build') { $('page-content').replaceChildren(targets.element); targets.open(); }
    if (page === 'library') renderLibrary();
    $('page-content').querySelectorAll('[data-overview-focus]').forEach(b => b.addEventListener('click', () => { if (focus(state.focusAreas[Number(b.dataset.overviewFocus)]) !== false) show('model'); }));
    $('page-content').querySelectorAll('[data-overview-lens]').forEach(b => b.addEventListener('click', () => { lens(b.dataset.overviewLens); show('model'); }));
    $('page-content').querySelectorAll('[data-overview-node]').forEach(b => b.addEventListener('click', () => { inspect(b.dataset.overviewNode); show('model'); }));
    $('page-content').querySelector('[data-overview-review]')?.addEventListener('click', () => { show('model'); review(); });
    $('page-content').querySelector('[data-build-model]')?.addEventListener('click', () => { model(); show('model'); });
    $('page-content').querySelector('[data-build-library]')?.addEventListener('click', () => { kind = 'template'; $('library-kind').value = kind; show('library'); });
  }
  document.querySelectorAll('button[data-page]').forEach(b => b.addEventListener('click', () => show(b.dataset.page)));
  $('library-kind').addEventListener('change', e => { kind = e.target.value; renderLibrary(); });
  $('library-search').addEventListener('input', e => { query = e.target.value; renderLibrary(); });
  return { render, show, openItem };
}
