import { createProjectClient } from './project-client.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roles = ['interface', 'backend', 'worker', 'cli', 'library'];
const clone = value => structuredClone(value);

/** Owns only deployment configuration. It never mutates the host graph or its save token. */
export function createImplementationTargets({ state, request = createProjectClient(location.pathname).request }) {
  const root = document.createElement('section');
  root.className = 'implementation-targets';
  root.setAttribute('aria-label', 'Implementation targets');
  let snapshot = null, selected = null, loading = false, error = '', ticket = 0, activeDialog = null;
  let dirtyDraft = false, writing = false;
  if (!document.querySelector('link[data-target-style]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/implementation-targets.css'; link.dataset.targetStyle = 'true'; document.head.append(link);
  }
  const hostDirty = () => Boolean(state.dirty || state.formDirty || state.busy || state.dragging);
  const target = () => snapshot?.config.targets.find(t => t.id === selected);
  const report = () => snapshot?.inspection.find(r => r.targetId === selected);
  window.addEventListener('beforeunload', event => { if (dirtyDraft || writing) { event.preventDefault(); event.returnValue = ''; } });

  function dialog(title, body) {
    const d = document.createElement('dialog'); d.className = 'target-dialog'; d.setAttribute('aria-labelledby', 'target-dialog-title');
    d.innerHTML = `<header><div><p class="eyebrow">IMPLEMENTATION · NOT PRODUCT SEMANTICS</p><h2 id="target-dialog-title">${esc(title)}</h2></div><button type="button" data-close aria-label="Close target dialog">Close</button></header>${body}`;
    const opener = document.activeElement;
    activeDialog = d; dirtyDraft = false;
    const close = () => { if (writing) return; if (dirtyDraft && !confirm('Discard unsaved target edits?')) return; d.close(); };
    d.querySelector('[data-close]').onclick = close;
    d.addEventListener('cancel', event => { event.preventDefault(); close(); });
    d.addEventListener('close', () => { dirtyDraft = false; activeDialog = null; d.remove(); if (opener?.isConnected) opener.focus(); });
    document.body.append(d); d.showModal(); return d;
  }
  async function refresh() {
    if (activeDialog || loading) return;
    const own = ++ticket; loading = true; error = ''; render();
    try { const result = await request('/api/implementation'); if (own !== ticket) return; snapshot = result; if (!target()) selected = result.config.targets[0]?.id || null; }
    catch (e) { error = e.message; }
    finally { if (own === ticket) { loading = false; render(); } }
  }
  function render() {
    root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ONE PRODUCT · MANY IMPLEMENTATIONS</p><h2 id="page-heading" tabindex="-1">Implementation targets</h2><p>Keep objects, flows and rules shared. Choose how each part is delivered.</p></div><div><span class="tag warning">Generation not implemented</span><br><button class="button" disabled>Generate application</button></div></div>
      <div class="target-toolbar"><p>Mobile, web, backend, worker or CLI — no platform is assumed.</p><button class="button" id="targets-refresh" ${loading ? 'disabled' : ''}>Refresh saved inputs</button><button class="button button-primary" id="target-add" ${loading || !snapshot ? 'disabled' : ''}>＋ Add target</button></div>
      <p role="status" class="target-warning" id="targets-message">${esc(error || (hostDirty() ? 'Save product/inspector edits before configuring targets or building context.' : 'Definitions only. Template mappings and custom references do not execute code.'))}</p>
      ${!snapshot ? `<p>${loading ? 'Loading saved target definitions…' : 'Target definitions could not be loaded. Retry without changing your product.'}</p>` : `<div class="targets-layout"><nav class="target-list" aria-label="Project targets">${snapshot.config.targets.map(t => `<button class="paper-card target-card ${t.id === selected ? 'active' : ''}" data-target="${esc(t.id)}"><span class="eyebrow">${esc(t.role)} · ${esc(t.environment)}</span><strong>${esc(t.name)}</strong><span>${esc([t.language, t.framework].filter(Boolean).join(' / ') || 'Technology undecided')}</span><small>${t.bindings.length} explicit object bindings</small></button>`).join('') || '<div class="paper-card"><h3>No deployment choices yet</h3><p>Your product model is usable without a platform. Add a target when you are ready to make implementation decisions.</p></div>'}</nav><div id="target-detail">${renderDetail()}</div></div>`}
      <p class="target-footnote">Saved separately in implementation/targets.json. Removing a target never deletes product objects or custom source files. A matching template contract is not evidence of a working generator.</p>`;
    root.querySelector('#targets-refresh').onclick = refresh;
    root.querySelector('#target-add').onclick = () => edit();
    root.querySelectorAll('[data-target]').forEach(b => b.onclick = () => { selected = b.dataset.target; render(); });
    root.querySelector('#target-edit')?.addEventListener('click', () => edit(target()));
    root.querySelector('#target-delete')?.addEventListener('click', remove);
    root.querySelector('#target-context')?.addEventListener('click', context);
  }
  function renderDetail() {
    const t = target(), r = report();
    if (!t || !r) return '<section class="paper-card"><h3>Define once. Implement deliberately.</h3><p>Swift/SwiftUI is one possible implementation, not the product model. Templates provide repeated mechanisms; bindings retain the meaning of each project.</p></section>';
    return `<section class="paper-card"><div class="target-detail-heading"><div><p class="eyebrow">${esc(t.id)}</p><h3>${esc(t.name)}</h3></div><button class="button" id="target-edit">Edit target & bindings</button></div><dl class="target-facts"><div><dt>Environment</dt><dd>${esc(t.environment)}</dd></div><div><dt>Language / framework</dt><dd>${esc([t.language, t.framework].filter(Boolean).join(' / ') || 'Undecided')}</dd></div><div><dt>Storage</dt><dd>${esc(t.storage || 'Undecided')}</dd></div><div><dt>Pinned template</dt><dd>${esc(t.template ? `${t.template.id} @ ${t.template.version}` : 'None selected')}</dd></div></dl>${t.notes ? `<p>${esc(t.notes)}</p>` : ''}
      <h4>Product → implementation</h4><div class="target-table-wrap"><table class="target-table"><thead><tr><th>Product object</th><th>Mapping</th><th>State</th></tr></thead><tbody>${r.bindings.map(b => `<tr><td>${esc(b.title)}<small>${esc(b.nodeId)}</small></td><td>${esc(b.mode)}<small>${esc(b.slot || b.reference)}</small></td><td><span class="tag">${esc(b.status)}</span><small>${esc(b.message)}</small></td></tr>`).join('') || '<tr><td colspan="3">Choose the objects this target implements. Not every target must implement the entire product.</td></tr>'}</tbody></table></div>
      <div class="target-findings">${r.findings.map(f => `<p>△ ${esc(f.message)}</p>`).join('')}</div><footer class="target-toolbar"><button class="button button-primary" id="target-context">Build target context</button><button class="button button-danger" id="target-delete">Remove target</button></footer></section>`;
  }
  function edit(current) {
    if (!snapshot || hostDirty()) { error = 'Save the host model and inspector draft first. Target bindings use saved product objects.'; render(); return; }
    const draft = current ? clone(current) : { id: `target-${crypto.randomUUID()}`, name: '', role: 'interface', environment: '', language: '', framework: '', storage: '', notes: '', template: null, bindings: [] };
    const base = snapshot;
    const input = (key, label, placeholder = '', required = false, max = 160) => `<label>${label}<input name="${key}" value="${esc(draft[key])}" placeholder="${esc(placeholder)}" maxlength="${max}" ${required ? 'required' : ''}></label>`;
    const choices = base.templates.map((t, i) => `<option value="${i}" ${!t.contract ? 'disabled' : ''}>${esc(t.title)} · ${esc(t.version)}${t.issue ? ` · ${esc(t.issue)}` : ''}</option>`).join('');
    const d = dialog(current ? 'Edit implementation target' : 'Add implementation target', `<form id="target-form"><div class="target-form-grid">${input('name', 'Name', 'Web app / Mobile app / API', true)}<label>Role<select name="role">${roles.map(r => `<option ${draft.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>${input('environment', 'Environment', 'browser / iOS / server / terminal', true)}${input('language', 'Language', 'TypeScript / Swift / Java / Python')}${input('framework', 'Framework', 'React / SwiftUI / Spring Boot')}${input('storage', 'Storage choice', 'Local store / backend database', false, 300)}<label class="target-wide">Template pin<select name="template"><option value="none">No template — define custom bindings</option>${draft.template ? `<option value="pinned">Keep current pin: ${esc(draft.template.id)} @ ${esc(draft.template.version)}</option>` : ''}${choices}</select></label><label class="target-wide">Implementation notes<textarea name="notes" maxlength="4000" rows="2">${esc(draft.notes)}</textarea></label></div><div id="target-template-info" class="target-warning"></div><datalist id="target-slots"></datalist><h3>Explicit product bindings</h3><p>Reuse the same objects in multiple targets. One binding per object in each target. Custom references are inert declarations.</p><div class="target-table-wrap"><table class="target-table"><thead><tr><th>Object</th><th>Ownership</th><th>Template slot / custom reference</th><th></th></tr></thead><tbody id="binding-rows"></tbody></table></div><button type="button" class="button" id="binding-add">＋ Bind an object</button><p id="target-form-error" role="alert" class="target-warning"></p><footer class="target-toolbar"><small>Save affects this target configuration only.</small><button class="button button-primary" type="submit" id="target-save">Save targets</button></footer></form>`);
    const form = d.querySelector('form'); form.elements.template.value = draft.template ? 'pinned' : 'none';
    function templateInfo() {
      const choice = form.elements.template.value;
      const definition = choice === 'pinned' ? base.templates.find(t => t.id === draft.template?.id && t.version === draft.template?.version && t.definitionHash === draft.template?.definitionHash) : choice === 'none' ? null : base.templates[Number(choice)];
      const c = definition?.contract;
      d.querySelector('#target-template-info').textContent = c ? `Declared for ${c.roles.join(', ')} / ${c.environments.join(', ')}. Slots: ${c.slots.map(s => `${s.id} (${s.nodeTypes.join(', ')})`).join('; ')}. Not a registered generator.` : 'No current mapping contract selected. Custom/deferred bindings remain available; old pins are not upgraded automatically.';
      d.querySelector('#target-slots').innerHTML = (c?.slots || []).map(s => `<option value="${esc(s.id)}">${esc(s.nodeTypes.join(', '))}</option>`).join('');
    }
    form.elements.template.addEventListener('change', templateInfo); templateInfo();
    const bindings = draft.bindings;
    function bindingRows() {
      d.querySelector('#binding-rows').innerHTML = bindings.map((b, i) => `<tr data-binding="${i}"><td><select data-field="nodeId" aria-label="Product object" required><option value="">Choose object</option>${!base.nodes.some(n => n.id === b.nodeId) && b.nodeId ? `<option value="${esc(b.nodeId)}" selected>Missing: ${esc(b.nodeId)}</option>` : ''}${base.nodes.map(n => `<option value="${esc(n.id)}" ${n.id === b.nodeId ? 'selected' : ''}>${esc(n.title)} · ${esc(n.type)}</option>`).join('')}</select></td><td><select data-field="mode" aria-label="Binding ownership">${['template', 'custom', 'deferred'].map(mode => `<option ${mode === b.mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></td><td><input data-field="slot" list="target-slots" aria-label="Template slot" placeholder="Template slot ID" value="${esc(b.slot)}" maxlength="160"><input data-field="reference" aria-label="Custom reference" placeholder="Custom code reference (not executed)" value="${esc(b.reference)}" maxlength="1000"></td><td><button type="button" data-remove="${i}" aria-label="Remove binding">×</button></td></tr>`).join('');
      d.querySelectorAll('[data-binding] [data-field]').forEach(el => el.oninput = () => { bindings[Number(el.closest('[data-binding]').dataset.binding)][el.dataset.field] = el.value; dirtyDraft = true; });
      d.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { bindings.splice(Number(b.dataset.remove), 1); dirtyDraft = true; bindingRows(); });
    }
    bindingRows();
    form.addEventListener('input', () => { dirtyDraft = true; }); form.addEventListener('change', () => { dirtyDraft = true; });
    d.querySelector('#binding-add').onclick = () => {
      if (bindings.length >= 128) return;
      bindings.push({ nodeId: '', mode: 'deferred', slot: '', reference: '' }); dirtyDraft = true; bindingRows();
      d.querySelector('#binding-rows tr:last-child select')?.focus();
    };
    form.onsubmit = async event => {
      event.preventDefault(); if (writing) return;
      if (hostDirty()) { d.querySelector('#target-form-error').textContent = 'The host model has unsaved edits. Keep or discard this draft, then save the model before configuring targets.'; return; }
      for (const key of ['name', 'role', 'environment', 'language', 'framework', 'storage', 'notes']) draft[key] = form.elements[key].value;
      const choice = form.elements.template.value;
      if (choice === 'none') draft.template = null;
      else if (choice !== 'pinned') { const t = base.templates[Number(choice)]; draft.template = { id: t.id, version: t.version, definitionHash: t.definitionHash }; }
      const config = clone(base.config), index = config.targets.findIndex(t => t.id === draft.id);
      if (index < 0) config.targets.push(draft); else config.targets[index] = draft;
      writing = true; form.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = true);
      try {
        snapshot = await request('/api/implementation', { method: 'POST', body: JSON.stringify({ expectedRevision: base.revision, config }) });
        selected = draft.id; dirtyDraft = false; d.close(); error = ''; render();
      } catch (e) { d.querySelector('#target-form-error').textContent = e.message; }
      finally { writing = false; if (d.isConnected) form.querySelectorAll('input, textarea, select, button').forEach(el => el.disabled = false); }
    };
  }
  function remove() {
    if (!target() || hostDirty()) return;
    const t = target(), base = snapshot;
    const d = dialog('Remove target?', `<p>Remove ${esc(t.name)} and its bindings from this configuration? Product objects, templates and custom files are kept.</p><p class="target-warning" role="alert"></p><button class="button button-danger" id="target-confirm-remove">Remove configuration only</button>`);
    const button = d.querySelector('#target-confirm-remove');
    button.onclick = async () => {
      if (writing) return; writing = true; button.disabled = true;
      try {
        snapshot = await request('/api/implementation', { method: 'POST', body: JSON.stringify({ expectedRevision: base.revision, config: { ...base.config, targets: base.config.targets.filter(item => item.id !== t.id) } }) });
        selected = snapshot.config.targets[0]?.id || null; d.close(); render();
      } catch (e) { d.querySelector('[role=alert]').textContent = e.message; }
      finally { writing = false; button.disabled = false; }
    };
  }
  function context() {
    if (!target() || hostDirty()) { error = 'Save product edits before building implementation context.'; render(); return; }
    const t = target(), base = snapshot;
    const d = dialog(`Context for ${t.name}`, `<p>The same task-context builder selects product sources and required constraints. This target adds deployment choices, pinned template metadata and relevant bindings. Nothing executes.</p><form id="target-context-form"><label>Task<textarea name="task" required maxlength="2000" rows="2" placeholder="Implement one feature for this target"></textarea></label><label>Task root<select name="rootId" required>${base.nodes.map(n => `<option value="${esc(n.id)}">${esc(n.title)} · ${esc(n.type)}</option>`).join('')}</select></label><button class="button button-primary" type="submit">Build context</button></form><p id="target-context-error" class="target-warning" role="status"></p><section id="target-context-result" hidden></section>`);
    const form = d.querySelector('form'), output = d.querySelector('#target-context-result');
    const rootId = state.selectedId || state.scope?.rootIds?.[0]; if (base.nodes.some(n => n.id === rootId)) form.elements.rootId.value = rootId;
    let buildTicket = 0;
    form.addEventListener('input', () => { buildTicket++; output.hidden = true; });
    d.addEventListener('close', () => buildTicket++);
    form.onsubmit = async event => {
      event.preventDefault(); const own = ++buildTicket; output.hidden = true;
      d.querySelector('#target-context-error').textContent = 'Building saved-source context…';
      try {
        const result = await request('/api/implementation/context', { method: 'POST', body: JSON.stringify({ targetId: t.id, expectedRevision: base.revision, context: { task: form.elements.task.value, rootIds: [form.elements.rootId.value] } }) });
        if (!d.isConnected || own !== buildTicket) return;
        const a = result.artifact;
        d.querySelector('#target-context-error').textContent = `${a.status} · ${a.budget.used} source characters · not tokenizer-measured`;
        output.innerHTML = `<h3>Implementation handoff</h3><p>${esc(a.buildId)}</p><p>${a.implementation.bindings.length} target bindings for the selected model. ${a.implementation.omittedBindings.length} bindings outside task scope.</p>${a.gaps.map(g => `<p class="target-warning">△ ${esc(g)}</p>`).join('')}<div class="target-toolbar"><button class="button" id="target-export-json">Export JSON</button><button class="button" id="target-export-markdown">Export Markdown</button></div><details><summary>Exact retained artifact</summary><pre></pre></details>`;
        output.querySelector('pre').textContent = JSON.stringify(a, null, 2); output.hidden = false;
        output.querySelector('#target-export-json').onclick = () => download(JSON.stringify(a, null, 2), 'json', 'application/json');
        output.querySelector('#target-export-markdown').onclick = () => download(result.markdown, 'md', 'text/markdown');
      } catch (e) { if (d.isConnected && own === buildTicket) d.querySelector('#target-context-error').textContent = e.message; }
    };
  }
  function download(contents, extension, mime) {
    const url = URL.createObjectURL(new Blob([contents], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a'); a.href = url; a.download = `implementation-context.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { element: root, render, open: () => { render(); if (!snapshot && !loading) refresh(); } };
}
