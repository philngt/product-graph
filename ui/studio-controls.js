/** Small DOM adaptation of Design Studio AI keyboard-navigation.ts (MIT).
 * Copyright (c) 2026 Best Agent Kits contributors. See THIRD_PARTY_NOTICES.md.
 */
export function navigateChoices(event, selector, vertical = false) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  const previous = vertical ? 'ArrowUp' : 'ArrowLeft', nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
  if (![previous, nextKey, 'Home', 'End'].includes(event.key)) return;
  const buttons = [...event.currentTarget.querySelectorAll(selector)].filter(b => !b.disabled && b.getClientRects().length);
  const index = buttons.indexOf(event.target.closest('button'));
  if (index < 0) return;
  event.preventDefault(); event.stopPropagation();
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === nextKey ? 1 : -1);
  const button = buttons[Math.max(0, Math.min(buttons.length - 1, target))];
  // render() may replace the button. Use a stable data attribute to restore focus afterward.
  const key = button.dataset.lens ?? button.dataset.page;
  button.click();
  const replacement = [...event.currentTarget.querySelectorAll(selector)].find(b => (b.dataset.lens ?? b.dataset.page) === key) || button;
  replacement.focus({ preventScroll: true });
  replacement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function initAppearance() {
  const select = document.getElementById('appearance');
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let choice = 'light';
  try { choice = localStorage.getItem('product-graph:appearance') || 'light'; } catch { /* Optional preference storage. */ }
  if (!['light', 'dark', 'system'].includes(choice)) choice = 'light';
  const apply = () => { document.documentElement.dataset.theme = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice; };
  select.value = choice; apply();
  select.addEventListener('change', () => {
    choice = select.value;
    try { localStorage.setItem('product-graph:appearance', choice); } catch { /* Private/blocked storage stays usable. */ }
    apply();
  });
  system.addEventListener('change', apply);
}
