/** Small, local UI symbols. No remote assets or icon-font dependency. */
const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  graph: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="m11 7-5 9m7-9 5 9M8 19h8"/>',
  decision: '<path d="m12 3 9 9-9 9-9-9Z"/><path d="m8 12 3 3 5-6"/>',
  library: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><path d="m18 4 3 15M5 8h1m6 0h1"/>',
  review: '<path d="M5 4v16M19 4v16M5 8h9m-3-3 3 3-3 3m8 5h-9m3-3-3 3 3 3"/>',
  expand: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/>',
  cursor: '<path d="m5 3 14 10-7 1-3 7-4-18Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  sketch: '<path d="m4 16-1 5 5-1L20 8l-4-4Z"/><path d="m13 7 4 4M16 4l2-2 4 4-2 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  document: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6m-6 4h6"/>',
  link: '<path d="m9 15 6-6m-7 3-2 2a4 4 0 0 0 6 6l2-2m-4-12 2-2a4 4 0 0 1 6 6l-2 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.graph}</svg>`;
}
export function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (el.dataset.iconPainted === el.dataset.icon) return;
    el.innerHTML = icon(el.dataset.icon);
    el.dataset.iconPainted = el.dataset.icon;
  });
}
