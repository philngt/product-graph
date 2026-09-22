# Paper Studio: mockup-inspired presentation, existing semantic model

## Scope

This slice adopts selected ideas from `philngt/design-studio-ai` rather than
replacing Product Graph with that repository. The earlier cream-paper mockups
supply the visual direction; the merged focus-first Studio remains the authoring
model. See `THIRD_PARTY_NOTICES.md` for source revision and MIT attribution.

### Screens

- **Overview**: actual working-graph object/relationship/document counts, linked
  intent, configured focus areas, region inventory, locally changed/added objects,
  and the last saved diagnostics. No invented health percentage, product analytics,
  owner, release date or readiness claim.
- **Model**: existing selection/focus/lens/undo/proposal behavior inside a paper
  shell. Serif headings, quiet grid, semantic-colored accents, details disclosure
  and compact supporting drawer. Stable IDs/type/JSON stay editable under an
  expandable inspector section.
- **Library**: search and type filters over the project library returned by the
  existing API. Read-only definition dialog shows exact JSON and returns focus to
  its opener. Drawer preview also opens the definition, replacing the former
  toast-only placeholder. Decorative card glyphs are not generated previews of
  the definitions. Automatic pattern instantiation is explicitly unavailable.
- **Target**: inspection of whole-graph counts and available template metadata.
  The SwiftUI stage is visibly unsupported and Generate is disabled. This is not
  a compilation preview, compiler, or Xcode integration.

Pages and appearance do not edit the graph. Inspector drafts survive page
switches. Sidebar focus and All models return to the editable Model surface.
Page tabs are session-local and separate from model focus Back/Forward; browser
URL persistence is not introduced here. Appearance can be Paper, Dark or System;
only this preference uses optional localStorage. No remote fonts are required.

## Canvas

`ui/canvas-layout.js` works on the selected projection, not an upstream Board.
Workflow/Architecture default to directed breadth-first columns. Other lenses use
a stable three-column overview; none force a radial focus layout. Cycles and
missing edge endpoints do not hang arrangement. This is not a causal dependency
analysis, topological verification, tree conversion or a Dagre port.

Stored per-scope/per-lens positions take precedence during rendering. Arrange
changes only visible, unpinned positions, preserving pins and entries hidden by a
lens/search. Layout changes use existing undo/redo and layout persistence. Unpin
makes the selected position eligible for a later arrangement. Presentation IDs
never replace stable graph IDs.

Connectors attach to card borders and display relationship labels. Curves,
self-loops and parallel lanes are supported, but the implementation does **not**
promise obstacle-free routing, label collision avoidance, or large-graph
performance. Existing/overlapping pins are intentionally not repositioned.

Zoom, Fit and background pan update only the view camera. Dragging a node retains
the initial pointer offset and pins its position; a click is not a layout edit.
Fit includes negative and distant coordinates. The camera refits after the
visible node set changes, and explicit Fit remains available. Camera state is
not persisted in project files.

## Verification

```sh
npm run test:studio:layout
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:studio:browser

# Optional PNG evidence, with in-memory fixture data:
PRODUCT_GRAPH_BROWSER=/path/to/chromium \
PRODUCT_GRAPH_SCREENSHOTS=/tmp/product-graph-evidence \
  npm run test:studio:browser
```

`tests/helpers/studio-browser.mjs` inlines the actual local UI module graph and
styles into Chromium; only network API responses are fixtures. The existing
35-case authoring smoke scenario remains. Additional browser checks cover all
four screens, two desktop widths, drafts, keyboard navigation, escaped library
text, pin/arrange/undo, camera-only changes and whole-graph save payloads.
Pure tests cover deterministic geometry, cycles, invalid coordinates and pins.

These tests do not verify the real server, disk persistence, MCP, external
providers, native macOS, Xcode, or SwiftUI output. Run the full repository test
suite and the real-workspace checklist in `semantic-model-studio.md` before a
release. Browser tests skip when PRODUCT_GRAPH_BROWSER is not configured.

## Deliberate follow-ups

Revision-checked/atomic saves, typed authoring dialogs in place of browser
prompts, source-document rendering, Design Strategy graph projections,
versioned pattern instances, target manifests and a real SwiftUI compiler
remain independent follow-ups. None is implied by the new visual shell.

No backend endpoint, canonical schema, dependency, lockfile, account requirement,
or cloud service is introduced by this PR.
