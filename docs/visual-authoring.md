# Visual authoring and task-context implementation contract

See [the product thesis](product-thesis.md) for the direction. This slice implements **Sketch → Explicit definition → Pending proposal → Human review → Task context** inside the existing browser Studio. It preserves graph, multi-project, document-reader and template boundaries.

## Try it

```sh
npm run workspace
# Open a project, then Project tools → Sketch & define.
```

Capture two cards, connect them, Save sketch, select them and choose Define selection. Choose a kind for each card (or reuse existing objects) and explicitly select the arrow's meaning. Create proposal, inspect the exact change, acknowledge review, and Apply. Use Show in model or the existing lenses to inspect the created draft objects. Context for agent builds a saved-source handoff and exports JSON/Markdown.

Save the host Studio model and any inspector draft before proposing meaning or building context. Sketch saves are separate from graph saves. Close/leave protects uncaptured text and unsaved sketch edits; session-only form choices are not persisted. Reopening starts from the saved sketch. This is a text-card sketch tool, not a freehand drawing editor.

## Storage and identities

- `sketches/board.json`: `productgraph.sketch.v1`, 200 notes maximum, 500 untyped links, 1 MiB serialized maximum. Notes contain ID, kind, exact text, position and optional focus reference. No script execution.
- `sketches/write.lock`: exclusive lock among cooperating sketch writers. A stale lock requires operator investigation; never delete one while a writer may be active.
- `boardRevision`: hash of normalized board, product identity and canonical location. Moving a card also invalidates earlier source-bound proposals (conservative policy).
- `agent-context/proposals/`: existing pending-proposal storage. `authoring` adds original note snapshots, board revision and explicit mappings. Source notes are not removed when a proposal is applied/rejected.
- `graph/nodes/` and `graph/edges/`: only changed through existing reviewed Apply. Created nodes start as `draft`, retain `sketchOrigin`, and may carry an inert `implementationContract`.
- `proposalRevision`: exact stable-content hash of the proposal that was reviewed, in addition to the graph and board revisions.

Reusing an object never overwrites its title/data. Reuse mappings remain in proposal provenance; new nodes also carry source provenance. Deterministic new IDs prevent creating the same note twice within a region. A later definition should reuse the earlier object, not silently rename or duplicate it.

## API routes

Workspace clients use `/api/projects/:catalogId/...`. Legacy single-project serve uses `/api/...`. All routes reuse local Host/Origin, body and project-path guards.

| Method / suffix | Behavior |
| --- | --- |
| `GET /authoring` | Read saved board, board/graph revisions and supported definition vocabulary. |
| `POST /authoring/board` | `{expectedRevision, board}`; checked single-file sketch write; does not save graph. |
| `POST /authoring/proposal` | Explicit mappings and semantic relations; requires current graph/board, validates/preflights candidate, writes pending proposal only. |
| `POST /proposals/:id/preview` | Existing preview plus exact `proposalRevision` and source freshness check. |
| `POST /proposals/:id/apply` | Existing human route; sketch proposals require `X-Product-Graph-Proposal-Revision` matching the reviewed proposal. |
| `POST /task-context` | Read-only context build; explicit task roots; no filesystem output or agent call. |

Existing workspace writes still require `X-Product-Graph-Revision`. Context reads/builds do not advance the browser's observed save token. Applying a sketch proposal checks both its originating board and the exact reviewed proposal hash. The general proposal drawer now previews before a first Apply attempt and exposes exact commands/source JSON. This is not cryptographic human attestation: a privileged API client can provide the same header.

### Definition request

```json
{
  "title": "Define rotation cooldown",
  "expectedBoardRevision": "sha256:...",
  "expectedGraphRevision": "sha256:...",
  "mappings": [
    {"noteId": "a", "existingNodeId": "feature:rotation"},
    {"noteId": "b", "kind": "rule", "title": "Seven-day cooldown", "interpretationConfirmed": true,
     "inputs": "Bottle, UsageRecord[]", "outputs": "Eligibility", "implementationRef": "Features/Rotation/Score.swift"}
  ],
  "relations": [{"from": "b", "to": "a", "kind": "constrains"}]
}
```

The relation endpoints above are **selected sketch IDs**, explicitly mapped to graph IDs. Visual arrows are not copied automatically. Questions/assumptions require explicit interpretation acknowledgement. This does not mark them as verified facts. Unsupported relation kinds, empty/no-op proposals, missing objects, conflicting IDs and stale sources are refused. Inputs/outputs are descriptions, not typed/evaluated port contracts.

## Task-context contract

```json
{
  "task": "Implement cooldown with a no-match outcome",
  "rootIds": ["feature:rotation"],
  "sketchIds": [],
  "depth": 2,
  "maxNodes": 64,
  "maxCharacters": 24000,
  "sections": {"documents/rotation.md": ["Rules", "Acceptance"]}
}
```

The same builder is exposed by a read-only CLI:

```sh
npm run context:task -- /path/to/project feature:rotation "Implement cooldown" json
npm run context:task -- /path/to/project feature:rotation "Implement cooldown" markdown
```

The old `framework context` and existing MCP `get_focus_context` remain the legacy graph-summary contract. They do **not** silently become the new task artifact. No new MCP tool/provider is introduced here; users can export the new artifact for agents already using the existing proposal tools. An adapter must call the same `buildTaskContext()` rather than implement a second selection pipeline.

### Selection and sources

Explicit roots and every `constraint` node (or node with `data.requiredContext === true`) are mandatory. A bounded deterministic neighborhood adds related model objects, independent of the UI lens. Required nodes exceeding `maxNodes` fail instead of being removed. Other omissions and missing acceptance criteria are surfaced as gaps.

Only explicitly linked Markdown source under `documents/` is eligible. Generated projections/context are excluded to avoid recursive self-retrieval. Each eligible file is read once; its raw-byte hash is retained separately from the projected-content hash. Source reading is bounded to 32 candidates, 1 MiB/file and 4 MiB total successfully read source bytes. Source selectors support exact unambiguous ATX heading titles through the small existing Markdown parser, not full CommonMark.

Missing, unsafe, oversized and unsupported sources/sections produce excluded trace entries and gaps. No remote fetch, HTML rendering, secret redaction, arbitrary path expansion or automatic semantic extraction occurs. Review private source text before sending it to an external agent.

`productgraph.task-context.v1` contains task/request, project/graph/source identity, model, explicitly unconfirmed sketch material, source bodies, included/excluded reasons, gaps/warnings, budget and false permission flags. `buildId` hashes the retained result including request and selected payload. JSON and Markdown are rendered from that same result. There is no wall-clock timestamp in build identity; this does not imply an atomic snapshot of concurrently edited files.

Budget is UTF-16 source character accounting, **not measured model tokens**; report/JSON wrapper overhead is excluded. Required model/sketch payload is retained with an over-budget gap. A document that does not fit is omitted with a visible gap, not silently cut. `ready-for-review` means the builder found no defined gaps, not that the design is correct or that implementation is verified. Selection does not constitute permission.

## Code map

- `src/visual-authoring.ts`: runtime-validated sketch source, checked writes and explicit no-code proposal compilation.
- `src/task-context.ts`: source capture, bounded selection, provenance and output rendering.
- `src/task-context-cli.ts`: read-only adapter.
- `ui/visual-authoring.js` / `.css`: scoped Studio tool and three-stage interaction.
- `ui/app.js`: host callbacks and exact proposal review gating; original product state/undo are retained.
- `src/server.ts` / `workspace-server.ts`: project-scoped endpoints, revision/review checks.

## Verification

```sh
npm run test:authoring
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:authoring:browser
# Optional screenshots from the test host:
PRODUCT_GRAPH_BROWSER=/path/to/chromium PRODUCT_GRAPH_SCREENSHOTS=/tmp/authoring-evidence npm run test:authoring:browser
```

The source/HTTP tests use temporary project folders, actual HTTP handlers and filesystem writes. The Chromium tests execute the actual new tool and project client with a lightweight Studio host fixture. A **test-only CDP transport** forwards project API requests to the real Node server; downloads, confirmation responses and host apply callbacks are controlled by the test. This avoids changing managed browser policies, but is not the ordinary browser-network path or a full Studio integration test. Test transport is not used or shipped by the application.

Before release, run the full repository tests, normal local browser/server workflows, actual Studio proposal review/Undo/Save interactions, and platform testing on the supported OS. No coding-agent outcome benchmark, security-audit completion, SwiftUI/Xcode build or automated execution safety is claimed by these tests.

## Deliberate limits

This is a local authoring/handoff tool. It does not add arbitrary code execution, rule evaluation, typed data/control-flow runners, credentials, webhooks, cloud collaboration, freehand/image understanding, pattern instantiation, document editing or a SwiftUI compiler. Single-file replacement and revision checks are not a multi-file transaction, crash-recovery journal or a lock shared with arbitrary external editors. Board/source/proposal changes can require manual reconciliation. Keep source backups.
