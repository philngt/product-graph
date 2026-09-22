# Development guide

Status: commands and boundaries checked against the [documentation baseline](README.md#baseline-and-status). The commands below are instructions to run in your checkout, not a claim that this documentation change ran the full application suite.

## Setup and local launch

Use Node.js 22+ and npm, as declared in [package.json](../package.json). From a full checkout, install the pinned dependencies before using entry points that import MCP or other packages:

```sh
npm ci
npm run workspace
```

The server prints its local address. The workspace CLI defaults its catalog to `~/.productgraph` (or `PRODUCT_GRAPH_HOME`) and accepts an explicit catalog directory/port:

```sh
npm run workspace -- /absolute/path/to/catalog 4173
```

The catalog is not the application repository or a single product folder. Create/open product folders in Projects. Do not use an existing repository's unrelated files as test data. The browser Studio is the current host; a native macOS shell is not a prerequisite or implemented host.

## Single-project and generated-document commands

Use a new disposable destination for initialization; `init` copies the repository's default scaffold, while Projects home creates its own minimal project. These are not identical onboarding payloads. Inspect and rename the sample product identity/objects deliberately.

```sh
npm run framework -- init ../product-graph-demo
npm run framework -- serve ../product-graph-demo 4174
```

For a product folder already containing `project.json`:

```sh
npm run framework -- validate /absolute/path/to/product-folder
npm run framework -- project /absolute/path/to/product-folder
npm run framework -- context /absolute/path/to/product-folder
npm run framework -- check /absolute/path/to/product-folder
```

`project` and the legacy `context` command write derived files; Studio graph Save does not regenerate them. `check` checks diagnostics and generated projection/legacy-context drift, not TypeScript types or generated application correctness. At this baseline `validate` and `check` fail on any diagnostic, including warnings, while some save/build paths only block errors. Investigate the actual result rather than assuming equal gate behavior. Source: [cli.ts](../src/cli.ts).

The package shortcut `npm run check` passes `.` as a **product folder**. Running it in this software repository without `project.json` is not a repository health check. Use the explicit path above.

## Task and target context

Replace the example IDs with actual IDs from your saved project; the commands do not create those objects/targets.

```sh
npm run context:task -- /absolute/path/to/product-folder feature:record-usage "Define failure cases" json
npm run context:target -- /absolute/path/to/product-folder web feature:record-usage "Implement validation" markdown
npm run framework -- mcp /absolute/path/to/product-folder
```

The first two output retained context to stdout only. The MCP command starts a stdio server for an external MCP client; it is not an HTTP UI address. Review source text before sharing. See [agent workflow](agent-workflow.md).

## Where to change code

Start with the [architecture responsibility map](architecture.md#2-responsibilities). UI orchestration lives in `ui/app.js`; focused helpers and newer feature modules are separate files. Backend entry points adapt filesystem/application modules; pure functions should remain testable without a browser. New target logic should extend the explicit target contract, not add Swift-specific defaults to product objects.

Avoid adding a dependency, background process or schema unless the task needs it. Reuse existing task selection for target context. Preserve source ownership and old project loading behavior. Validate externally supplied shapes at the owning boundary; a TypeScript cast alone is not input validation.

Before opening a PR: inspect the current base, read applicable contracts, identify the smallest coherent change, add relevant tests, update affected docs and state what was not verified. Do not merge or force-push another branch as part of an unrelated task. [AGENTS.md](../AGENTS.md) applies to this repository.

## Recovery and troubleshooting

| Symptom | Action |
| --- | --- |
| Missing `project.json` | Check that the command points to a user product folder, not the catalog or software repo. YAML manifests are not loaded. |
| Conflict on Save | Keep the draft, open/read the current saved inputs, compare and reconcile. Do not delete the stored file or bypass its revision. |
| Template drift | Inspect the changed definition; re-pin only after accepting its version/content. A matching slot still does not enable generation. |
| Lock reported busy | Confirm whether a cooperating writer is active. Investigate a stale lock before manual cleanup; never automatically delete locks on startup. |
| Documents/context incomplete | Check linked source paths, selected heading names, boundaries and size limits; inspect gaps rather than replacing missing data. |
| Browser suite skipped | Set the documented browser variable and verify an executable exists. A skipped test is not a pass. |

Keep backups of project sources. Save uses several ownership-specific revisions and per-file writes, not project-wide crash rollback. Avoid running migration/debug scripts on the only copy of personal data.

Testing commands, manual acceptance and evidence requirements are in [verification](verification.md).
