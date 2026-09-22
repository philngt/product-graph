# Learn from draw.io: fewer steps, explicit product meaning

Reference review: 2026-09-22. Product Graph base: `74e6d3f352209511e8481dad24646f5f7bea92d6`. This change adapts interaction ideas, not a drawing engine. It imports no draw.io code, icon sets, stencils, fonts, XML model, assets or dependencies.

## Observations and adaptation

| draw.io interaction | Product Graph implementation in this slice | Semantic boundary |
| --- | --- | --- |
| Quick shape picker on an empty-canvas double click | Open a product-object picker; position the new card at that point unless occupied. | Choose Feature, Object, Flow, Step, Rule, Screen, Module, Plan, Constraint, Decision or Acceptance explicitly. No inferred ontology from a geometric shape. |
| Add-and-connect beside a shape | A visible keyboard-accessible ＋ beside the selected object; equivalent **Add related** toolbar action. | Choose the relationship meaning and direction before creating anything. It does not clone metadata or invent execution order. |
| Connect objects with direct editor actions | **Connect existing** searches by title/type/ID across the current project; preview and reverse the intended relationship. | Reuse the existing ID, including outside the current focus; no copied object or automatic refocus. |
| Fast label editing and shortcuts | **Rename**, canvas **F2**, focused-canvas shortcuts and an always discoverable **Canvas help** button. | Rename preserves identity, metadata and relationships. Native input Undo and typing stay native. |
| Visible context-sensitive toolbar | Add, Add related, Connect existing and Rename are available next to the working canvas. | Selection-dependent actions disable when no object is selected or the host is busy. |

Primary references: [quick-add shapes](https://www.drawio.com/docs/manual/shapes/quick-add-shapes/), [connect shapes](https://www.drawio.com/docs/manual/connectors/connect-shapes/), [shortcuts](https://www.drawio.com/docs/reference/shortcuts/), [editor toolbars](https://www.drawio.com/docs/manual/editor/toolbars/). The source's [shape picker entry point](https://github.com/jgraph/drawio/blob/744cb5420fdf126efd7a09b1d7082ca3e12c0841/src/main/webapp/js/grapheditor/EditorUi.js) was located during review; this is not a full engine audit or a live draw.io run. Repository [README and asset terms](https://github.com/jgraph/drawio/blob/dev/README.md) are reference material only. No affiliation is implied.

## Working flows

**New object:** Add object (or the existing sidebar Add button, empty-state action, or double-click empty canvas) → choose its meaning → give it a name → Create. Stable IDs are generated independently from names, so identical display names do not collide.

**Add related:** select an object → ＋ or Add related → choose object meaning → name → choose relationship and direction → inspect the sentence preview → Create & connect. Within a focus, ordinary Add anchors to a valid focus root. A missing root never silently becomes project-wide creation.

**Reuse:** select an object → Connect existing → search this project → choose the actual destination → choose meaning/direction → Create relationship. Exact duplicates, missing endpoints and accidental self-links are refused. Existing self-links remain intact and can still be inspected outside this simplified composer. Custom relationship names are available; their metadata is not permission to execute code.

**Rename:** select → Rename or F2 → edit name → Update. An unchanged name produces no edit. A name changed underneath an open rename is not overwritten without review.

All mutations use the existing `app.js` commit/snapshot/dirty/save path. Create, its optional relationship and its new layout position form one graph Undo entry. Undo/Redo remain independent from focus Back/Forward. There is no second server/client graph, new endpoint, persisted schema, auto-save or agent approval bypass. These are direct human working-copy edits, like the existing inspector; proposal-based agent review is unchanged.

## Visibility, drafts and geometry

The create form exposes **Show the result in this focus**. When checked, it switches to Overview, clears search and increases neighborhood depth only as needed, capped at eight; it preserves root IDs rather than automatically opening All models. When unchecked, lens/search/depth remain, and hidden-selection notices still explain what is not visible. A related object outside the reachable focus can remain hidden and be inspected or explicitly focused afterwards.

New positions avoid existing card positions with a bounded simple placement pass. Existing positions/pins are not moved; coordinates are presentation, not semantic ownership. New layout is saved under the resulting scope/lens and participates in the same Undo. This is not obstacle-free routing, snapping, global alignment or layout optimization.

An unapplied inspector draft blocks quick editing and is preserved. Unfinished quick forms prompt before discard and guard page unload. Cancel without applying does not dirty product data. Save failures retain working changes. Blocking/busy guards use the host's current state; endpoints are validated again against the current graph before making a candidate. Input text is escaped, not interpreted as HTML. No new API security guarantees are asserted by frontend validation.

## Keyboard and accessibility

From the focused model canvas: **N** adds, **Shift+N** adds related, **C** connects, **F2** renames, **F** fits, **?** opens help, and **Ctrl/Command+S** uses ordinary model Save. Commands ignore composing text, repeats, unrelated modifiers, input/textarea/select/contenteditable and open dialogs. Every gesture has a visible button equivalent. Dialog labels, native select/radio controls, live relationship preview/error text, Escape handling and focus restoration are included.

The ＋ handle is a separate SVG button, not a nested node action; its pointer/key events do not begin a graph drag. Blank-canvas double clicks are checked against visible node bounds because host selection can redraw SVG between clicks.

## Verification

```sh
npm run test:quick-edit
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:quick-edit:browser
# Existing full-UI fixture regression has been adapted to the new create form:
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:studio:browser
```

Pure tests cover candidate construction, identity, no implicit edges, duplicate/missing references, unchanged/stale rename, bounded search and presentation placement. New browser tests execute the actual `app.js`, quick-edit modules, navigation/geometry and project client; **page/appearance/Sketch/Documents/project-session integrations and API responses are explicit fixtures** in a small shell. This checks the real commit/Undo/Save bridge, not just a mocked callback, but is still not the complete production UI or real disk/network integration. Screenshots are labelled as test-host evidence. Browser tests skip without `PRODUCT_GRAPH_BROWSER`.

Before release, run the full UI fixture suite and ordinary local multi-project Studio. In particular check interaction with Sketch/Targets dialogs, real backend revision conflicts, short-window scrolling, keyboard/screen-reader behavior and pointer double clicks. No measured task-time improvement, full accessibility audit, mobile/OS verification or full repository test rerun is claimed by these focused checks.

## Deliberate next slices

Multi-selection, marquee, group move/align/distribute, drag-to-connect ports, snapping/guides, minimap, persistent tool preferences and a command palette are useful candidates, not implemented here. Each must preserve view/model identity, draft recovery and typed meaning. A giant symbol library, imported XML as a second product model, or automatic connection from visual proximity is not the goal.

[Studio interaction contract](semantic-model-studio.md) · [Current workflows](user-flows.md) · [Verification boundaries](verification.md)
