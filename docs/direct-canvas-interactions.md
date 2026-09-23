# Direct canvas interaction and contextual editing

This slice makes the existing Model canvas easier to author without typing object IDs into `prompt()`. It builds on the [Semantic Model Studio contract](semantic-model-studio.md), not a second editor/model. No persistence schema, backend API, template, target or execution permission changes.

## Working flow

**Select → Rename / Add related / Connect → Explicit local Apply → Undo/Redo → Save.**

| Intent | Mouse / visible control | Keyboard alternative |
| --- | --- | --- |
| Rename an object | Double-click a card, or Rename in the selected-object toolbar. | Focus a card and press F2. |
| Add a related object | Click its `+` handle or Related object. Choose a type, title and relationship. | Focus a card and press `+` or Insert; Tab/Enter also work on the handles. |
| Add to the current scope | Existing Add to focus button; double-click empty canvas to choose placement. | Use the existing button in tab order. |
| Connect existing objects | Drag `↗` from one card onto another, then explicitly choose meaning. A click opens the name picker. | Focus a card and press C, or use Connect / the existing inspector relationship button. |
| Cancel | Cancel control, Escape; drop a connector outside a destination to abandon it. | Escape. |

The direct canvas editors are **small anchored modal forms** positioned near the object, not a full-screen authoring wizard or in-SVG rich-text editor. They block other authoring while open, preserve native input Undo and do not submit during IME composition. Enter applies locally; Escape discards this editor's text, not product data. A changed open editor triggers the existing kind of browser unload warning. Closing returns focus to the appropriate card or canvas. Native selects are searchable/filterable through the provided name field; stable IDs are secondary labels to disambiguate identical names, never required typed input.

## Meaning and safety

A connector drag is temporary presentation data. It never creates an edge until destination and relationship have been chosen and Apply succeeds. The relation chooser has no implicit default. Common meanings have readable labels; an explicitly entered custom kind remains available. `precedes` describes intended order and **does not execute a workflow**. New relations carry semantic/non-executable metadata; existing edge kinds are not migrated. Self-relations cannot be added by this tool; existing self-relations remain readable.

Creating a related object produces one local graph/layout edit: a new stable identity, a draft object, the explicit edge and its position. Reusing an existing destination never clones that object. Renaming changes only its title; identity, metadata, document references and relationships are retained. No-op rename creates no Undo entry. Empty/oversized/invalid input, missing source/destination, stale title and duplicate relationships are rejected without partial mutation.

In a focus, creation requires an in-scope source. A missing focus root does not silently widen to the whole product. Related creation can expand neighborhood depth, up to the existing maximum of eight, to reveal the new object. It clears the current search but preserves the lens. A different object type may still be hidden by the lens; the existing hidden-selection notice explains this. Positions are saved only for the current scope/lens; another view has its own layout. Existing visible geometry and pin flags are retained during insertion.

Unapplied inspector edits block direct authoring and stay intact; apply or discard that inspector draft first. Local graph edits remain navigable and undoable. Save still submits the **complete working graph and layouts**, not only visible objects. The existing server revision guard remains responsible for stale disk writes; a rejected Save preserves the working copy. Unsaved direct edits still block agent-proposal application.

Pointer cancellation, Escape, window blur and abandoned connector drops remove the preview without creating objects/relations or moving cards. A connector gesture is not a node drag or canvas pan. Selected-card focus is restored after DOM rerender so mouse selection can be followed by keyboard editing.

## Implementation

- `ui/canvas-edit-model.js`: pure validated edit plans, a bounded name search and collision-aware insertion geometry. The choices are a small UI vocabulary, not a second ontology/validator.
- `ui/direct-canvas.js`: toolbar, SVG handles, anchored editors and pointer/keyboard state. It calls the host's edit boundary; it does not save files or invoke an agent.
- `ui/direct-canvas.css`: existing Paper/Dark tokens and responsive forms; no external asset/font dependencies.
- `ui/app.js`: uses the existing working graph, single Undo snapshot, dirty/context invalidation, navigation and Save pipeline. Canvas handles and the selected-object toolbar use the direct controller. Sidebar Add/Connect and the command palette retain the editorial forms from PR #8; both paths use the host working graph and Undo/Save. Old text prompts remain removed.

This is the first usability slice inspired by direct canvas interaction. It does not embed Miro, copy its source/assets, add real-time collaborators/agent presence, or claim compatibility with Miro boards. Documents/Sketch remain their existing tools; shared document cards, frames and on-canvas proposal review are follow-ups. Generation and workflow execution are still absent.

## Verification

```sh
npm run test:canvas:edit
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:canvas:browser
```

Pure tests check identity/source preservation, validation, duplicate guards, explicit relations, search limits and placement. Chromium tests run the **actual `app.js`, graph state, geometry, client, index and editing modules** with in-memory API responses. Unrelated page, Documents, Sketch, project-switching and appearance controllers are replaced by named fixture adapters. Real CDP mouse/keyboard input exercises dragging, cancelling, double-clicking and Enter/Escape at desktop sizes. The tests check full Save payloads and reload from retained fixture data, **not disk persistence or live browser/server integration**. Screenshots visibly label this boundary.

The existing Studio browser regression retains the editorial Add object form instead of mocked prompts, and emits the native click following its synthetic pointer-up. Direct-canvas tests use the selected-object toolbar when testing the anchored forms and check the persistent Save-conflict notice. It remains a separate full-UI fixture suite and needs its ordinary prerequisites. No historical pass count is claimed as a current full-suite result.

Before release, run the full repository tests and ordinary local workspace flows: new/old projects, actual Save/reopen, target/document/sketch coexistence, project switching, browser/OS input differences and accessibility checks. Source tests do not establish a measured usability improvement or platform certification.
