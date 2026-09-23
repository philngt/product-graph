import { neighborhood, regionOf } from './studio-state.js';
import { createImplementationTargets } from './implementation-targets.js';
import { escapeHTML as esc, definitionFacts, workingChanges } from './studio-presentation.js';
import { icon, paintIcons } from './studio-icons.js';
const text = value => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);

/** Pages project existing state. Targets keeps its own configuration/revision contract. */
export function createStudioPages({ state, focus, inspect, lens, model, review }) {
  let page = 'model', kind = 'all', query = '', opener = null;
  const $ = id => document.getElementById(id), dialog = $('library-dialog');
  const targets = createImplementationTargets({ state });
  const closeDialog = () => { dialog.close(); if (opener?.isConnected) opener.focus(); };
  $('library-dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
  const library = () => [
    ...(state.library.patterns || []).map((definition, index) => ({ definition, kind: 'pattern', key: `pattern-${index}` })),
    ...(state.library.templates || []).map((definition, index) => ({ definition, kind: 'template', key: `template-${index}` })),
  ].filter(item => item.definition && typeof item.definition === 'object');
  function openItem(key, button) {
    const item = library().find(entry => entry.key === key); if (!item) return;
    opener = button || document.activeElement;
    const d = item.definition, facts = definitionFacts(d);
    $('library-dialog-title').textContent = d.title || d.name || d.id || 'Library definition';
    $('library-dialog-summary').textContent = text(d.problem || d.description || d.target || 'No description provided.');
    $('library-dialog-meta').textContent = `${item.kind} · ${d.version || 'unversioned'} · ${d.id || 'No ID'}`;
    $('library-dialog-json').textContent = JSON.stringify(d, null, 2);
    $('library-dialog-overview').innerHTML = [
      ['Structure', facts.structure], ['Capabilities', facts.capabilities], ['Trade-offs', facts.tradeoffs],
    ].filter(([, values]) => values.length).map(([title, values]) => `<section class="definition-section"><h3>${title}</h3><ul>${values.map(v => `<li>${esc(v)}</li>`).join('')}</ul></section>`).join('') || '<p class="field-help">This definition has no human-readable structure or trade-offs. Inspect its source below.</p>';
    dialog.showModal();
  }
  function show(next) {
    if (state.dragging || !['overview', 'model', 'library', 'build'].includes(next)) return false;
    page = next; render();
    document.dispatchEvent(new CustomEvent('studio:page', { detail: { page } }));
    (next === 'library' ? document.querySelector('#page-library h2') : $('page-heading'))?.focus({ preventScroll: true });
    return true;
  }
  function preview(area) {
    const ids = neighborhood(state.graph, area.rootIds, area.depth);
    const nodes = state.graph.nodes.filter(n => ids.has(n.id)).slice(0, 7);
    const positions = new Map(nodes.map((n, i) => [n.id, { x: 25 + i % 4 * 60, y: i < 4 ? 28 : 65 }]));
    const lines = state.graph.edges.filter(e => positions.has(e.from) && positions.has(e.to)).map(e => {
      const a = positions.get(e.from), b = positions.get(e.to);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }).join('');
    return `<svg class="focus-preview" viewBox="0 0 230 88" aria-hidden="true">${lines}${nodes.map(n => { const p = positions.get(n.id); return `<rect x="${p.x - 8}" y="${p.y - 6}" width="16" height="12" rx="3" class="preview-${esc(regionOf(n))}"/>`; }).join('')}</svg>`;
  }
  function renderOverview() {
    const graph = state.graph, intent = graph.nodes.find(n => regionOf(n) === 'intent' && n.type !== 'constraint');
    const counts = new Map(); graph.nodes.forEach(n => counts.set(regionOf(n), (counts.get(regionOf(n)) || 0) + 1));
    const changes = workingChanges(state.baseline, graph), pending = state.proposals.filter(p => p.status === 'pending').length;
    return `<div class="page-heading"><div><p class="eyebrow">YOUR PRODUCT, CONNECTED</p><h2 id="page-heading" tabindex="-1">${esc(graph.manifest.name)}</h2><p>Keep the intent clear. Build one meaningful feature at a time.</p></div><button class="button button-primary" data-overview-sketch>${icon('sketch')}Sketch an idea</button></div>
    <div class="overview-hero"><section class="vision-card"><span class="section-kicker">PRODUCT INTENT</span><h3>${esc(intent?.title || 'What should this product make possible?')}</h3><p>${esc(text(intent?.data?.description || graph.manifest.description || 'Begin with an idea, a question or an object. Make the meaning explicit as you go.'))}</p><button class="text-button" data-overview-lens="product">Explore product intent ${icon('arrow')}</button><div class="inventory"><div><strong>${graph.nodes.length}</strong><span>product objects</span></div><div><strong>${graph.edges.length}</strong><span>relationships</span></div><div><strong>${graph.documents.length}</strong><span>document records</span></div></div></section>
    <section class="next-steps"><p class="eyebrow">YOUR NEXT STEP</p><h3>Keep the work moving.</h3><button data-overview-model>${icon('graph')}<span><strong>Continue modeling</strong><small>Return to your current focus</small></span>↗</button><button data-overview-review>${icon('review')}<span><strong>${changes.length ? `${changes.length} working changes` : 'Review working changes'}</strong><small>Not saved until you choose Save model</small></span>↗</button><button data-overview-proposals>${icon('decision')}<span><strong>${pending} pending proposal${pending === 1 ? '' : 's'}</strong><small>Review before accepting new meaning</small></span>↗</button><p class="saved-note">${state.diagnostics.length} saved findings${state.dirty ? ' · local model needs recheck' : ''}. No readiness score is inferred.</p></section></div>
    <div class="section-heading"><h3>Choose a focus.</h3><span>Different perspectives. The same product.</span></div>
    <div class="focus-card-grid">${state.focusAreas.map((area, i) => `<button class="paper-card focus-card" data-overview-focus="${i}"><div class="focus-card-top"><span class="card-index">${String(i + 1).padStart(2, '0')}</span>${icon('arrow')}</div>${preview(area)}<h3>${esc(area.title)}</h3><p>${esc(area.description || 'Explore the connected objects, flows and decisions.')}</p><footer>${neighborhood(graph, area.rootIds, area.depth).size} connected objects<span>Open focus ↗</span></footer></button>`).join('') || `<section class="paper-card empty-card">${icon('graph')}<h3>Your first feature starts here.</h3><p>No focus areas defined yet. Add an object, then choose Focus here.</p><button class="button button-secondary" data-overview-add>Add an object</button></section>`}</div>
    <div class="overview-bottom"><section class="paper-card"><p class="eyebrow">MODEL INVENTORY</p><h3>One model, multiple lenses.</h3><div class="region-grid">${[...counts].map(([region, count]) => `<button data-overview-lens="${region === 'decision' ? 'decisions' : region === 'quality' ? 'verification' : region === 'intent' ? 'product' : region}"><i class="region-dot ${esc(region)}"></i>${esc(region)}<strong>${count}</strong></button>`).join('') || '<p>No objects yet.</p>'}</div></section><section class="paper-card"><p class="eyebrow">IN THIS WORKING COPY</p><h3>Changes, not guesswork.</h3>${changes.slice(0, 5).map(c => `<div class="change-row"><span class="change-kind ${c.kind}">${c.kind}</span><strong>${esc(c.after?.title || c.before?.title || c.id)}</strong><span>${c.category}</span></div>`).join('') || '<p>No product changes since the last loaded or saved model. Layout changes are reviewed separately.</p>'}<button class="text-button" data-overview-review>Review exact changes →</button></section></div>`;
  }
  function renderLibrary() {
    const items = library().filter(item => (kind === 'all' || item.kind === kind) && `${text(item.definition.title)} ${text(item.definition.id)} ${text(item.definition.problem)} ${text(item.definition.target)}`.toLowerCase().includes(query.toLowerCase().trim()));
    $('library-results').innerHTML = items.map(({ definition: d, kind: type, key }) => {
      const facts = definitionFacts(d), labels = (facts.structure.length ? facts.structure : facts.capabilities).slice(0, 4);
      return `<button class="paper-card library-card ${type}-card" data-library-item="${key}"><div class="library-card-heading"><span class="tag">${type}</span><small>${esc(d.version || 'Unversioned')}</small></div><div class="definition-preview">${icon(type === 'pattern' ? 'graph' : 'library')}${labels.length ? `<div>${labels.map(label => `<span>${esc(label)}</span>`).join('')}</div>` : '<span>Local definition metadata</span>'}</div><h3>${esc(d.title || d.name || d.id || 'Untitled definition')}</h3><p>${esc(text(d.problem || d.description || d.target || 'Inspect the local definition.'))}</p><footer>Inspect definition<span>${icon('arrow')}</span></footer></button>`;
    }).join('') || `<div class="library-empty">${icon('search')}<h3>${library().length ? 'No matching definitions.' : 'A home for what you reuse.'}</h3><p>${library().length ? 'Try another search or show all definition types.' : 'Add local definitions under patterns/ or templates/. Nothing is generated by opening a definition.'}</p>${library().length ? '<button id="reset-library-filter" class="button button-secondary">Reset filters</button>' : ''}</div>`;
    $('library-count').textContent = `${items.length} definitions · read only`;
    $('library-results').querySelectorAll('[data-library-item]').forEach(button => button.addEventListener('click', () => openItem(button.dataset.libraryItem, button)));
    $('reset-library-filter')?.addEventListener('click', () => { query = ''; kind = 'all'; $('library-search').value = ''; $('library-kind').value = 'all'; renderLibrary(); $('library-search').focus(); });
  }
  function render() {
    if (!state.graph) return;
    document.querySelector('.workspace').dataset.page = page;
    $('graph-surface').hidden = page !== 'model'; $('studio-page').hidden = page === 'model';
    $('page-library').hidden = page !== 'library'; $('page-content').hidden = page === 'library';
    document.querySelectorAll('button[data-page]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.page === page)));
    $('context-heading').textContent = state.scope.title;
    $('context-copy').textContent = `${state.view} lens · one canonical model`;
    if (page === 'overview') $('page-content').innerHTML = renderOverview();
    if (page === 'build') { $('page-content').replaceChildren(targets.element); targets.open(); }
    if (page === 'library') renderLibrary();
    const on = (selector, action) => $('page-content').querySelectorAll(selector).forEach(b => b.addEventListener('click', () => action(b)));
    on('[data-overview-focus]', b => { if (focus(state.focusAreas[Number(b.dataset.overviewFocus)]) !== false) show('model'); });
    on('[data-overview-lens]', b => { if (lens(b.dataset.overviewLens) !== false) show('model'); });
    on('[data-overview-review]', () => { show('model'); review(); });
    on('[data-overview-proposals]', () => document.querySelector('[data-tool="review"]').click());
    on('[data-overview-sketch]', () => $('open-authoring')?.click());
    on('[data-overview-add]', () => $('add-node').click());
    on('[data-overview-model]', () => show('model'));
    paintIcons();
  }
  document.querySelectorAll('button[data-page]').forEach(b => b.addEventListener('click', () => show(b.dataset.page)));
  $('library-kind').addEventListener('change', e => { kind = e.target.value; renderLibrary(); });
  $('library-search').addEventListener('input', e => { query = e.target.value; renderLibrary(); });
  return { render, show, openItem };
}
