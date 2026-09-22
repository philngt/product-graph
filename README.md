# Product Graph

Graph-native workspace for modelling product intent, business rules, workflows, domain, experience and architecture from one canonical product graph.

## Requirements

- Node.js 22+

## Quick start

```sh
npm run framework -- init ./my-project
npm run framework -- validate ./my-project
npm run framework -- project ./my-project
npm run framework -- context ./my-project
npm run framework -- check ./my-project
npm run framework -- serve ./my-project 4173
npm run framework -- mcp ./my-project
```

The canonical input is JSON manifests under `graph/` plus Markdown under `documents/`. Generated artifacts are written as both JSON and Markdown under `projections/`, with the agent bundle under `agent-context/`. Node semantics use typed regions such as `intent`, `product`, `business`, `workflow`, `domain`, `experience`, `architecture`, `decision` and `quality`.

JSON remains the canonical product model. Markdown in `agent-context/` is generated, scoped context for agents; it is not a second source of truth. The Studio validates and saves the canonical graph. Regenerate the Markdown projections and context explicitly with the `project` and `context` CLI commands; saving in Studio does not regenerate those files.

`framework mcp` starts a stdio MCP server. Agents can search the graph, request scoped Markdown context, validate, compare and create reviewable proposals. MCP cannot apply a proposal directly: a human reviews it in Product Graph Studio under `Agent proposals`, then applies or rejects it.

Useful context commands:

```sh
npm run framework -- context ./my-project --scope=focus:rotation
npm run framework -- context ./my-project --root=product:graph-workspace --depth=3
```

Generated context contains stable node IDs, typed relationships, source paths and graph revision. Pending agent proposals live under `agent-context/proposals/` and are separate from canonical `graph/` files.

## Model

The graph has typed nodes, typed edges and document records. Workflow, domain, architecture, document and roadmap are projections over the same graph. Agent context is a filtered, provenance-preserving bundle for a task or agent.

The initial implementation is deliberately stack-agnostic. Integrations should implement the `ProjectAdapter` contract in `src/types.ts` and keep project-specific behavior outside the core graph engine.

`framework serve` opens Product Graph Studio: a browser interface for navigating semantic views, visualizing relationships, focusing a bounded subgraph, dragging/pinning layout, editing nodes, adding relationships, undoing/redoing changes and saving changes back to the canonical graph.

The current workspace exposes six primary projections: Product, Business, Workflow, Domain, Experience and Architecture. Intent, Decision and Quality are available as semantic regions through the inspector and validation surface.

The studio is focus-first. Focus areas live under `focus-areas/`; selecting one keeps the product context while lenses change the representation. The inspector exposes `Why this exists`, `Where used`, `Impact`, source documents and linked decisions. The lower workspace drawer provides context, baseline/current comparison, patterns/templates and guided tours.

Workspace APIs include:

```text
GET  /api/workspace
GET  /api/context?rootId=<node>&depth=2
GET  /api/agent-context?rootId=<node>&depth=3
GET  /api/proposals
POST /api/proposals/:id/preview
POST /api/proposals/:id/apply
POST /api/proposals/:id/reject
POST /api/compare
POST /api/commands
```

## Focused authoring

Select an object to inspect it without changing focus. Use **Focus here** to work on its neighborhood, **Isolate** to show that object alone, and **All models** to widen the scope while keeping the current lens. Back/Forward restore focus, lens, selection and search together; they do not undo product edits.

Scope counters and selection notices explain what a lens or search hides. Hidden objects remain in the canonical graph, and Save always writes the whole working model. Supporting tools stay in a collapsible drawer. Unapplied inspector drafts are preserved across lens changes, and agent proposals cannot overwrite unsaved local edits.

Read the [Semantic Model Studio interaction contract](docs/semantic-model-studio.md) for invariants, acceptance checks and known limits.

```sh
npm run test:studio
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:studio:browser
```

The browser smoke test uses the real UI with in-memory API fixtures; it is not a server/persistence integration test. The existing CLI/MCP tests remain part of `npm test`.

## Multiple projects and documents

```sh
npm run workspace
# Or choose a catalog directory and port:
npm run workspace -- /absolute/path/to/catalog 4173
```

The Projects home creates local projects, opens existing Product Graph folders in place and remembers recent locations. Each project opens at its own `/project/:id/` URL on the same server. Use **Projects** in Studio to switch; unsaved work requires Save, Discard or Cancel. Removing a catalog entry never deletes its folder.

**Documents** reads Markdown source and generated context, with an outline, local links, backlinks and linked product objects. It is read-only: no rich-text editing, HTML execution, file moving or automatic semantic edge creation. Workspace saves use a checked revision; conflicts preserve your local edits for manual reconciliation.

See [multi-project usage and boundaries](docs/multi-project-workspace.md) and [lessons from Hibi](docs/hibi-document-management.md). MCP remains project-specific. This does not add a SwiftUI compiler.

```sh
npm run test:workspace
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:workspace:browser
```
