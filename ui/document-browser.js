import { escape, modal, workspaceStyle } from './workspace-ui.js';

export function initDocumentBrowser({ request, graph, selection, isDirty, inspect }) {
  workspaceStyle();
  const button = document.createElement('button'); button.type = 'button'; button.id = 'open-documents'; button.className = 'tool-button'; button.textContent = '▤ Documents';
  document.querySelector('.tool-list').append(button);
  button.onclick = async () => {
    if (!graph()) return;
    let index = [], filter = '', kind = 'all', file = null, ticket = 0, listing = 0;
    const dialog = modal('document-browser', `<header><div><p class="eyebrow">PROJECT DOCUMENTS · READ ONLY</p><h2 id="documents-title">Files with context.</h2></div><button id="documents-close" type="button">Close</button></header><p id="documents-saved-note"></p><div class="documents-layout"><aside class="documents-nav"><label>Find a document<input id="document-search" type="search" placeholder="Title or path"></label><label>Collection<select id="document-kind"><option value="all">All documents</option><option value="source">Source documents</option><option value="generated">Generated context</option><option value="related">Linked to selected object</option></select></label><button id="documents-refresh" type="button">Refresh files</button><div id="document-list" aria-label="Document list">Loading…</div></aside><section class="document-reader"><h3 id="document-title">Select a document</h3><p id="document-path"></p><p id="document-meta"></p><textarea id="document-source" readonly aria-label="Markdown source" spellcheck="false" placeholder="Source text appears here. Files are never rendered as HTML."></textarea><p id="document-message" class="workspace-error" role="status"></p></section><aside class="document-context"><h3>On this page</h3><nav id="document-outline" aria-label="Document outline"></nav><h3>Linked product objects</h3><div id="document-nodes"></div><h3>Document links</h3><div id="document-links"></div><h3>Backlinks</h3><div id="document-backlinks"></div></aside></div><footer><span id="documents-limit"></span><span>Plain files. Source text is preserved.</span></footer>`, button);
    dialog.setAttribute('aria-labelledby', 'documents-title');
    const $ = id => dialog.querySelector(`#${id}`);
    $('documents-saved-note').textContent = isDirty() ? 'This reader shows saved files and saved graph links. Your unsaved model edits are preserved separately.' : 'Read source documents and generated context from the current project folder.';
    $('documents-close').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { ticket++; listing++; });
    function rows() {
      const currentId = selection();
      const items = index.filter(item => (kind === 'all' || kind === 'related' ? kind !== 'related' || item.nodeIds.includes(currentId) : item.kind === kind) && `${item.title} ${item.path}`.toLowerCase().includes(filter.toLowerCase().trim()));
      $('document-list').innerHTML = items.map(item => `<button type="button" class="document-row ${item.path === file ? 'active' : ''}" data-document-path="${escape(item.path)}" ${!item.available ? 'disabled' : ''}><span>${escape(item.title)}</span><small>${escape(item.path)}</small><em>${item.available ? item.kind : 'Unavailable'}</em></button>`).join('') || '<p>No matching documents in the bounded index.</p>';
      $('document-list').querySelectorAll('[data-document-path]').forEach(element => element.onclick = () => read(element.dataset.documentPath));
    }
    function linked(id, items) {
      $(id).innerHTML = items.length ? items.map(item => `<button class="document-link" type="button" data-read-path="${escape(item.path)}" ${item.available === false ? 'disabled' : ''}>${escape(item.title || item.path)}</button>`).join('') : '<p>None found.</p>';
      $(id).querySelectorAll('[data-read-path]').forEach(element => element.onclick = () => read(element.dataset.readPath));
    }
    async function read(next) {
      file = next; const own = ++ticket; rows();
      $('document-title').textContent = 'Loading document…'; $('document-path').textContent = next;
      $('document-source').value = ''; $('document-meta').textContent = ''; $('document-message').textContent = '';
      for (const id of ['document-outline', 'document-nodes', 'document-links', 'document-backlinks']) $(id).textContent = '';
      try {
        const doc = await request(`/api/documents/read?path=${encodeURIComponent(next)}`);
        if (!dialog.isConnected || own !== ticket) return;
        $('document-title').textContent = doc.title; $('document-source').value = doc.content;
        $('document-meta').textContent = `${doc.kind} · saved file · ${doc.bytes} bytes · ${doc.revision.slice(0, 23)}`;
        $('document-outline').innerHTML = doc.headings.map(heading => `<button type="button" data-line="${heading.line}" style="padding-left:${Math.min(heading.level, 6) * 8}px">${escape(heading.title)}</button>`).join('') || '<p>No ATX headings.</p>';
        $('document-outline').querySelectorAll('[data-line]').forEach(element => element.onclick = () => {
          const source = $('document-source'), line = Number(element.dataset.line) - 1;
          const offset = source.value.split('\n').slice(0, line).reduce((sum, text) => sum + text.length + 1, 0);
          source.focus(); source.setSelectionRange(offset, offset + source.value.split('\n')[line].length);
          source.scrollTop = Math.max(0, line * parseFloat(getComputedStyle(source).lineHeight) - 60);
        });
        $('document-nodes').innerHTML = doc.nodes.length ? doc.nodes.map(node => `<button type="button" class="document-link" data-inspect-node="${escape(node.id)}">${escape(node.title)} ↗</button>`).join('') : '<p>No graph links. Reading a file does not invent semantic relationships.</p>';
        $('document-nodes').querySelectorAll('[data-inspect-node]').forEach(element => element.onclick = () => {
          if (!graph().nodes.some(node => node.id === element.dataset.inspectNode)) return;
          dialog.close(); inspect(element.dataset.inspectNode);
        });
        linked('document-links', doc.links); linked('document-backlinks', doc.backlinks);
        $('document-message').textContent = doc.truncated ? 'Index limit reached; link results may be incomplete.' : '';
      } catch (error) { if (dialog.isConnected && own === ticket) { $('document-title').textContent = 'Document unavailable'; $('document-message').textContent = error.message; } }
    }
    async function refresh() {
      const own = ++listing;
      try {
        const result = await request('/api/documents');
        if (!dialog.isConnected || own !== listing) return;
        index = result.documents; rows();
        $('documents-limit').textContent = `${index.length} documents · ${result.truncated ? 'index limited' : 'saved files'}${result.notices.length ? ` · ${result.notices.length} skipped entries` : ''}`;
        if (file) await read(file);
      } catch (error) { if (dialog.isConnected && own === listing) $('document-message').textContent = error.message; }
    }
    $('document-search').oninput = event => { filter = event.target.value; rows(); };
    $('document-kind').onchange = event => { kind = event.target.value; rows(); };
    $('documents-refresh').onclick = refresh;
    await refresh();
  };
}
