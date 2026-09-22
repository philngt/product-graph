# Product Graph

A local visual workspace where **humans and agents define shared product meaning** through objects, flows, rules and experience. One technology-neutral product model can have several implementation targets. Templates describe repeated mechanisms; bindings and custom extensions preserve what is specific to a product.

**Tự do khi suy nghĩ. Có cấu trúc khi định nghĩa. Có kiểm chứng khi triển khai.**

**Sản phẩm là trung tâm. Graph giữ ý nghĩa. Template giảm việc lặp lại. Platform là lựa chọn triển khai.**

Swift/SwiftUI is one possible target, not the product's platform boundary. Configuration is not execution: **no application generator or workflow runner is registered at the documented baseline**.

## Documentation

Start with the [project handbook](docs/README.md). It separates current implementation, planned capabilities, product hypotheses and verification evidence.

| Purpose | Documents |
| --- | --- |
| Product direction | [Thesis](docs/product-thesis.md), [product brief](docs/product-brief.md), [roadmap](docs/roadmap.md) |
| System and data | [Architecture](docs/architecture.md), [data model](docs/data-model.md), [architecture decisions](docs/architecture-decisions.md) |
| Workflows | [User flows](docs/user-flows.md), [agent workflow](docs/agent-workflow.md) |
| Contributing | [Development](docs/development.md), [verification](docs/verification.md), [AGENTS.md](AGENTS.md) |
| Detailed contracts | [Studio](docs/semantic-model-studio.md), [workspace/documents](docs/multi-project-workspace.md), [visual authoring](docs/visual-authoring.md), [targets](docs/implementation-targets.md) |

The handbook describes this repository. Source documents for a product opened in Studio live in that product's own `documents/` folder; repository docs are not automatically imported as product requirements.

## Start locally

Node.js 22+ and npm are required. From a full checkout:

```sh
npm ci
npm run workspace
# Optional explicit catalog directory and port:
npm run workspace -- /absolute/path/to/catalog 4173
```

Projects home creates product folders, opens existing ones in place and remembers recent locations. Each Studio opens at `/project/:catalogId/` on the local server. **Projects** handles Save/Discard/Cancel before switching. Removing a catalog entry never deletes its folder. No account or hosted service is required.

For the legacy scaffold and single-project mode, use a new disposable destination:

```sh
npm run framework -- init ../product-graph-demo
npm run framework -- serve ../product-graph-demo 4174
```

See the [development guide](docs/development.md) for explicit project paths, dependencies, recovery and command side effects.

## Main working loops

**Sketch → define → review:** Open **Project tools → Sketch & define**. Capture text notes/questions/assumptions, save the sketch, select cards and explicitly create or reuse product objects. Choose relationship meaning, create a pending proposal, inspect exact commands/source and review Apply/Reject. Source notes remain; new objects begin as drafts. Inputs/outputs/custom references are declarations only.

**Focus → inspect → edit:** select without refocusing; change lenses; use Focus here, Isolate, Expand and All models. Back/Forward does not undo model changes. Save writes the entire working graph, not only the visible canvas.

**Product → targets:** configure zero or multiple implementation targets. Choose role/environment and optional language/framework/storage, one foundation-template pin and bindings. Template/custom/deferred mappings remain declarations; inspect drift and gaps. Removing a target does not delete product objects or custom files.

**Context → agent:** build product-only or target-specific context from saved inputs, review sources/gaps and export JSON/Markdown. No provider call or application build is performed. The UI lens cannot hide mandatory context.

**Documents:** read saved Markdown with outline, local links/backlinks and linked objects. This is a reader, not a rich-text editor or automatic semantic extractor.

[Current flows and failure paths](docs/user-flows.md) · [Exact capability boundaries](docs/README.md#detailed-contracts-and-reference-research)

## CLI, MCP and API

Use IDs that actually exist in the saved product folder; these examples do not create them:

```sh
npm run context:task -- /path/to/project feature:record-usage "Define failure cases" json
npm run context:target -- /path/to/project web feature:record-usage "Implement validation" markdown
npm run framework -- mcp /path/to/project
```

Task/target CLIs write retained output to stdout. Existing MCP tools expose graph summary/search/validation and reviewable proposals, not the newer task/target builders or an Apply tool. See [agent workflow](docs/agent-workflow.md).

The legacy generated-document flow remains explicit:

```sh
npm run framework -- validate /path/to/project
npm run framework -- project /path/to/project
npm run framework -- context /path/to/project
npm run framework -- check /path/to/project
```

Studio Save does not regenerate those files. `check` verifies product diagnostics/derived-output drift, not repository types or application builds. It needs a product folder containing `project.json`.

HTTP endpoints are project-bound under `/api/projects/:catalogId`; legacy serve uses `/api`. The exact routes and revisions are documented in the [workspace](docs/multi-project-workspace.md), [authoring](docs/visual-authoring.md) and [target](docs/implementation-targets.md) contracts. There is no mutable server-wide active product.

## Data and safety

Graph JSON owns product structure; Markdown owns source text; `sketches/board.json` owns exploratory notes; `implementation/targets.json` owns deployment choices; layout is presentation; context/projections are derived. [Data model and revision boundaries](docs/data-model.md).

Graph, sketch and target saves are separate. Per-file replacement and cooperating locks are not project-wide transactions, crash recovery, external-editor locking or hosted authorization. Back up source files, preserve drafts on conflicts and review private content before exporting. A context permission flag is not a sandbox.

## Verification

```sh
npm test
npm run test:studio
npm run test:studio:layout
npm run test:workspace
npm run test:authoring
npm run test:targets
```

Browser/live commands and environment variables are in the [verification guide](docs/verification.md). Some tests use fixture hosts or test-only transports and skip without a browser. Do not infer complete Studio/server, OS, security, agent-output or generated-application verification from partial suites or an empty CI list.

## Next work

The [roadmap](docs/roadmap.md) prioritizes integration/recovery, feature-level no-code authoring and one tested implementation adapter. Rich document editing, module/template composition, workflow execution, freehand understanding and cloud collaboration are not shipped capabilities. Existing source attribution is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
