# Visual creation library and drag-to-create

Status: implemented UI slice over `main` source baseline `9a3956ff89d956d4b1f805f764dbdc96be974afc`, 2026-09-23. This extends [direct canvas authoring](direct-canvas-interactions.md), not the product schema or execution engine.

## Intent and visual hierarchy

Make creation discoverable without turning Studio into another diagramming workspace. **Building blocks** is a visible toolbar entry. Its collapsible library has icons, plain-language descriptions, search, six common types and five additional types. It reads the existing eleven canonical `OBJECT_CHOICES`; these are product concepts, not generated UI components or executable templates.

The library uses the existing Paper/Dark tokens and no external assets, fonts or dependencies. The temporary dashed card, highlighted source and status strip distinguish placement from accepted product meaning. Only the creation form receives the new visual hierarchy; existing rename and connector editors remain available.

## Creation flows

| Intent | Interaction | Result before confirmation |
| --- | --- | --- |
| Place a new concept | Open Building blocks, drag a type onto empty canvas. | Collision-aware card preview; then a form with that type selected. |
| Add related to an object | Drop a type on a visible object. | Source highlighted; adjacent placement preview; relation picker remains empty. |
| Create without dragging | Click a type, then click a canvas location or object. | The same form and validation as dragging. |
| Use the keyboard | Focus a type and activate it; press Enter on the canvas or activate Place in center. | The same form at a collision-aware center position. |
| Abandon placement | Escape, visible Cancel, outside drop, pointer cancellation/capture loss or window blur. | No object, edge, layout change or Undo entry. |
| Finish | Name the object; optionally add a description; explicitly choose relation meaning when required; Create draft. | One local graph/layout edit through the existing host. Save model remains separate. |

In a focused scope, blank placement still uses a valid focus root and requires explicit relationship meaning. It does not create an invisible orphan or silently switch to the whole project. A node drop must reference an in-scope existing source. The existing lens is preserved; a lens can hide a new type. Pan/zoom geometry is resolved through the SVG screen matrix, not CSS offsets.

Preview placement uses the same bounded collision helper as the host. Existing nodes and pin flags stay in place; no auto-layout is run. This is collision avoidance, not snapping/alignment guides or guaranteed routing. Dense layouts can put the new card outside the viewport; existing navigation/fit controls remain the way to reveal it.

## Safety and accessibility contract

Placement is temporary UI state. Only **Create draft** calls the existing validated `performCanvasEdit` boundary. Object plus explicit semantic relationship and position are one Undo step. Nothing here saves files, runs a workflow, generates code, invokes an agent or changes target configuration.

The graph-reference and scope/lens token cancel stale placement. Inspector drafts and busy saves block authoring. Unknown types, missing sources, invalid coordinates and out-of-scope sources do not partially mutate data. Confirmed names/descriptions use the existing validators. Display strings are escaped or assigned through `textContent`. No new product schema, backend route or dependency is introduced.

Dragging is optional: both a single-pointer click path and a keyboard path are present. Cards have accessible labels, visible focus states and text descriptions rather than color-only meaning. Placement feedback is a polite live region. Reduced-motion and forced-colors rules are included. This implements alternatives in the spirit of [WCAG 2.2 dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), not a claim of full accessibility conformance. Native form validation, IME composition and changed-form discard confirmation remain in the direct editor.

## Modules

- `ui/creation-model.js`: canonical-choice search and pure presentation placement plans.
- `ui/creation-shelf.js`: shelf, pointer/click/keyboard state and temporary previews. Delegates creation to the direct editor.
- `ui/creation-shelf.css`: token-based library, preview, status and creation-form styling.
- `ui/direct-canvas.js`: loads the shelf and accepts a preselected type/position; retains existing host edits, Undo and Save boundaries.

The ordinary static asset routes accept these `.js` / `.css` filenames; no server allowlist or API change is needed. This was checked in source, not as a new live-server test.

## Verification and explicit boundary

Run from a normal checkout with Node.js 22+:

```sh
node --test tests/creation-model.test.mjs
PRODUCT_GRAPH_BROWSER=/absolute/path/to/chromium node --test tests/creation-browser.test.mjs
# Optional fixture screenshots:
PRODUCT_GRAPH_BROWSER=/absolute/path/to/chromium \
PRODUCT_GRAPH_CREATION_ARTIFACTS=/tmp/product-graph-creation \
node --test tests/creation-browser.test.mjs
```

The new top-level `*.test.mjs` files are also included by the existing `npm test` glob. Browser tests skip when `PRODUCT_GRAPH_BROWSER` is absent. No package manifest changes are required.

The browser harness renders production creation/direct-canvas modules with an **in-memory fixture host**, real Chromium CDP mouse/keyboard input and a test-only module import map. CSS is injected from the production files. It makes no application HTTP requests and does not change browser policies. The fixture visibly labels this boundary. Its host supplies graph snapshots, Undo/Redo and a fake Save; it is **not** `app.js`, the full page coordinator, real file persistence or project switching. No fixture globals or test transport are added to production code.

Coverage includes exact preview/placement under a changed SVG viewBox; explicit relations; metadata/document preservation; click and keyboard alternatives; search; cancellation; stale scope/model; inspector/save locks; IME and escaped titles; and Paper/Dark layout at 1440x1000, 900x900 and 420x820. Screenshot viewport checks do not certify mobile/Safari support, screen-reader usability or the entire Studio layout.

Before release, run the existing full suite and ordinary local Studio/server flows: real Save/reopen, conflict recovery, project switching, lens-hidden objects, existing connection/node dragging, Sketch/Documents/Targets coexistence and macOS Safari/trackpad interaction. The delivery PR records actual runs and exclusions; do not infer a full-suite pass from this targeted fixture.

## Deliberate next steps, not shipped here

1. Drag an existing object from search to reuse its stable identity, not duplicate it.
2. Multi-object blueprints with a complete pre-apply review and one Undo transaction.
3. Explicit document/sketch linking, followed by alignment guides and edge auto-pan only when interaction tests cover gesture conflicts.

Do not add native file import, automatic semantic connections, freehand interpretation or an execution promise to this slice.
