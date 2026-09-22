# Human-agent collaboration and context contracts

Status: [implemented baseline](README.md#baseline-and-status). Product Graph currently prepares context and reviews model changes; it does not host a model provider, agent orchestrator or application runner.

## Roles and authority

Humans express intent, resolve product ambiguity and review exact model changes. Agents can inspect context and propose changes or implement code through separately authorized tools. A source note is not an instruction that overrides the user/host. A graph approval, a code approval and permission to execute/publish are separate decisions.

The shared context is a versioned model plus selected source material, not only a screenshot or chat transcript. Reuse product IDs and retain provenance; do not turn visual proximity, a backlink or an unconfirmed sketch into an authoritative requirement.

## Three distinct outputs

| Contract | Entry points | Scope |
| --- | --- | --- |
| Legacy `ContextBundle` | `framework context`, `/agent-context`, MCP `get_focus_context` | Graph summary and document references. Not the newer source-body task artifact. |
| `productgraph.task-context.v1` | `context:task`, `POST /task-context`, Sketch tool | Explicit task/roots, required project constraints, linked Markdown, optional unconfirmed sketch, selection trace, gaps and hashes. |
| `productgraph.implementation-context.v1` | `context:target`, `POST /implementation/context`, Targets | Exactly one product-task build plus selected-target configuration, reviewed template metadata and relevant bindings. |

The legacy CLI materializes bundles. Task/target CLIs return JSON or Markdown on stdout; HTTP returns a retained artifact/render without creating an application. Current MCP tools have not been silently upgraded to the two newer contracts. Sources: [context.ts](../src/context.ts), [task-context.ts](../src/task-context.ts), [implementation-context.ts](../src/implementation-context.ts).

## Handoff procedure

Save the appropriate graph/sketch/target inputs first. State the task, explicit roots, exclusions and observable completion criteria. For pure product work no implementation target is required. For implementation work select the target rather than asking an agent to rediscover the stack.

Build once and inspect included/excluded reasons, missing criteria, unresolved questions, source content and template drift. Hashes identify captured content, not truth. Character budgets are UTF-16 source accounting, not tokenizer-measured tokens. Required model content is retained, or an impossible node budget is rejected; excluded source documents produce explicit gaps rather than silent trimming into apparent completeness.

Review sensitive source before export: no secret-redaction engine is present. Context permission flags are descriptive, not an execution sandbox. Keep the build artifact/reference with the work item in the external workflow; automatic run tracking is not implemented.

The agent returns unresolved questions separately from proposed model changes, and reports code/evidence separately from a model proposal. A useful report identifies the context build, product IDs, exact changes, tests actually run, limitations and any proposed decision that needs a human.

## Existing MCP surface

[mcp.ts](../src/mcp.ts) is bound to one project root through stdio. It registers `search_graph`, `get_focus_context`, `validate_graph`, `compare_graph`, `create_proposal`, `list_proposals`, `preview_proposal`, plus context and diagnostics resources.

There is no MCP Apply tool or new task/target build tool at this baseline. `create_proposal` saving an accepted proposal record means the proposal was stored for review, not that its product changes were applied. MCP preview and HTTP review are not interchangeable approval proofs: HTTP sketch Apply has additional source/exact-review checks. Do not assume every legacy entry point has the same runtime-validation strength.

## Proposal review contract

Preview the exact commands, current base revision, affected objects and retained source. Review acknowledgements apply to the content displayed, not merely an ID. For sketch-origin changes, Apply checks graph revision, originating board and the reviewed proposal hash. When stale, preserve source/drafts and generate or review a new proposal instead of overwriting current state.

Model writes should use the existing review path when collaborating in Studio. An agent with independent filesystem permissions can bypass these UI boundaries; those permissions must be managed separately. The [authoring contract](visual-authoring.md) and [server implementation](../src/server.ts) define exact enforcement.

## Future adapters

A future MCP/agent adapter should call the current task builder or target composer, not implement its own competing retrieval pipeline. A contextd integration should use explicit project-to-workspace/pack bindings and remain optional. Provider credentials, retries, command execution, deployment and automatic source promotion need separate contracts and tests.

For repository coding instructions, read [AGENTS.md](../AGENTS.md). For checking context selection versus actual agent outcomes, read [verification](verification.md).
