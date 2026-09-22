# Semantic Model Studio: focused authoring slice

## Decision

Use a product object or feature as the entry point, an editable graph as the work surface, and semantic lenses as projections. Keep **All models** for project-wide structural work. These are scopes of the same editor, not separate products or separate sources of truth.

This slice extends the existing Node/TypeScript browser Studio. It does not migrate the workspace to native macOS, change the canonical JSON/Markdown file contract, or implement the planned SwiftUI application generator.

## Interaction contract

| Action | Scope | Lens | Selection | Canonical graph |
| --- | --- | --- | --- | --- |
| Select a node | Unchanged | Unchanged | Changes | Unchanged |
| Change lens | Unchanged | Changes | Preserved, even if hidden | Unchanged |
| Focus here | Selected object's neighborhood | Preserved | Selected object | Unchanged |
| Isolate | Selected object, depth zero | Overview, to show the object | Selected object | Unchanged |
| Expand +1 | Same roots, one more hop (maximum 8) | Preserved | Preserved | Unchanged |
| All models | Entire project | Preserved | Preserved | Unchanged |
| Decisions tool | Entire project | Decisions | Preserved | Unchanged |
| Back / Forward | Restored | Restored | Restored | Unchanged |
| Apply object edits | Unchanged | Unchanged | Preserved | Updates local working copy |
| Save | Unchanged | Unchanged | Preserved | Saves the whole working graph |

Back/Forward restore scope, lens, selection and search together. Plain selection and typing in search do not add navigation entries. The current values are captured when leaving the location. Navigation history and model undo/redo are independent; navigating never reverts an edit. History is session-local, bounded to 100 entries, and does not persist across reloads.

A focus is semantic, not geometric: selecting an object does not force a radial layout. Existing layout pins remain keyed by scope and lens. Isolating an object uses its own named object scope instead of overwriting a configured focus area.

## Visibility is not deletion

The scope summary reports visible objects, objects hidden by lens/search, and relationships crossing the scope boundary. The selected object may stay in the inspector even when the canvas hides it. Explicit notices distinguish outside-scope, hidden-by-lens and hidden-by-search cases.

A missing or deleted root yields an empty focus with a recovery action, not a silent fallback to the entire graph. All models and Back remain available. Scope traversal is an undirected, bounded neighborhood. `Related impact` is an exploration aid, **not** proof of causal or complete implementation impact.

The projection never becomes the save payload. Saving from an isolated one-node view still saves the complete canonical working graph and existing layout data.

## Authoring safety

- Unapplied inspector input survives lens switches, search, drawer actions and async context responses. Moving to a different selected object asks before discarding an unapplied draft.
- Apply changes moves the draft into the local graph; Save persists the graph. Save asks users to apply pending object edits first.
- New objects in a focus require an explicit user-selected relationship from a valid focus root. Creation and relationship creation are one undoable edit. A depth-zero focus expands to reveal the newly linked object.
- Clicking a canvas node is not a layout edit. Dragging must cross a movement threshold; pointer cancellation restores the previous layout.
- Undo shortcuts in inputs and textareas remain native text-editing shortcuts.
- Proposal application is blocked while local model/layout changes or an unapplied draft exist. Saving/applying disables authoring until the response completes. Successful proposal application clears obsolete model undo snapshots.
- Leaving the page with unsaved changes or an unapplied draft triggers the browser's unsaved-changes warning.

Context requests use a sequence token: a late response for object A cannot replace the inspector context for B. The existing context API reads saved files, so unsaved model changes invalidate those cards and explicitly ask the user to save before refreshing. Saved validation is labeled as such; no percentage-based readiness claims are introduced.

The supporting drawer starts collapsed. Context, Compare, Agent proposals, Library and Guided tour remain accessible on demand. A late Compare response cannot overwrite another drawer.

## Code map

- `ui/studio-state.js`: DOM-independent navigation snapshots, history transitions, bounded traversal and visibility-aware projections.
- `ui/app.js`: authoring, navigation bindings, inspector lifecycle, async guards and existing workspace APIs.
- `ui/index.html` / `ui/studio.css`: scope status, recovery controls, hidden-selection notices and drawer disclosure. Existing `styles.css` remains unchanged.
- `tests/studio.test.mjs`: pure navigation and projection regression tests.
- `tests/studio-browser.test.mjs`: optional real Chromium smoke test, using actual UI modules with in-memory API fixtures. No additional npm package is required; Node's built-in WebSocket connects to Chromium's debugging interface.

## Verification

```sh
npm run test:studio

# Set the path to an installed Chromium/Chrome executable.
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:studio:browser

# Existing framework tests plus Studio tests.
npm test
```

The optional browser test is skipped when `PRODUCT_GRAPH_BROWSER` is unset. On macOS, an example executable is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` if Chrome is installed; quote paths containing spaces. Browser fixtures do not test disk persistence, MCP, proposal validation in the server, the full CLI, or SwiftUI compilation.

Manual acceptance on a real workspace:

1. Open a feature, select a rule, change lenses, then move to All models. Back/Forward must restore the earlier focus/lens/search/selection without losing applied edits.
2. Type in the inspector without applying. Change lens and wait for context. The input must remain. Cancel the discard prompt when choosing another object.
3. Isolate an object, expand, and go Back. A simple click must not enable Undo or mark the model dirty.
4. Add a linked object, undo and redo. Save from an isolated view, reopen the project, and verify unrelated nodes and edges remain.
5. Delete the focus root. Confirm that the focus is empty, All models still works, and Undo restores the object.
6. Attempt proposal application while edits are unsaved. Save first, preview the proposal again, and let the server reject stale/invalid proposals normally.

## Deliberate follow-ups

Project-wide impact semantics, transactional/revision-checked persistence, server-side security hardening, domain-specific authoring controls, saved navigation sessions, graph auto-layout, pattern instantiation, and SwiftUI generation remain separate slices. Do not infer those capabilities from the Studio's existing buttons or this navigation work.
