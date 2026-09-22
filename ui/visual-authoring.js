/** Visual authoring is a Studio tool, not a second product model or an agent runtime. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copy = value => structuredClone(value);
const empty = () => ({ schemaVersion: 'productgraph.sketch.v1', notes: [], links: [] });
const short = value => value.length > 65 ? `${value.slice(0, 64)}…` : value;

export function initVisualAuthoring({ request, graph, scope, dirty, busy: hostBusy, onProposal, apply, inspect, review }) {
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/visual-authoring.css'; document.head.append(style);
  const opener = document.createElement('button'); opener.type = 'button'; opener.id = 'open-authoring'; opener.className = 'tool-button'; opener.textContent = '✎ Sketch & define';
  document.querySelector('.tool-list').prepend(opener);
  const dialog = document.createElement('dialog'); dialog.id = 'authoring-dialog'; dialog.className = 'authoring-dialog'; dialog.setAttribute('aria-labelledby', 'authoring-title');
  dialog.innerHTML = `
    <header class="authoring-head"><div><p class="eyebrow">HUMAN + AGENT · SHARED PRODUCT MODEL</p><h2 id="authoring-title">Sketch. Define. Review.</h2><p id="authoring-scope"></p></div><div class="authoring-actions"><span id="sketch-save-state" role="status"></span><button id="sketch-save" class="button button-primary">Save sketch</button><button id="sketch-close" class="icon-button" aria-label="Close visual authoring">×</button></div></header>
    <nav class="authoring-nav" aria-label="Authoring stages"><button data-stage="sketch" aria-pressed="true">01 · Sketch</button><button data-stage="define">02 · Define & review</button><button data-stage="context">03 · Context for agent</button><span>Model approval ≠ execution permission</span></nav>
    <p id="authoring-message" class="authoring-message" role="status" aria-live="polite"></p>
    <section id="authoring-sketch" class="sketch-layout">
      <aside class="sketch-composer"><h3>Start with an idea</h3><p>Notes, questions and assumptions stay unconfirmed. Sketch arrows never run anything.</p>
        <form id="sketch-form"><label>Kind<select id="sketch-kind"><option value="note">Note</option><option value="question">Open question</option><option value="assumption">Assumption</option></select></label><label>Your words<textarea id="sketch-text" rows="6" maxlength="4000" required placeholder="What should the product help someone do?"></textarea></label><button id="sketch-capture" class="button button-primary">Capture note</button><button id="sketch-cancel-edit" type="button" class="text-button">Clear draft</button></form>
        <div class="sketch-link-editor"><h3>Connect ideas</h3><label>From<select id="sketch-from"></select></label><label>To<select id="sketch-to"></select></label><button id="sketch-link" class="button button-secondary">Add untyped arrow</button><div id="sketch-links"></div></div>
        <details><summary>What is implemented?</summary><p>Text cards, positioning, untyped arrows and reviewed semantic definitions. No freehand pen, image interpretation, code runner, or SwiftUI generation.</p></details>
      </aside>
      <div class="sketch-workarea"><div class="sketch-tools"><span id="sketch-count"></span><div><button id="sketch-undo" class="compact-button">Undo sketch</button><button id="sketch-redo" class="compact-button">Redo</button><button id="sketch-remove" class="compact-button">Remove selected</button><button id="sketch-define" class="button button-secondary">Define selection →</button></div></div><div class="sketch-scroll"><div id="sketch-board"><svg id="sketch-arrows" aria-hidden="true"></svg><div id="sketch-notes"></div><p id="sketch-empty">Capture a first note.<br><small>The model does not need to be precise yet.</small></p></div></div><p class="sketch-caption">Select cards to define them · Drag handles to arrange · Arrow keys on a handle move a card · Escape cancels a drag</p></div>
    </section>
    <section id="authoring-define" class="authoring-section" hidden><div class="authoring-section-heading"><div><h3>Decide what the sketch means</h3><p>Choose a new object type or reuse an existing object. All new objects start as drafts.</p></div><button id="authoring-review-all" class="text-button">Open saved proposals ↗</button></div>
      <form id="definition-form"><div id="definition-mappings" class="definition-grid"></div><h3>Explicit semantic relationships</h3><p>Each arrow starts as “leave untyped”. Only choices below become graph edges. Control/data execution edges are not implemented.</p><div id="definition-relations"></div><label>Proposal title<input id="definition-title" required maxlength="200" value="Define sketch meaning" /></label><button id="definition-propose" class="button button-primary">Create proposal for review</button></form>
      <section id="definition-review" hidden><h3>Review the exact change</h3><p id="definition-summary"></p><div id="definition-diff"></div><details><summary>Commands & source snapshot</summary><pre id="definition-json"></pre></details><label class="check-label"><input id="definition-approved" type="checkbox" /> I reviewed these definitions and relationships. This does not authorize execution.</label><div class="authoring-actions"><button id="definition-apply" class="button button-primary" disabled>Apply reviewed proposal</button><button id="definition-reject" class="button button-secondary">Reject proposal</button></div></section>
    </section>
    <section id="authoring-context" class="authoring-section" hidden><div class="authoring-section-heading"><div><h3>Build the handoff, not another prompt</h3><p>Saved model + required constraints + linked document content + explicitly selected sketch notes.</p></div><span class="tag">Read-only build</span></div>
      <form id="task-context-form"><div class="task-fields"><label>Task<textarea id="task-context-task" rows="2" required maxlength="2000" placeholder="Describe the change or decision the agent should work on."></textarea></label><label>Product object<select id="task-context-root" required></select></label><label>Character budget<input id="task-context-budget" type="number" min="1000" max="120000" value="24000" required /></label></div><label class="check-label"><input id="task-context-sketch" type="checkbox" /> Include selected notes, explicitly marked as unconfirmed</label><button class="button button-primary" id="task-context-build">Build & explain context</button></form>
      <div id="task-context-result" hidden><div class="context-build-heading"><strong id="task-context-status"></strong><div><button id="context-export-json" class="button button-secondary">Export JSON</button><button id="context-export-md" class="button button-secondary">Export Markdown</button></div></div><p id="task-context-budget-report"></p><h3>Gaps & warnings</h3><ul id="task-context-gaps"></ul><h3>Included / excluded sources</h3><div id="task-context-trace"></div><details><summary>Exact agent payload</summary><pre id="task-context-output"></pre></details><p class="authoring-boundary">Review private content before sharing. Export is a snapshot, not an instruction to run code or a guarantee of task completeness.</p></div>
    </section>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector(`#${id}`);
  let board = empty(), saved = empty(), revision = null, graphRevision = null, kinds = {}, relations = [];
  let selected = new Set(), editing = null, undo = [], redo = [], pending = null, build = null;
  let stage = 'sketch', working = false, loading = false, loaded = false, epoch = 0, dragging = null, definitionDraft = false;
  const boardDirty = () => JSON.stringify(board) !== JSON.stringify(saved);
  const composerDirty = () => Boolean($('sketch-text').value.trim());
  const message = value => { $('authoring-message').textContent = value; };
  const post = (url, value) => request(url, { method: 'POST', body: JSON.stringify(value), signal: AbortSignal.timeout(30000) });
  function invalidate() {
    build = null; $('task-context-result').hidden = true;
    if (pending) { pending = null; $('definition-review').hidden = true; }
    definitionDraft = false;
  }
  function controls() {
    $('sketch-save-state').textContent = loading ? 'Loading…' : !loaded ? 'Not loaded' : working ? 'Working…' : boardDirty() ? 'Sketch draft · unsaved' : 'Sketch saved · unconfirmed';
    dialog.querySelectorAll('button, input, select, textarea').forEach(el => { el.disabled = working || loading || Boolean(dragging) || !loaded && el.id !== 'sketch-close'; });
    $('sketch-save').disabled = working || loading || !loaded || !boardDirty() || Boolean(dragging);
    $('sketch-undo').disabled ||= !undo.length;
    $('sketch-redo').disabled ||= !redo.length;
    $('sketch-remove').disabled ||= !selected.size;
    $('sketch-define').disabled ||= !selected.size;
    $('definition-propose').disabled ||= !selected.size || boardDirty() || dirty();
    $('definition-apply').disabled ||= !pending || pending.proposal.status !== 'pending' || !$('definition-approved').checked || boardDirty() || dirty();
    $('definition-reject').disabled ||= !pending || pending.proposal.status !== 'pending';
    $('task-context-build').disabled ||= boardDirty() || dirty() || !graph()?.nodes.length;
    $('context-export-json').disabled ||= !build;
    $('context-export-md').disabled ||= !build;
  }
  async function run(action) {
    if (working || loading || dragging || hostBusy()) return;
    const token = epoch; working = true; controls(); message('');
    try { await action(() => token === epoch && dialog.open); }
    catch (error) { if (token === epoch) message(error.message); }
    finally { if (token === epoch) { working = false; controls(); } }
  }
  function mutate(fn) {
    if (working || loading || dragging) return;
    undo.push(copy(board)); if (undo.length > 50) undo.shift(); redo = [];
    fn(); invalidate(); renderBoard();
  }
  function clearComposer() { editing = null; $('sketch-text').value = ''; $('sketch-kind').value = 'note'; $('sketch-capture').textContent = 'Capture note'; }
  function confirmComposer() { return !composerDirty() || confirm('Discard the uncaptured note draft?'); }
  function renderArrows() {
    const width = Math.max(1000, ...board.notes.map(n => n.x + 310)), height = Math.max(620, ...board.notes.map(n => n.y + 240));
    $('sketch-board').style.width = `${width}px`; $('sketch-board').style.height = `${height}px`;
    $('sketch-arrows').setAttribute('viewBox', `0 0 ${width} ${height}`);
    $('sketch-arrows').innerHTML = `<defs><marker id="sketch-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>` + board.links.map(link => {
      const a = board.notes.find(n => n.id === link.from), b = board.notes.find(n => n.id === link.to);
      if (!a || !b) return '';
      const forward = b.x >= a.x, sign = forward ? 1 : -1;
      const start = a.x + (forward ? 240 : 0), end = b.x + (forward ? 0 : 240);
      const reach = Math.max(32, Math.abs(end - start) / 2);
      return `<path class="sketch-connector" d="M ${start} ${a.y + 85} C ${start + sign * reach} ${a.y + 85}, ${end - sign * reach} ${b.y + 85}, ${end} ${b.y + 85}"/><text x="${(start + end) / 2}" y="${(a.y + b.y) / 2 + 70}">untyped</text>`;
    }).join('');
  }
  function renderBoard() {
    selected = new Set([...selected].filter(id => board.notes.some(n => n.id === id)));
    $('sketch-count').textContent = `${board.notes.length} notes · ${selected.size} selected · not product requirements yet`;
    $('sketch-empty').hidden = Boolean(board.notes.length);
    $('sketch-notes').innerHTML = board.notes.map(note => `<article class="sketch-card ${note.kind} ${selected.has(note.id) ? 'selected' : ''}" style="left:${note.x}px;top:${note.y}px" data-note="${esc(note.id)}"><header><button type="button" data-drag="${esc(note.id)}" class="sketch-handle" aria-label="Move ${esc(short(note.text))}">⠿ ${esc(note.kind)}</button><button type="button" data-edit="${esc(note.id)}" class="text-button">Edit</button></header><button type="button" data-select="${esc(note.id)}" aria-pressed="${selected.has(note.id)}"><span>${esc(note.text)}</span><small>${selected.has(note.id) ? 'Selected for definition' : 'Select to define'} · unconfirmed</small></button></article>`).join('');
    renderArrows();
    const options = board.notes.map(n => `<option value="${esc(n.id)}">${esc(short(n.text))}</option>`).join('');
    const previous = [$('sketch-from').value, $('sketch-to').value];
    $('sketch-from').innerHTML = options; $('sketch-to').innerHTML = options;
    if (board.notes.some(n => n.id === previous[0])) $('sketch-from').value = previous[0];
    $('sketch-to').value = board.notes.some(n => n.id === previous[1]) ? previous[1] : board.notes[1]?.id || '';
    $('sketch-links').innerHTML = board.links.map((l, i) => `<button type="button" data-remove-link="${esc(l.id)}" class="text-button">Remove arrow ${i + 1}</button>`).join('');
    $('sketch-notes').querySelectorAll('[data-select]').forEach(b => b.onclick = () => {
      const id = b.dataset.select; selected.has(id) ? selected.delete(id) : selected.add(id); definitionDraft = false; renderBoard();
    });
    $('sketch-notes').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      if (!confirmComposer()) return;
      const note = board.notes.find(n => n.id === b.dataset.edit); editing = note.id;
      $('sketch-text').value = note.text; $('sketch-kind').value = note.kind; $('sketch-capture').textContent = 'Update note'; $('sketch-text').focus();
    });
    $('sketch-links').querySelectorAll('[data-remove-link]').forEach(b => b.onclick = () => mutate(() => { board.links = board.links.filter(l => l.id !== b.dataset.removeLink); }));
    $('sketch-notes').querySelectorAll('[data-drag]').forEach(b => {
      b.onpointerdown = event => drag(event, b.dataset.drag);
      b.onkeydown = event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const note = board.notes.find(n => n.id === b.dataset.drag);
        mutate(() => { note.x = Math.max(0, Math.min(10000, note.x + (event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0))); note.y = Math.max(0, Math.min(10000, note.y + (event.key === 'ArrowDown' ? 16 : event.key === 'ArrowUp' ? -16 : 0))); });
        [...$('sketch-notes').querySelectorAll('[data-drag]')].find(el => el.dataset.drag === note.id)?.focus();
      };
    });
    controls();
  }
  function drag(event, id) {
    if (event.button !== 0 || working || loading || dragging) return;
    event.preventDefault();
    const before = copy(board), note = board.notes.find(n => n.id === id), x = note.x, y = note.y;
    const element = event.currentTarget.closest('.sketch-card'); let moved = false;
    dragging = id;
    const move = e => {
      if (e.pointerId !== event.pointerId) return;
      if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 4) return;
      moved = true; note.x = Math.max(0, Math.min(10000, x + e.clientX - event.clientX)); note.y = Math.max(0, Math.min(10000, y + e.clientY - event.clientY));
      element.style.left = `${note.x}px`; element.style.top = `${note.y}px`; renderArrows();
    };
    const finish = cancel => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancelled); window.removeEventListener('keydown', key);
      dragging = null;
      if (cancel) board = before;
      else if (moved) { undo.push(before); if (undo.length > 50) undo.shift(); redo = []; invalidate(); }
      renderBoard();
    };
    const up = e => { if (e.pointerId === event.pointerId) finish(false); };
    const cancelled = e => { if (e.pointerId === event.pointerId) finish(true); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(true); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancelled); window.addEventListener('keydown', key);
  }
  function renderDefinitions() {
    if (definitionDraft) return;
    const chosen = board.notes.filter(n => selected.has(n.id));
    $('definition-mappings').innerHTML = chosen.map(n => `<fieldset data-mapping="${esc(n.id)}"><legend>${esc(n.kind)} → product object</legend><blockquote>${esc(n.text)}</blockquote><label>Meaning<select class="mapping-kind" required><option value="">Choose explicitly…</option>${Object.entries(kinds).map(([key, value]) => `<option value="${esc(key)}">${esc(value.label)}</option>`).join('')}<optgroup label="Reuse existing object">${graph().nodes.map(node => `<option value="existing:${esc(node.id)}">${esc(node.title)}</option>`).join('')}</optgroup></select></label><label>Object title<input class="mapping-title" maxlength="200" value="${esc(n.text.split('\n')[0].slice(0, 200))}" /></label>${n.kind !== 'note' ? '<label class="check-label"><input class="mapping-confirm" type="checkbox" required /> I have resolved/acknowledged this uncertainty for this proposed definition. It is not verified evidence.</label>' : ''}<details><summary>Low-code contract (declaration only)</summary><label>Inputs<input class="mapping-inputs" maxlength="1000" placeholder="e.g. Bottle, UsageRecord[]" /></label><label>Outputs<input class="mapping-outputs" maxlength="1000" placeholder="e.g. Recommendation or NoMatch" /></label><label>Custom implementation reference<input class="mapping-reference" maxlength="1000" placeholder="e.g. Features/Rotation/Score.swift" /></label><p>No code is read, generated or executed from this reference.</p></details></fieldset>`).join('') || '<p>Select sketch cards first. Nothing is inferred automatically.</p>';
    $('definition-relations').innerHTML = board.links.filter(l => selected.has(l.from) && selected.has(l.to)).map(l => `<label class="definition-relation">${esc(short(board.notes.find(n => n.id === l.from).text))} → ${esc(short(board.notes.find(n => n.id === l.to).text))}<select data-from="${esc(l.from)}" data-to="${esc(l.to)}"><option value="">Leave as untyped sketch arrow</option>${relations.map(kind => `<option>${esc(kind)}</option>`).join('')}</select></label>`).join('') || '<p>No selected sketch arrows. Connect ideas on the sketch first to propose a relationship.</p>';
    definitionDraft = true;
  }
  function renderRoots(prefer) {
    const current = prefer || $('task-context-root').value || scope().rootIds[0] || graph()?.nodes[0]?.id;
    $('task-context-root').innerHTML = graph().nodes.map(n => `<option value="${esc(n.id)}">${esc(n.title)} · ${esc(n.type)}</option>`).join('');
    if (graph().nodes.some(n => n.id === current)) $('task-context-root').value = current;
  }
  function show(next) {
    if (working || loading || dragging) return;
    stage = next;
    for (const name of ['sketch', 'define', 'context']) $(`authoring-${name}`).hidden = name !== stage;
    dialog.querySelectorAll('[data-stage]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stage === stage)));
    if (stage === 'define') renderDefinitions();
    if (stage === 'context') renderRoots();
    if (dirty()) message('The product model has unsaved edits. Close this tool and save/apply them before defining or building context.');
    else if (boardDirty() && stage !== 'sketch') message('Save the sketch first. Definitions and context use the saved source, never an unseen draft.');
    else message('');
    controls();
  }
  function renderReview() {
    $('definition-review').hidden = !pending;
    if (!pending) return;
    $('definition-approved').checked = false;
    const { proposal, diff, diagnostics } = pending;
    $('definition-summary').textContent = `${proposal.status} · ${diff.nodesAdded.length} new draft objects · ${diff.edgesAdded.length} semantic relationships · ${diagnostics.length} validation findings`;
    $('definition-diff').innerHTML = `<div class="definition-grid">${diff.nodesAdded.map(n => `<article class="paper-card"><span class="tag">${esc(n.region)}</span><h4>${esc(n.title)}</h4><p>${esc(n.type)} · draft</p>${proposal.status === 'applied' ? `<button type="button" data-inspect-added="${esc(n.id)}" class="text-button">Show in model ↗</button>` : ''}</article>`).join('')}</div><ul>${diff.edgesAdded.map(e => `<li>${esc(e.from)} — ${esc(e.kind)} → ${esc(e.to)}</li>`).join('')}${diagnostics.map(d => `<li>${esc(d.level)}: ${esc(d.message)}</li>`).join('')}</ul>`;
    $('definition-json').textContent = JSON.stringify(proposal, null, 2);
    $('definition-diff').querySelectorAll('[data-inspect-added]').forEach(button => button.onclick = () => {
      if (working || boardDirty() || composerDirty()) return;
      epoch++; dialog.close(); inspect(button.dataset.inspectAdded);
    });
    controls();
  }
  function close() {
    if (working || loading || dragging) return;
    if ((boardDirty() || composerDirty()) && !confirm('Discard unsaved sketch and uncaptured note changes? Saved notes and proposals stay on disk.')) return;
    epoch++; board = copy(saved); clearComposer(); dialog.close(); opener.focus({ preventScroll: true });
  }
  opener.onclick = async () => {
    if (!graph() || hostBusy()) return;
    epoch++; const token = epoch; let failure = ''; dialog.showModal(); loading = true; loaded = false; controls(); message('');
    $('authoring-scope').textContent = `${graph().manifest.name} / ${scope().title} · model and sketch remain separate`;
    try {
      const result = await request('/api/authoring', { signal: AbortSignal.timeout(30000) });
      if (token !== epoch) return;
      board = copy(result.board); saved = copy(board); revision = result.boardRevision; graphRevision = result.graphRevision;
      kinds = result.kinds; relations = result.relations; loaded = true; selected = new Set(); undo = []; redo = []; clearComposer(); invalidate(); renderBoard();
    } catch (error) { failure = error.message; }
    finally { if (token === epoch) { loading = false; show('sketch'); controls(); if (failure) message(failure); } }
  };
  $('sketch-close').onclick = close;
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  window.addEventListener('beforeunload', e => { if (boardDirty() || composerDirty()) { e.preventDefault(); e.returnValue = ''; } });
  dialog.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => show(b.dataset.stage));
  $('sketch-define').onclick = () => show('define');
  $('sketch-form').onsubmit = e => {
    e.preventDefault();
    const content = $('sketch-text').value, kind = $('sketch-kind').value;
    if (!content.trim() || board.notes.length >= 200 && !editing) return message('Enter a note; a sketch supports at most 200 notes.');
    mutate(() => {
      if (editing) Object.assign(board.notes.find(n => n.id === editing), { text: content, kind });
      else { const note = { id: crypto.randomUUID(), text: content, kind, x: 40 + (board.notes.length % 3) * 300, y: 40 + Math.floor(board.notes.length / 3) * 230 }; if (scope().rootIds[0]) note.focusId = scope().rootIds[0]; board.notes.push(note); selected.add(note.id); }
    });
    clearComposer(); message('Captured as unconfirmed sketch material. Save when ready.');
  };
  $('sketch-cancel-edit').onclick = () => { if (confirmComposer()) clearComposer(); };
  $('sketch-link').onclick = () => {
    const from = $('sketch-from').value, to = $('sketch-to').value;
    if (!from || !to || from === to || board.links.length >= 500) return message('Choose two different notes; at most 500 arrows.');
    if (board.links.some(l => l.from === from && l.to === to)) return message('That sketch arrow already exists.');
    mutate(() => board.links.push({ id: crypto.randomUUID(), from, to }));
  };
  $('sketch-remove').onclick = () => { if (selected.size && confirm('Remove selected sketch cards and their untyped arrows? Product objects are not deleted.')) mutate(() => { board.notes = board.notes.filter(n => !selected.has(n.id)); board.links = board.links.filter(l => !selected.has(l.from) && !selected.has(l.to)); }); };
  for (const [name, source, dest] of [['undo', () => undo, () => redo], ['redo', () => redo, () => undo]]) $(`sketch-${name}`).onclick = () => {
    if (!source().length || working || dragging) return;
    dest().push(copy(board)); board = source().pop(); invalidate(); renderBoard();
  };
  $('sketch-save').onclick = () => run(async current => {
    if (composerDirty()) return message('Capture or update the note draft before saving.');
    const result = await post('/api/authoring/board', { expectedRevision: revision, board });
    if (!current()) return;
    board = copy(result.board); saved = copy(board); revision = result.boardRevision; invalidate(); renderBoard(); message('Sketch saved. Product meaning is unchanged.');
  });
  $('definition-form').onsubmit = e => { e.preventDefault(); run(async current => {
    if (boardDirty() || dirty() || composerDirty()) return message('Save sketch and product changes first.');
    const mappings = [...$('definition-mappings').querySelectorAll('[data-mapping]')].map(field => {
      const value = field.querySelector('.mapping-kind').value;
      return { noteId: field.dataset.mapping, ...(value.startsWith('existing:') ? { existingNodeId: value.slice(9) } : { kind: value, title: field.querySelector('.mapping-title').value, inputs: field.querySelector('.mapping-inputs').value, outputs: field.querySelector('.mapping-outputs').value, implementationRef: field.querySelector('.mapping-reference').value }), interpretationConfirmed: field.querySelector('.mapping-confirm')?.checked === true };
    });
    const chosenRelations = [...$('definition-relations').querySelectorAll('select')].filter(el => el.value).map(el => ({ from: el.dataset.from, to: el.dataset.to, kind: el.value }));
    const result = await post('/api/authoring/proposal', { title: $('definition-title').value, expectedBoardRevision: revision, expectedGraphRevision: graphRevision, mappings, relations: chosenRelations });
    if (!current()) return;
    pending = result; onProposal(result.proposal); renderReview(); message('Proposal saved for review. The canonical graph has NOT changed.'); $('definition-review').scrollIntoView({ block: 'start' });
  }); };
  $('definition-approved').onchange = controls;
  $('definition-apply').onclick = () => run(async current => {
    if (!pending || dirty() || boardDirty() || !$('definition-approved').checked) return;
    const preview = await post(`/api/proposals/${encodeURIComponent(pending.proposal.id)}/preview`, {});
    if (!preview.canApply || preview.proposalRevision !== pending.proposalRevision) throw new Error('Sources changed or proposal is no longer pending. Review a new proposal.');
    const success = await apply(pending.proposal.id, pending.proposalRevision);
    if (!current() || !success) return message('Proposal was not applied. Resolve errors in the model or cancel.');
    pending.proposal.status = 'applied'; renderReview(); build = null; $('task-context-result').hidden = true;
    const refreshed = await request('/api/authoring'); graphRevision = refreshed.graphRevision;
    renderRoots(pending.diff.nodesAdded[0]?.id); message('Definitions applied as drafts. No code or workflow has been executed.');
  });
  $('definition-reject').onclick = () => run(async current => {
    const result = await post(`/api/proposals/${encodeURIComponent(pending.proposal.id)}/reject`, {});
    if (current()) { pending.proposal = result.proposal; onProposal(result.proposal); renderReview(); message('Proposal rejected; source sketch is retained.'); }
  });
  $('authoring-review-all').onclick = () => { if (!boardDirty() && !composerDirty()) { dialog.close(); epoch++; review(); } else message('Save sketch changes before leaving.'); };
  $('task-context-form').addEventListener('input', () => { build = null; $('task-context-result').hidden = true; });
  $('task-context-form').onsubmit = e => { e.preventDefault(); run(async current => {
    if (dirty() || boardDirty() || composerDirty()) return message('Save product/sketch changes and capture the note draft first.');
    const result = await post('/api/task-context', { task: $('task-context-task').value, rootIds: [$('task-context-root').value], sketchIds: $('task-context-sketch').checked ? [...selected] : [], maxCharacters: Number($('task-context-budget').value) });
    if (!current()) return;
    build = result; const a = build.artifact;
    $('task-context-result').hidden = false; $('task-context-status').textContent = a.status;
    $('task-context-budget-report').textContent = `${a.budget.used} / ${a.budget.limit} source characters · not measured tokens · ${a.buildId}`;
    $('task-context-gaps').innerHTML = [...a.gaps, ...a.warnings].map(g => `<li>${esc(g)}</li>`).join('');
    $('task-context-trace').innerHTML = a.trace.map(t => `<div class="context-trace-row"><span class="tag">${t.selected ? 'included' : 'excluded'}</span><code>${esc(t.id)}</code><span>${esc(t.reason)}</span></div>`).join('');
    $('task-context-output').textContent = result.markdown; message('Built from saved sources. Review gaps and content before sharing.');
  }); };
  function exportBuild(format) {
    if (!build) return;
    const content = format === 'json' ? JSON.stringify(build.artifact, null, 2) : build.markdown;
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' }));
    const a = document.createElement('a'); a.href = url; a.download = `product-context-${build.artifact.buildId.slice(7, 19)}.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('context-export-json').onclick = () => exportBuild('json'); $('context-export-md').onclick = () => exportBuild('md');
  return { isDirty: () => boardDirty() || composerDirty() };
}
