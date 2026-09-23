import { modal, escape } from './workspace-ui.js';
import { OBJECT_KINDS, RELATIONS, searchObjects } from './studio-presentation.js';
import { icon } from './studio-icons.js';

/** Small forms over the host's existing undoable mutations; no API or file writes. */
function protectDraft(dialog, form, closeButton) {
  const initial = () => JSON.stringify([...new FormData(form)]);
  let baseline = initial();
  const changed = () => initial() !== baseline;
  const close = () => { if (!changed() || confirm('Discard these unapplied changes?')) { window.removeEventListener('beforeunload', unload); dialog.close(); } };
  closeButton.onclick = close;
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  const unload = event => { if (changed()) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', unload);
  dialog.addEventListener('close', () => window.removeEventListener('beforeunload', unload), { once: true });
  // modal() removes synchronously; clear the listener explicitly on successful completion.
  return () => { baseline = initial(); window.removeEventListener('beforeunload', unload); dialog.close(); };
}
const relationshipOptions = () => '<option value="">Choose the meaning…</option>' + RELATIONS.map(kind => `<option value="${kind}">${kind}</option>`).join('') + '<option value="__custom">Other semantic relationship…</option>';
function wireRelationship(form) {
  const select = form.elements.relation, input = form.elements.customRelation;
  select.onchange = () => { input.parentElement.hidden = select.value !== '__custom'; input.required = select.value === '__custom'; };
  return () => select.value === '__custom' ? input.value : select.value;
}
export function showObjectDialog({ graph, rootId, defaultKind = 'feature', apply, opener }) {
  const root = rootId ? graph.nodes.find(n => n.id === rootId) : null;
  if (rootId && !root) return false;
  const dialog = modal('object-dialog', `<header><div><p class="eyebrow">DEFINE YOUR PRODUCT</p><h2 id="object-dialog-title">Add something meaningful.</h2><p>Start with a name and a purpose. Connections can evolve.</p></div><button type="button" id="object-close" class="icon-button" aria-label="Close add object">${icon('close')}</button></header>
    <form id="object-create-form"><div class="kind-grid" role="group" aria-label="Object kind">${Object.entries(OBJECT_KINDS).map(([key, def]) => `<label class="kind-choice"><input type="radio" name="kind" value="${key}" ${key === defaultKind ? 'checked' : ''}><span><strong>${escape(def.label)}</strong><small>${escape(def.help)}</small></span></label>`).join('')}</div>
    <label class="field-label" for="new-object-title">Object name</label><input id="new-object-title" class="text-input" name="title" required maxlength="200" placeholder="For example, Record usage" autofocus>
    <label class="field-label" for="new-object-description">Purpose <span class="muted">optional</span></label><textarea id="new-object-description" class="text-input" name="description" rows="3" maxlength="4000" placeholder="What should this object represent?"></textarea>
    ${root ? `<section class="connection-preview"><p>Connect from <strong>${escape(root.title)}</strong> to the new object.</p><label class="field-label" for="new-object-relation">Relationship</label><select class="text-input" id="new-object-relation" name="relation" required>${relationshipOptions()}</select><label class="field-label" hidden>Custom relationship<input class="text-input" name="customRelation" maxlength="80"></label><p class="field-help">A semantic link, not an instruction to execute steps.</p></section>` : ''}
    <p id="object-error" class="form-error" role="alert"></p><footer><span>Added as draft. Nothing is saved to disk yet.</span><button class="button button-primary" type="submit">Add object</button></footer></form>`, opener);
  dialog.classList.add('author-dialog'); dialog.setAttribute('aria-labelledby', 'object-dialog-title');
  const form = dialog.querySelector('form'), done = protectDraft(dialog, form, dialog.querySelector('#object-close'));
  const relation = root ? wireRelationship(form) : () => '';
  form.onsubmit = event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const input = { kind: form.elements.kind.value, title: form.elements.title.value, description: form.elements.description.value, rootId: root?.id ?? null, relation: relation() };
      if (apply(input) === false) throw new Error('The model is busy or the change was cancelled. Your entries are still here.');
      done();
    } catch (error) { dialog.querySelector('#object-error').textContent = error.message; }
  };
  return true;
}

export function showRelationshipDialog({ graph, fromId, apply, opener }) {
  const source = graph.nodes.find(n => n.id === fromId);
  if (!source) return false;
  const dialog = modal('relationship-dialog', `<header><div><p class="eyebrow">CONNECT PRODUCT MEANING</p><h2 id="relationship-dialog-title">Make the relationship explicit.</h2><p>From <strong>${escape(source.title)}</strong> to an existing object.</p></div><button id="relationship-close" class="icon-button" type="button" aria-label="Close relationship">${icon('close')}</button></header><form>
    <label class="field-label" for="related-search">Find an object in this project</label><input id="related-search" class="text-input" name="search" type="search" placeholder="Search names, IDs or types…">
    <label class="field-label" for="related-target">Target object</label><select id="related-target" class="text-input" name="target" required></select>
    <label class="field-label" for="related-kind">Relationship</label><select id="related-kind" name="relation" class="text-input" required>${relationshipOptions()}</select><label class="field-label" hidden>Custom relationship<input class="text-input" name="customRelation" maxlength="80"></label>
    <p class="field-help">Search includes objects hidden by your current lens. This changes the model, not the current focus.</p><p id="relationship-error" class="form-error" role="alert"></p><footer><span>Undoable. Save the model to persist.</span><button class="button button-primary" type="submit">Add relationship</button></footer></form>`, opener);
  dialog.classList.add('author-dialog'); dialog.setAttribute('aria-labelledby', 'relationship-dialog-title');
  const form = dialog.querySelector('form'), target = form.elements.target;
  function options() {
    const previous = target.value;
    const nodes = searchObjects(graph.nodes, form.elements.search.value, 100);
    target.innerHTML = '<option value="">Choose an object…</option>' + nodes.map(n => `<option value="${escape(n.id)}">${escape(n.title)} — ${escape(n.type)} (${escape(n.id)})</option>`).join('');
    if (nodes.some(n => n.id === previous)) target.value = previous;
  }
  options(); form.elements.search.oninput = options;
  const done = protectDraft(dialog, form, dialog.querySelector('#relationship-close')), relation = wireRelationship(form);
  form.onsubmit = event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      if (apply({ from: source.id, to: target.value, kind: relation() }) === false) throw new Error('The model is busy or the change was cancelled. Your entries are still here.');
      done();
    } catch (error) { dialog.querySelector('#relationship-error').textContent = error.message; }
  };
  return true;
}
