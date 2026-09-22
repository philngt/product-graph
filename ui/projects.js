import { catalogRequest, escape, modal, goTo } from './workspace-ui.js';
import { initAppearance } from './studio-controls.js';
initAppearance();
const $ = id => document.getElementById(id);
let projects = [], managed = '';
async function refresh() {
  try {
    const result = await catalogRequest('/api/projects'); projects = result.projects; managed = result.managedDirectory;
    $('managed-location').textContent = `New project location: ${managed}`;
    $('catalog-error').textContent = ''; render();
  } catch (error) { $('catalog-error').textContent = error.message; $('project-cards').textContent = 'Project catalog could not be loaded. Your folders are unchanged.'; }
}
function render() {
  const query = $('project-search').value.trim().toLowerCase();
  const filtered = projects.filter(project => `${project.name} ${project.root}`.toLowerCase().includes(query));
  $('projects-count').textContent = `${filtered.length} of ${projects.length} projects`;
  $('project-cards').innerHTML = filtered.length ? filtered.map((project, index) => `<article class="project-card"><div class="project-card-top"><span class="project-number">${String(index + 1).padStart(2, '0')}</span><span class="project-availability">${project.available ? 'Local project' : 'Folder unavailable'}</span></div><h2>${escape(project.name)}</h2><p>${escape(project.description || 'A product model waiting to take shape.')}</p><code>${escape(project.root)}</code><p class="project-last-open">${project.lastOpenedAt ? `Opened ${escape(new Date(project.lastOpenedAt).toLocaleString())}` : 'Not opened in this workspace yet'}</p>${project.message ? `<p class="workspace-error">${escape(project.message)}</p>` : ''}<footer><button type="button" class="text-button" data-forget="${escape(project.id)}">Remove from list</button><a data-open-id="${escape(project.id)}" ${project.available ? `href="/project/${escape(project.id)}/"` : 'aria-disabled="true"'}>Open studio ↗</a></footer></article>`).join('') : `<section class="catalog-empty"><h2>${projects.length ? 'No projects match.' : 'Your next product starts here.'}</h2><p>${projects.length ? 'Try a different name or path.' : 'Create a project, or register an existing Product Graph folder. Files stay where they are.'}</p></section>`;
  $('project-cards').querySelectorAll('[data-forget]').forEach(button => button.onclick = () => forget(button.dataset.forget, button));
}
function forget(id, opener) {
  const project = projects.find(item => item.id === id);
  const dialog = modal('forget-project', `<h2 id="forget-title">Remove ${escape(project.name)} from this list?</h2><p>The graph, documents and project folder will remain on disk. You can open the folder again later.</p><p class="workspace-error" role="status"></p><footer><button type="button" data-cancel>Cancel</button><button type="button" data-confirm>Remove from list</button></footer>`, opener);
  dialog.setAttribute('aria-labelledby', 'forget-title');
  let pending = false;
  dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  dialog.querySelector('[data-confirm]').onclick = async () => {
    if (pending) return; pending = true; dialog.querySelectorAll('button').forEach(button => button.disabled = true);
    try { await catalogRequest(`/api/projects/${id}`, { method: 'DELETE', body: '{}' }); dialog.close(); await refresh(); }
    catch (error) { dialog.querySelector('.workspace-error').textContent = error.message; }
    finally { pending = false; dialog.querySelectorAll('button').forEach(button => button.disabled = false); }
  };
}
function projectForm(create) {
  const dialog = modal('project-form-dialog', `<form id="project-form"><h2 id="project-form-title">${create ? 'Create a product project' : 'Open a project folder'}</h2>${create ? `<label>Project name<input id="project-name-input" required maxlength="120" placeholder="Fragrance Rotation"></label><label>Description<textarea id="project-description" maxlength="2000" rows="3" placeholder="What problem does this product solve?"></textarea></label><p>A new folder will be created under <code>${escape(managed)}</code>. No existing folder is overwritten.</p>` : '<label>Absolute folder path<input id="project-path" required placeholder="/Users/you/Projects/my-product"></label><p>Enter a path on the machine running Studio. The folder must already contain project.json. Files are registered in place, not imported or copied.</p>'}<p id="project-form-error" class="workspace-error" role="status"></p><footer><button type="button" id="project-form-cancel">Cancel</button><button type="submit" class="button button-primary">${create ? 'Create and open' : 'Open project'}</button></footer></form>`);
  dialog.setAttribute('aria-labelledby', 'project-form-title');
  let pending = false;
  dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
  dialog.querySelector('#project-form-cancel').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = async event => {
    event.preventDefault(); if (pending) return; pending = true;
    dialog.querySelectorAll('button,input,textarea').forEach(element => element.disabled = true);
    try {
      const body = create ? { name: dialog.querySelector('#project-name-input').value, description: dialog.querySelector('#project-description').value } : { path: dialog.querySelector('#project-path').value.trim() };
      const { project } = await catalogRequest(create ? '/api/projects' : '/api/projects/open', { method: 'POST', body: JSON.stringify(body) });
      goTo(`/project/${project.id}/`);
    } catch (error) { dialog.querySelector('#project-form-error').textContent = error.message; }
    finally { pending = false; dialog.querySelectorAll('button,input,textarea').forEach(element => element.disabled = false); }
  };
}
$('new-project').onclick = () => projectForm(true);
$('open-project').onclick = () => projectForm(false);
$('project-search').oninput = render;
refresh();
