# Editorial Studio: visual design and authoring experience

Status: UI implementation over the existing Studio at source baseline `74e6d3f352209511e8481dad24646f5f7bea92d6`. This is a presentation/interaction slice, not a new backend, generator or product schema. The [thesis](product-thesis.md), [Studio semantics](semantic-model-studio.md) and [target contracts](implementation-targets.md) continue to apply.

## Design direction

Keep the paper Studio's warmth, but reduce the visual weight of frames and repeated toolbars. Cream surfaces, terracotta actions, a restrained sage intent card, system-serif display headings and readable system-sans controls share a semantic token palette. Dark and System appearance remain supported. Local SVG icons replace decorative symbols where the new shell needs an action icon; no external font, image or tracking request is introduced.

The central workspace is for the current product feature, not a generic dashboard. A compact header separates project identity, screens and project-wide search. The sidebar gives focus areas priority, then existing tools. The inspector remains about the selected object. Supporting details remain on demand. Counts are actual working-model inventory and pending-proposal counts, never health scores or proof of verification.

## Updated user flows

### Find an object or action

Use **Find anything** or `Command/Ctrl K`. Search covers objects in the **current project**, even outside the visible scope/lens. Names, IDs, types and regions are searchable; object search folds Vietnamese diacritics. Focus-area and action labels use simple case-insensitive matching. Results are bounded; this is not cross-project search or full-text document retrieval.

Use Up/Down and Enter, or click a result. **Inspect** retains the current focus and respects the host's unapplied-draft guard. **Focus** deliberately changes scope. Actions open existing Overview, Sketch, Documents, Library, Targets or Proposals; there is no pretend agent or generation action. Escape closes the palette and native modal behavior keeps keyboard interaction inside it. Shortcuts do not interfere with composition, another open dialog, or ordinary text undo.

### Define an object without editing JSON

**Add object** opens a form with supported feature/entity/step/rule/screen/constraint/decision/criterion choices, name and optional purpose. When creating inside a focus, explicitly select the relationship from its root; the field starts empty. New nodes are drafts. Unsupported specialized rule/branch logic is not inferred from the name or description.

The form returns a pure creation plan to the existing host mutation/undo path. Node and link are one undoable edit; no disk write occurs until **Save model**. A depth-zero focus expands enough to show the newly linked object; the overview lens is used to reveal it. Cancel/close/escape protects filled form values; validation and duplicate errors stay inline. The advanced inspector remains available for existing types and metadata.

### Connect existing objects

**Add relationship** opens a searchable project-object chooser instead of asking the person to type an ID. Explicitly choose a semantic relationship or name another one. Endpoints must exist and duplicate semantic connections are refused locally. These links are not executable data/control ports. The existing server still performs validation on Save; front-end checks are not a security boundary.

Relationship rows in the inspector show readable neighboring titles. Clicking a title inspects without changing focus and still respects unapplied object drafts.

### Get more canvas space

The canvas-focus button or `Shift F` hides and marks both side panels inert. Escape restores them. This is a session-only presentation mode: no graph changes, layout writes, navigation entries or dirty flag. It is distinct from **Focus here**, **Isolate** and **Expand**, which still use the original scope rules. Opening another screen clears canvas-focus presentation. The `/` shortcut focuses the scoped object filter outside text fields/dialogs.

Node titles use two bounded lines with full text in accessible names and the inspector; this is a character-based label heuristic, not a typography-aware layout engine. Existing card geometry, graph pins and routing are preserved. Arrange is still not obstacle-free routing or causal impact analysis.

### Review and save

**Review changes** compares the working graph with its last loaded/saved baseline. It lists added/changed/removed objects, relationship content, document records and manifest changes, with expandable exact before/after data. It is a read-only local projection, not another source of truth or a replacement for server validation. Id-less edges fall back to their semantic tuple; changing that tuple appears as remove/add. Layout changes are not included and are explicitly described as possibly still needing Save. The HTTP Compare endpoint and agent proposal protocol are unchanged.

Unapplied inspector fields and failed/conflicting Saves now have a persistent notice with a dismiss action. Local edits are retained. Successful Save clears the notice. **Apply object changes** updates the working model; **Save model** persists the whole graph, not the selected projection. Agent proposal review, reviewed hashes, stale checks and external-execution permissions remain unchanged.

### Navigate Overview and Library

Overview prioritizes actual intent, current work and focus cards. Miniature focus previews use up to seven actual related objects and their connections; they are decorative subsets, not complete architecture diagrams. The resume action returns to the existing focus. Sketch/review actions open their real tools.

Library cards and their detail dialog show only supplied structure, capability and trade-off strings. Missing facts are labelled missing rather than invented. Exact source JSON remains available. Reset filters recovers from empty searches. Pattern application and application generation are still unavailable; target editing remains the separate existing Targets module.

## Code ownership

| Module | Responsibility |
| --- | --- |
| `ui/studio-design.css` | Additive token/layout/interaction styling over existing CSS. |
| `ui/studio-icons.js` | Local static SVG vocabulary. |
| `ui/studio-presentation.js` | Read-only search/diff/label helpers and pure explicit mutation plans. |
| `ui/object-dialogs.js` | Native dialog forms, inline errors and form draft lifetime. |
| `ui/studio-experience.js` | Command palette and session-only canvas focus. |
| `ui/app.js` | Original model/undo/save/proposal ownership plus bindings to these UI tools. |
| `ui/studio-pages.js` | Overview and Library projections; keeps existing Targets mounting. |

There is no framework migration, application generator, new account service, dependency or lockfile change. Catalog, Documents, Sketch, Target and proposal protocols are unchanged. This does not redesign the separate Projects home or implement freehand sketching, richer document editing, an inspector layout editor, or agent reasoning inside Studio.

## Verification

```sh
npm run test:design
PRODUCT_GRAPH_BROWSER=/absolute/path/to/chromium npm run test:design:browser
# Optional screenshots of the actual Studio with fixture data:
PRODUCT_GRAPH_BROWSER=/absolute/path/to/chromium PRODUCT_GRAPH_SCREENSHOTS=/tmp/studio-design npm run test:design:browser
```

The pure tests cover search, read-only diff, explicit mutation plans, validation/escaping and label handling. The browser tests load the **actual complete Studio HTML, page coordinator, modules and CSS**, not a replacement Targets/Sketch host. API responses and confirmations are controlled fixtures. Local CSS/module references are embedded as data URLs by the test helper; no browser policy is changed. This is front-end integration, **not ordinary browser-to-server or filesystem integration**.

The updated historical Studio browser test exercises its existing 35 acceptance cases through the new Add form. The new complete-host suite checks layout, palette, draft retention, linked creation, relationship errors, Undo/Redo, conflict feedback, whole-model Save payloads, local review, Overview/Library actions, existing Sketch/Documents/Targets entry points and theme. Tests explicitly skip when the browser environment variable is absent; an unset variable is not a successful browser run.

Before release, use the real local server with two disposable project folders. Exercise project switching with drafts, source/target reloads, native keyboard focus and high zoom, and actual disk conflict/recovery. Check screen-reader behavior and supported OS browsers separately. Screenshot and contrast-token checks are not a full accessibility certification, user study, large-graph benchmark or generated-application verification.
