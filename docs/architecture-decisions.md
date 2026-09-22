# Architecture decision register

Status: retrospective documentation of the existing direction at the [baseline](README.md#baseline-and-status), not newly fabricated team approvals. These records explain why the implementation is shaped this way. A future incompatible decision should supersede a record rather than silently rewriting its rationale.

## ADR-001 — Product meaning is technology-neutral

**State:** adopted direction; target declarations implemented.

Objects, flows, rules, experience and business policies belong to the product. Targets declare role/environment/technical choices and reference product IDs. Swift/SwiftUI is one option. This avoids copying a domain model per framework. Trade-off: exact mappings/custom contracts are necessary, and universal generation is not promised. Evidence: [thesis](product-thesis.md), [target implementation](../src/implementation-targets.ts), [compiler contract](../src/compiler.ts).

## ADR-002 — Files own source; indexes and context are derived

**State:** implemented, with persistence limitations.

JSON owns semantic structure and implementation choices; Markdown owns source prose; sketch data owns exploratory notes. Catalog entries only point to folders. This keeps project data inspectable outside Studio. It trades database transactions/indexing for simple file-backed behavior; current saves are not multi-file transactions. Evidence: [data model](data-model.md), [io.ts](../src/io.ts). Revisit storage mechanisms only with measured scale or recovery needs, not to create a second canonical graph.

## ADR-003 — Focus-first Studio, multiple lenses of the same model

**State:** implemented interaction direction.

A feature/object is the entry point; selection inspects, explicit focus changes scope, and a lens changes representation. All models provides global work. This preserves context but can hide objects, so visibility/boundary notices are part of the design. Navigation history must not undo product edits. Evidence: [Studio contract](semantic-model-studio.md), [studio-state.js](../ui/studio-state.js).

## ADR-004 — Sketches require explicit semantic promotion

**State:** implemented for text cards.

Questions may remain questions. Untyped arrows are not control/data flow. Definitions reuse objects or create draft objects through an exact reviewed proposal, preserving source notes. This costs an extra review step but prevents silent promotion of speculation. Freehand interpretation and agent-driven interpretation are not implemented. Evidence: [authoring contract](visual-authoring.md), [visual-authoring.ts](../src/visual-authoring.ts).

## ADR-005 — Context is a retained, explainable build

**State:** task/target artifacts implemented; legacy summary retained.

Product task selection captures linked source text, constraints, trace, gaps and identities. Target context composes that result rather than running a competing source selector. JSON and Markdown share the retained artifact. Compatibility preserves the legacy graph summary instead of silently changing MCP behavior. Trade-offs include several explicit contracts, bounded source selection and approximate character accounting. Evidence: [agent workflow](agent-workflow.md), [implementation-context.ts](../src/implementation-context.ts).

## ADR-006 — Declaration, execution and approval are separate

**State:** explicit direction; no execution engine.

A template pin or custom reference does not enable a generator. Model approval is not code approval or permission to run/publish. No agent/provider, credentials or n8n runtime is embedded. This avoids false success and unintended side effects but leaves application delivery outside Studio until a tested adapter exists. UI permission flags are not a sandbox. Evidence: [target contract](implementation-targets.md), [MCP tool surface](../src/mcp.ts).

## ADR-007 — Local modular host and per-project request binding

**State:** implemented.

Use the existing browser/Node.js host and shared modules for HTTP, CLI and MCP, not a new service per capability. Bind Studio clients and HTTP routes to a catalog ID resolved per request. This keeps deployment small and avoids a server-global active project. Trade-offs: synchronous filesystem work, reload-based switching and no hosted tenant ACL. Evidence: [architecture](architecture.md), [workspace-server.ts](../src/workspace-server.ts), [project-client.js](../ui/project-client.js).

## ADR-008 — Saves have explicit, separate revision domains

**State:** implemented with known gaps.

Graph/layout, sketch and implementation config have different ownership and checked revisions. A read-only context request must not bless an old graph draft with a new write token. Conflict preserves the draft for reconciliation. This prevents many stale writes but is not crash rollback or a global lock; some legacy helpers have weaker checks. Evidence: [revision table](data-model.md#identity-and-revision-boundaries), [server.ts](../src/server.ts), [io.ts](../src/io.ts).

## New records

Add an ID, status, context, alternatives, decision, consequences, source/verification links and supersedes/revisit conditions. Mark an unimplemented choice Proposed, not Accepted-as-built. Open choices currently include the first generator target, commercial model, rich document editor and stronger persistence; see [roadmap](roadmap.md).
