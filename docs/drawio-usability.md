# Draw.io-inspired authoring: one editor contract, explicit meaning

This update reconciles PR #7 (`ef236f0`) with the newer main (`c3c353c`). The newer editorial Studio, command palette, direct connector gestures, project/target handling and proposal review are retained. The old `quick-edit` controller is superseded, not mounted alongside `direct-canvas`: two independent editing controllers would give the same gesture different semantics.

## Working changes

- One pure authoring contract (`ui/authoring-model.js`) supplies object vocabulary, title/relation validation, identity checks and creation plans to both the editorial forms and direct canvas. Existing import entry points stay compatible.
- Vocabulary includes workflow, service/module and business plan along with feature, entity, step, rule, screen, constraint, decision and acceptance. A shape or lens never supplies an implicit relationship.
- Add object is accessible without a selection. N adds to the current scope; Shift+N/+/Insert adds related to the focused object. Help is visible and keyboard-accessible. Main's F2/C/command palette/focus mode remain.
- Drag a connection onto an existing object to reuse it; drag onto empty canvas to choose a new object and an explicit relationship. Opening that form changes nothing. Apply creates node + edge through the existing single Undo boundary. Drops outside the canvas or Escape cancel.
- Visible connectors have labelled keyboard-accessible hit targets. Click/Enter opens an anchored relationship editor. Changing meaning/destination preserves edge ID and metadata. Delete requires confirmation, removes only the edge and remains undoable.
- Editors are tied to the complete observed edge content, not just its ID. Changed or ambiguous source records are refused. Legacy anonymous edges can be edited by an observed index/content reference; a reorder is not silently guessed. Existing self-relations stay readable/editable; new accidental self-relations are blocked consistently in both creation paths.
- Closing a changed direct editor asks before discarding input. Inspector drafts, IME composition, invalid inputs, duplicate connections and busy operations retain their existing safety boundaries.

Product context, targets, persistence schemas, agent approvals and implementation ownership are unchanged. No workflow or application generator is added. Custom labels/references are data, not executable instructions.

## Reconciliation choices

The main `ui/app.js`, editorial object dialogs and full Studio styles are preserved, rather than taking the older PR #7 versions. The obsolete `ui/quick-edit.*`, `ui/quick-edit-model.js` and their isolated test harnesses are removed during reconciliation; the new shared-model and direct-gesture tests replace that path. Original historical commits remain in the merge ancestry; no force push or main merge is necessary to update the existing PR.

Main's Add Object form and canvas remain two presentations of the same authoring contract. There is one data/validation owner, not necessarily one identical form for every task. Main's existing creation policy (clear search/limited depth reveal while preserving the current lens on direct insertion) is kept. The old optional reveal checkbox is not carried over as a competing navigation policy. Full main navigation, Targets, Documents, Sketch and proposal review are not reverted.

The existing direct-canvas browser test's blank-drop expectation is updated: a blank drop now opens a form, and cancelling it preserves the original model. Other scenarios are retained, not deleted to make a test pass.

## Scope and follow-ups

This is the first reconciliation slice, not the complete draw.io feature list. Stable-camera policy changes, Fit selection, multi-selection, align/distribute, snapping guides, minimap, inline in-SVG text editing, pattern instantiation, draw.io XML import and embedded draw.io are still follow-ups. The current camera/Fit behavior is unchanged. Edge editing is an anchored form, not a new semantic edge inspector or typed workflow-port system.

No draw.io source, assets, icons, fonts or stencils are copied. These interaction ideas were implemented on the current Product Graph graph/Undo pipeline. Source references for the design discussion:

- https://github.com/jgraph/drawio/tree/744cb5420fdf126efd7a09b1d7082ca3e12c0841
- https://www.drawio.com/docs/manual/shapes/quick-add-shapes/
- https://www.drawio.com/docs/manual/connectors/connect-shapes/
- https://www.drawio.com/docs/reference/shortcuts/

See [direct canvas interaction](direct-canvas-interactions.md), [semantic Studio](semantic-model-studio.md) and the [handbook](README.md) for existing boundaries.

## Verification

```sh
npm run test:drawio
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:drawio:browser
npm run test:canvas:edit
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:canvas:browser
```

New pure tests exercise both public creation entry points, vocabulary parity, stale/duplicate identities, edge editing/deletion, source preservation, Unicode and placement. The new Chromium suite loads the actual direct controller, shared planners and unchanged canvas geometry with real CDP mouse/keyboard events. The host commit/Undo/Save callbacks are a clearly labelled fixture; there is no real backend, full Studio page or disk Save in that test.

The reconciliation preserves both original PR and main commits as merge parents. Focused tests do not certify the full Studio/browser-server path, disk persistence, platform behavior or application generation. Run the existing full Studio/browser-server suites before release. GitHub mergeability must be checked after publishing the merge commit; an empty CI list is not a passing check.
