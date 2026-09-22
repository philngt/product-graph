# Product Graph

A local visual workspace where **humans and agents define shared product meaning** through objects, flows, rules and experience. One technology-neutral product model can have several implementation targets. Templates supply repeated mechanisms; bindings and custom extensions retain what is specific to each product.

**Tự do khi suy nghĩ. Có cấu trúc khi định nghĩa. Có kiểm chứng khi triển khai.**

Swift/SwiftUI is one possible target, not the product's platform boundary. A mobile interface, web interface, backend, worker or CLI can reference the same graph. Entering a technology name does not install a generator. **No application generator is registered yet.**

Read the [product thesis](docs/product-thesis.md), [authoring contract](docs/visual-authoring.md) and [implementation-target contract](docs/implementation-targets.md) for working capabilities and explicit limits.

## Start a workspace

Node.js 22+ is required.

```sh
npm run workspace
# Or choose a catalog directory and port:
npm run workspace -- /absolute/path/to/catalog 4173
```

Projects home creates local projects, opens existing Product Graph folders in place and remembers recent locations. Each project opens at its own `/project/:id/` URL on one local server. **Projects** in Studio handles Save, Discard or Cancel before switching. Removing a catalog entry never deletes the project folder. No account, hosted service or shared global active-project state is required.

Legacy single-project and CLI entry points remain:

```sh
npm run framework -- init ./my-project
npm run framework -- validate ./my-project
npm run framework -- project ./my-project
npm run framework -- context ./my-project
npm run framework -- check ./my-project
npm run framework -- serve ./my-project 4173
npm run framework -- mcp ./my-project
```

## Sketch → define → review → hand off

Open **Project tools → Sketch & define**. Capture text notes, questions and assumptions; arrange cards and connect untyped arrows. Save the sketch, select cards, and explicitly choose object kinds or reuse existing objects. Questions and assumptions require acknowledgement. Choose the meaning of each relationship, create a pending proposal, inspect its exact commands and source snapshot, then review/apply. Original notes remain; new objects start as drafts, not verified facts.

**Context for agent** builds a read-only task artifact from explicit roots, required project constraints, linked Markdown and optional unconfirmed notes. Inspect inclusion/exclusion reasons, gaps, character-budget accounting and source/build hashes before exporting JSON or Markdown. Input/output/custom references remain inert declarations.

```sh
npm run context:task -- /path/to/project feature:rotation "Define cooldown behavior" json
```

This task artifact is distinct from the legacy `framework context` graph summary. No built-in provider or agent runner is required. The new target-specific path below composes the same task builder; it does not invent another product-source selection algorithm.

## One product → multiple targets

Open **Targets** in page navigation. Add a target with an explicit role and environment, then optionally language, framework, storage, template pin and bindings. Nothing defaults to SwiftUI. Save host model/inspector drafts before configuring targets.

A binding connects an existing product object to a declared template slot, a custom reference, or an explicitly deferred implementation. Reuse the same object IDs across mobile, web and backend. Template compatibility checks role/environment/language/framework and slot/node-type declarations; it does not prove runtime support. Old/unversioned template metadata stays inspectable but is not advertised as a generator.

Templates are pinned by ID, version and definition hash. Missing/modified/incompatible templates and dangling model references remain visible for review. Saving fails on a stale model/template/config snapshot and retains the UI draft. Removing a target only removes configuration; graph nodes, custom code and templates are never deleted by that action.

Use **Build target context** to add only the selected target's deployment choices, pinned metadata and relevant bindings to a saved-source task handoff. No platform is needed for product-only tasks.

```sh
npm run context:target -- /path/to/project web feature:rotation "Implement web recommendation" json
npm run context:target -- /path/to/project api feature:rotation "Implement server validation" markdown
```

The CLI writes to stdout only. The new artifact is `productgraph.implementation-context.v1`; old context/MCP contracts are unchanged. A target can have one optional foundation template in this slice. Multi-module composition, automatic pattern instantiation, runtime execution and source generation remain follow-ups.

## One owner for each source

```text
project.json                 Product identity
 graph/nodes/                Semantic product objects
 graph/edges/                Typed product relationships
 graph/documents/            Document records and graph links
 documents/                  Long-form Markdown sources
 sketches/board.json         Exploratory notes and visual links
 implementation/targets.json Target choices, template pins and bindings
 layout/                     Presentation data
 projections/                Generated views, when explicitly requested
 agent-context/              Generated context and reviewable proposals
```

JSON under `graph/` is canonical for product structure; implementation configuration references it rather than copying it. Markdown remains source knowledge. Generated context is not another source of product truth. Studio Save validates and saves the graph; it does not automatically regenerate Markdown projections/context. Use the CLI `project` and `context` commands explicitly.

**Documents** reads source Markdown and generated context, with outline, local links, backlinks and linked product objects. It is read-only: no rich-text normalization, HTML execution, remote media fetching or implicit semantic edge creation. See [multi-project boundaries](docs/multi-project-workspace.md) and [Hibi research](docs/hibi-document-management.md).

## Focused authoring and shared context

Select an object to inspect without changing focus. **Focus here** works on its neighborhood; **Isolate** shows it alone; **All models** widens the scope and preserves the lens. Back/Forward restore scope, lens, selection and search without undoing product edits. Scope counters explain what is hidden; Save writes the entire working graph, not just the visible projection.

Product, Business, Workflow, Domain, Experience and Architecture are views of the same graph. Decision and Quality support rationale and verification. A graph arrow is not automatically executable control/data flow. The lower drawer keeps Context, Compare, Proposals, Library and tours available on demand. See [Studio interaction contract](docs/semantic-model-studio.md).

`framework mcp` starts a project-specific stdio MCP server. Agents can search, request bounded graph context, validate, compare and create reviewable proposals. The MCP surface cannot directly Apply a proposal: human review remains in Studio. These interface boundaries are not a sandbox for clients independently authorized to write files.

Useful legacy context commands:

```sh
npm run framework -- context ./my-project --scope=focus:rotation
npm run framework -- context ./my-project --root=product:graph-workspace --depth=3
```

## API surfaces

In workspace mode, project endpoints are prefixed with `/api/projects/:catalogId`. Legacy single-project serve uses `/api`.

```text
GET  /workspace
POST /workspace
GET  /context?rootId=<node>&depth=2
GET  /agent-context?rootId=<node>&depth=3
POST /task-context
GET  /proposals
POST /proposals/:id/preview
POST /proposals/:id/apply
POST /proposals/:id/reject
POST /compare
POST /commands
GET  /documents
GET  /documents/read?path=<relative-path>
GET  /authoring
POST /authoring/board
POST /authoring/proposal
GET  /implementation
POST /implementation
POST /implementation/context
```

Graph, sketch and implementation saves have separate checked revisions and ownership. Individual-file replacement is not a multi-file transaction or a lock shared with arbitrary external editors. This local server is not a hosted multi-user security boundary. Back up source files and reconcile conflicts explicitly.

## Verification

```sh
npm run test:studio
npm run test:workspace
npm run test:authoring
npm run test:targets

PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:studio:browser
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:workspace:browser
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:authoring:browser
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:targets:browser
```

Browser suites have documented fixture/transport boundaries and skip without the relevant browser environment variable. They do not collectively imply ordinary browser-to-server end-to-end, platform, security or generated-code validation. Run the full repository and normal local workflows before release. Generator adapters must eventually provide target-specific code/build/test evidence; schema declarations alone cannot do so.
