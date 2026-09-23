import { OBJECT_CHOICES, nearbyPosition } from './canvas-edit-model.js';
import { CARD, validPosition } from './canvas-layout.js';

/** Presentation search, not a second ontology or a template catalogue. */
export function creationChoices(query = '') {
  const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = normalized(query).trim().split(/\s+/).filter(Boolean);
  return OBJECT_CHOICES.filter(choice => {
    const text = normalized(`${choice.key} ${choice.label} ${choice.help} ${choice.region}`);
    return words.every(word => text.includes(word));
  });
}

/** A preview never mutates the graph, layout, pin flags, selection or history.
 * A node hit chooses a source for the subsequent form, NOT relationship meaning.
 * Blank-space placement in a focus retains the existing explicit-relation contract.
 */
export function creationPlacement({ graph, scope, scopeIds, positions, point, sourceId }) {
  if (!graph || !Array.isArray(graph.nodes)) throw new Error('Open a product before adding building blocks.');
  if (!validPosition(point)) throw new Error('Canvas position is unavailable.');
  const exists = id => graph.nodes.some(node => node.id === id);
  const from = sourceId || (scope.id !== 'project' ? scope.rootIds.find(exists) : undefined);
  if (from && !exists(from)) throw new Error('Source object is missing. Choose an existing object.');
  if (scope.id !== 'project' && (!from || !scopeIds.has(from))) throw new Error('Choose an object in this focus, or open All models before adding.');
  const source = sourceId && positions[sourceId];
  const preferred = validPosition(source) ? { x: source.x + CARD.width + 100, y: source.y } : point;
  return { from, position: nearbyPosition(preferred, positions, CARD) };
}
