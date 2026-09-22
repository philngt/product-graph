# Verification and release evidence

Status: verification plan for the [implementation baseline](README.md#baseline-and-status). This page deliberately contains **no aggregate passing score**. Previous PR test totals describe those revisions/environments, not a current full-suite result.

## Automated suites

Run from a full checkout with dependencies installed. Inspect [package.json](../package.json) and the test source when changing a suite; scripts are not interchangeable coverage claims.

| Command | Primary coverage and important limit |
| --- | --- |
| `npm test` | All current top-level TypeScript/MJS tests. Browser/live tests may skip without their prerequisites; this is not automatically a platform/release certification. |
| `npm run test:studio` | Pure navigation/projection state. No browser or persistence. |
| `npm run test:studio:layout` | Layout/connector helpers. No full graphical usability proof. |
| `npm run test:workspace` | Catalog, local files/documents and project-client behavior in tests. |
| `npm run test:authoring` | Sketch/definition, task context and HTTP/CLI paths with temporary data. |
| `npm run test:targets` | Target config/IR, composed context and focused HTTP/CLI tests. |
| `npm run test:studio:browser` | Studio/Paper UI with fixture API responses. |
| `npm run test:workspace:browser` | Projects and document/session UI with controlled fixtures. |
| `npm run test:workspace:live` | Opt-in live browser/server path; uses `PRODUCT_GRAPH_LIVE_BROWSER` and working loopback access. |
| `npm run test:authoring:browser` | Authoring module in a host fixture; test-only transport to real temporary-project handlers. Not full Studio wiring. |
| `npm run test:targets:browser` | Targets module/project client in a lightweight fixture host. Not full page coordinator/router integration. |

Example for a POSIX shell, after choosing an installed Chromium/Chrome executable:

```sh
export PRODUCT_GRAPH_BROWSER=/absolute/path/to/chromium
npm run test:studio:browser
npm run test:workspace:browser
npm run test:authoring:browser
npm run test:targets:browser
# Live suite uses a separate, explicit opt-in variable:
export PRODUCT_GRAPH_LIVE_BROWSER="$PRODUCT_GRAPH_BROWSER"
npm run test:workspace:live
```

Use the equivalent environment-variable syntax on other shells and record which platform was exercised. Do not modify managed browser/network policies to make a test pass. A test-only transport must remain clearly labelled and absent from application code.

`node --check ui/app.js` and checks on changed UI modules detect syntax only. There is no dedicated TypeScript typecheck script at the baseline. A separately invoked compiler/typecheck must record the exact configuration and dependencies; Node's type stripping is not type checking.

## Manual integration gate

Use two disposable project folders through the **ordinary local browser/server route**, not only an isolated feature harness.

| Scenario | Evidence required |
| --- | --- |
| Project create/open/switch | Correct URL/project, independent graph and revisions, Save/Discard/Cancel, failed-save draft retained; removing catalog entry leaves files. |
| Focus and authoring | Selection vs focus preserved, lens-hidden object explained, Undo separate from navigation, saved graph includes hidden objects. |
| Sketch → proposal | Sources retained, explicit interpretation/reuse, exact review, stale graph/board/proposal refused, rejection does not delete notes. |
| Documents and product context | Read actual source, follow links, missing/unsafe sources visible, mandatory constraints included outside the visible lens, hashes change with source. |
| Targets | Add two targets referencing one object; save/reopen through actual page coordinator and workspace router; drift/stale revisions preserve draft. |
| Target context | Selected target only, unresolved mapping visible, unreviewed changed template withheld, export does not imply execution. |
| Negative behavior | Unknown IDs/paths, invalid JSON, unsafe paths and duplicate IDs handled without cross-project writes or false success. |

Record model/target source revisions, app commit, runtime/browser/OS and whether requests used real files, fixture APIs or test transports. A screenshot of a lightweight host is not evidence that the main Studio page/router works.

## Evidence levels

A schema/graph validation result proves only the checks implemented. A context-selection test proves selected/omitted sources for the fixture, not that an agent made good decisions. A template declaration match proves metadata compatibility, not executable support. Unit tests, browser integration and generated-application tests answer different questions.

For future application adapters, require a reproducible generation/build, domain acceptance cases, generated/custom ownership checks and target-environment evidence. No such generator or evidence-ingestion pipeline is implemented today.

## PR reporting and documentation checks

Every report should identify the head SHA, commands, pass/fail/skip counts, environment, changed-file scope and known exclusions. Empty CI/status results mean no reported checks, not green CI. Never reuse historical test counts as a rerun.

For documentation changes, verify relative links and source paths, script names, balanced code fences, parseable JSON examples, and current/planned labels. Validate examples against the owning schema when they purport to be complete payloads. Mermaid source can be inspected separately from a rendered-diagram test; do not claim rendering was checked if only text was inspected. Source-only docs review does not require inventing a successful application run.

Before release, reconcile failures and untested paths explicitly. Mergeability is a Git property, not a release-readiness result.
