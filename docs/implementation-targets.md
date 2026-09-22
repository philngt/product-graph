# One product, multiple implementation targets

**Sản phẩm là trung tâm. Graph giữ ý nghĩa. Template giảm việc lặp lại. Platform là lựa chọn triển khai.**

Objects, flows, rules, business policies and intended experience belong to the product. Swift/SwiftUI, a TypeScript web UI, a Java backend or a Python worker are possible implementation choices, not definitions of what Product Graph is. A project can have zero, one or several targets referring to the same product object IDs.

This slice implements target authoring, version/hash-pinned template declarations, per-target bindings, compatibility findings and target-specific agent context. It does **not** install any executable generator. Being able to enter a framework name is not a claim that the platform is supported for automatic code generation.

## Use in Studio

Open **Targets** in the existing page navigation (the internal `build` page key is retained). Add a target, give it a name and role, enter its environment, then optionally language, framework, storage and notes. Nothing defaults to SwiftUI. Configure target bindings only after saving host graph and inspector edits.

Each binding chooses an existing product object and one of:

- `template`: identify a slot in the pinned template's declaration.
- `custom`: store an implementation reference. The file/URL is never opened or executed by this feature.
- `deferred`: explicitly record that the implementation is not decided yet.

A target currently has one optional foundation template and at most one binding per product object. The same object can have a different binding in every target. Module composition, richer field mappings, multi-slot bindings per object and generator ownership enforcement are later capabilities, not hidden behavior of this schema.

The editor displays available slot IDs and accepted node types. Template choice is explicit; definitions are never automatically upgraded. Existing pins remain visible when a file is removed, duplicated, modified or incompatible. Re-selecting a changed definition is an intentional re-pin. A malformed/legacy definition remains metadata, not a compatible generator.

Use **Refresh saved inputs** to re-read model/template changes made outside the page. Saving a stale draft fails and leaves the modal/input intact. Close asks before discarding edited fields; page unload protects an unsaved draft. Modal editing keeps project switching separate. A target is saved separately from the graph: graph Undo/Redo and graph Save do not roll back or overwrite target configuration. Removing a target removes its configuration/bindings only; it never deletes product nodes, templates or custom source files.

## Ownership and persistence

`implementation/targets.json` is canonical only for implementation choices. It is not another product graph. `graph/`, source Markdown, sketch data and layout remain untouched.

```json
{
  "schemaVersion": "productgraph.implementation.v1",
  "projectId": "my-product",
  "targets": [{
    "id": "web",
    "name": "Web application",
    "role": "interface",
    "environment": "browser",
    "language": "TypeScript",
    "framework": "React",
    "storage": "Local store",
    "notes": "Reuse the product's accepted rules.",
    "template": null,
    "bindings": [{
      "nodeId": "feature:record-usage",
      "mode": "custom",
      "slot": "",
      "reference": "src/features/record-usage.ts"
    }]
  }]
}
```

Roles are `interface`, `backend`, `worker`, `cli`, `library`; environment/language/framework/storage are bounded strings. Targets are limited to 32, bindings to 128 per target, serialized configuration to 1 MiB. Unknown configuration fields/schema versions fail instead of being silently removed. Existing projects without the file load an empty target list and remain usable; reading does not create files or auto-migrate old template metadata. Legacy node-level `implementationContract` declarations remain untouched; explicitly author target bindings when separating those choices.

Writes require an observed implementation revision. It binds the normalized configuration, saved graph fingerprint, current template inventory and canonical project location. A cooperating-writer lock plus atomic replacement protects the one configuration file. Reads/context builds never advance the host graph's optimistic save token.

These are not multi-file transactions, crash recovery, authentication, an external-editor lock or hosted multi-tenant isolation. Stale lock cleanup requires operator investigation. Source Markdown is governed by the existing task builder's source hashes, not the implementation save revision. Layout is not part of implementation identity.

## Template declaration contract

Patterns/blueprints describe reusable product structure. Implementation templates describe repeated mechanisms for a target. Knowledge packs guide agent judgment; none is interchangeable with an executable generator.

A project-local file under `templates/` may declare the following **metadata-only** mapping contract. This example is documentation, not a shipped React generator:

```json
{
  "id": "web-catalog",
  "title": "Web collection foundation",
  "version": "1.0.0",
  "implementation": {
    "schemaVersion": "productgraph.template-contract.v1",
    "roles": ["interface"],
    "environments": ["browser"],
    "languages": ["TypeScript"],
    "frameworks": ["React"],
    "slots": [
      { "id": "item", "nodeTypes": ["entity"] },
      { "id": "detail", "nodeTypes": ["screen"] }
    ]
  }
}
```

Roles/environments must be declared; optional language/framework arrays narrow compatibility by exact string match. A pin records `id`, `version`, `definitionHash` (SHA-256 of the bounded decoded UTF-8 source used by this reader). Both duplicate ID/version definitions and changes without a version bump are visible findings. Template scanning is bounded to 100 files, 512 KiB/file and 2 MiB total; symlinks are refused.

Only a declared role/environment/language/framework match plus a supported slot/node-type match produces `mapped-declaration`. `custom-declared` means a reference was supplied, not that a file exists or its code works. Missing/deferred/invalid mappings are displayed and may be saved as incomplete design choices. Deleting an object retains its dangling binding for review.

Every inspection returns `generation.available: false`. A file claiming `executable: true` or naming a framework cannot enable execution. Future registered generators must implement the generic `TargetTemplate` interface and validate an explicit deployment against a platform-neutral ProductIR. The IR now preserves nodes, edges, document records and traceability without aliasing the canonical graph. There is no generator registry or build runner in this change.

## Agent handoff

**Build target context** takes an explicit task root and task. It invokes the existing `buildTaskContext()` once, retaining global constraints, source Markdown, hashes and selection trace, then adds the selected target, pinned template metadata and relevant bindings. The UI lens cannot remove mandatory context.

A changed, unreviewed template body is omitted from context: only its observed identity and a drift finding are included until the user explicitly selects the new pin.

Other targets' choices and custom references are not included. Bindings outside the selected task model are listed by ID as omitted; missing model references remain findings. The output is a separate, versioned `productgraph.implementation-context.v1` artifact, not a silent change to the old graph-summary or task-context APIs. JSON/Markdown are rendered from the same retained artifact. `productTaskBuildId` identifies its unmodified product-context build; `buildId` also binds the implementation snapshot and selected payload. Context builds recheck model/template/config inputs but are not an atomic snapshot of arbitrary external filesystem writers.

The original character budget includes the added implementation declarations. Over-budget required metadata is retained with a gap; it is not silently truncated. This is UTF-16 source-character accounting, not tokenizer measurement and not full JSON/wrapper size. No secret-redaction engine is added: review exports before sharing with an external agent. `ready-for-review` does not mean buildable or verified. Permissions remain false for writes, execution and external access.

```sh
npm run context:target -- /path/to/project web feature:record-usage "Implement form validation" json
npm run context:target -- /path/to/project web feature:record-usage "Implement form validation" markdown
```

The CLI is read-only; it writes to stdout only. Product-only work can continue to use `context:task` without choosing a platform. MCP and the original Sketch tool retain their existing contracts; no provider or agent process is added.

## API and code boundaries

Workspace routes below are prefixed with `/api/projects/:catalogId`; single-project serve uses `/api`. Requests never select a filesystem root in their body.

| Route | Contract |
| --- | --- |
| `GET /implementation` | Saved config, revision, product inventory, template declarations and mapping findings. |
| `POST /implementation` | `{expectedRevision, config}`; checked replacement of target configuration only. |
| `POST /implementation/context` | `{targetId, expectedRevision, context: {task, rootIds, ...}}`; read-only composition through the existing task builder. |

`implementation-targets.ts` owns validation, file persistence and mapping checks. `implementation-context.ts` composes retained task output; `implementation-api.ts` adapts the existing local HTTP host. `implementation-targets.js` is mounted by the existing Studio page coordinator. No npm dependencies or lockfile changes are required.

## Verification scope

```sh
npm run test:targets
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:targets:browser
```

Source/API tests use real temporary project folders, reads/writes, contexts and HTTP requests. Browser tests exercise the actual target module and project client inside a labelled lightweight host with controlled API fixtures; they are not a full application end-to-end run or an agent outcome benchmark. Full repository, ordinary browser-to-server, platform and future generated-output tests remain release checks. No mobile/web/backend runtime is built by these tests.
