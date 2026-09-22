export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export async function catalogRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Workspace request failed');
  return data;
}
export function workspaceStyle() {
  if (document.querySelector('link[data-workspace-style]')) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/projects.css'; link.dataset.workspaceStyle = ''; document.head.append(link);
}
export function modal(id, markup, opener = document.activeElement) {
  const dialog = document.createElement('dialog');
  dialog.id = id; dialog.className = 'workspace-dialog'; dialog.innerHTML = markup;
  document.body.append(dialog);
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; dialog.remove(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  const nativeClose = dialog.close.bind(dialog);
  dialog.close = value => { nativeClose(value); dispose(); };
  dialog.addEventListener('close', dispose);
  dialog.showModal();
  return dialog;
}

export function goTo(href) { location.assign(href); }
