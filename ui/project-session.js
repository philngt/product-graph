import { catalogRequest, escape, modal, workspaceStyle, goTo } from './workspace-ui.js';

export function initProjectSession({ projectId, dirty, busy, save, discard }) {
  if (!projectId) return; // Legacy single-project serve has no catalog.
  workspaceStyle();
  const button = document.createElement('button');
  button.id = 'switch-project'; button.className = 'compact-button'; button.type = 'button'; button.textContent = 'Projects ▾';
  document.querySelector('.brand').after(button);
  let changing = false;
  async function navigate(id) {
    if (changing || busy()) return;
    if (id === projectId) return;
    if (id) await catalogRequest(`/api/projects/${id}`); // A moved/unavailable folder does not discard the draft.
    const href = id ? `/project/${id}/` : '/';
    const leave = () => { changing = true; discard(); goTo(href); };
    if (!dirty()) return leave();
    const dialog = modal('switch-guard', `<h2>Leave this project?</h2><p>There are unsaved model or object edits. They belong to this project only.</p><p id="switch-error" class="workspace-error" role="status"></p><footer><button id="switch-cancel" type="button">Cancel</button><button id="switch-discard" type="button">Discard and switch</button><button id="switch-save" class="button button-primary" type="button">Save and switch</button></footer>`);
    let saving = false;
    dialog.setAttribute('aria-labelledby', 'switch-guard-title'); dialog.querySelector('h2').id = 'switch-guard-title';
    dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    dialog.querySelector('#switch-cancel').onclick = () => dialog.close();
    dialog.querySelector('#switch-discard').onclick = leave;
    dialog.querySelector('#switch-save').onclick = async () => {
      if (saving || busy()) return;
      saving = true;
      dialog.querySelectorAll('button').forEach(element => element.disabled = true);
      try {
        if (!await save()) throw new Error('Not saved. Resolve invalid fields or a disk conflict in Studio, then try again.');
        leave();
      } catch (error) { dialog.querySelector('#switch-error').textContent = error.message; }
      finally { saving = false; dialog.querySelectorAll('button').forEach(element => element.disabled = false); }
    };
  }
  button.onclick = async () => {
    if (busy() || changing) return;
    const dialog = modal('project-switcher', '<h2 id="project-switch-title">Your projects</h2><p>Each project keeps its own graph, documents and history.</p><div id="switch-project-list">Loading…</div><p class="workspace-error" role="status"></p><footer><button id="switch-catalog" type="button">Manage projects</button><button id="switch-close" type="button">Close</button></footer>', button);
    dialog.setAttribute('aria-labelledby', 'project-switch-title');
    dialog.querySelector('#switch-close').onclick = () => dialog.close();
    dialog.querySelector('#switch-catalog').onclick = () => { dialog.close(); navigate(null).catch(error => alert(error.message)); };
    try {
      const { projects } = await catalogRequest('/api/projects');
      if (!dialog.isConnected) return;
      dialog.querySelector('#switch-project-list').innerHTML = projects.map(project => `<button class="project-switch-row" type="button" data-project-id="${escape(project.id)}" ${!project.available || project.id === projectId ? 'disabled' : ''}><strong>${escape(project.name)}${project.id === projectId ? ' · current' : ''}</strong><small>${escape(project.root)}</small>${project.available ? '' : '<span>Unavailable</span>'}</button>`).join('');
      dialog.querySelectorAll('[data-project-id]').forEach(item => item.onclick = () => {
        const id = item.dataset.projectId;
        dialog.close(); navigate(id).catch(error => alert(error.message));
      });
    } catch (error) { if (dialog.isConnected) dialog.querySelector('.workspace-error').textContent = error.message; }
  };
  catalogRequest(`/api/projects/${projectId}/visit`, { method: 'POST', body: '{}' }).catch(() => { button.title = 'Could not update recent projects. Your product is unchanged.'; });
}
