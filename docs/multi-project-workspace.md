# Local multi-project workspace

## Start

Use Node.js 22 or newer. Run from this repository:

```sh
npm run workspace
# Explicit catalog folder and port:
npm run workspace -- /absolute/path/to/studio-catalog 4173
```

The default catalog is `PRODUCT_GRAPH_HOME` or `~/.productgraph`. Open the printed loopback URL. The existing `framework serve <project> <port>` and project-specific MCP entry point remain available; this slice does not make MCP multi-project.

**Projects** offers search by name/path, Create, Open existing folder and recent ordering. Create makes a new UUID-named folder under `<catalog>/projects/` with a minimal product graph and `documents/overview.md`; it does not copy the demo templates. Open registers an existing Product Graph folder **in place**. Enter the absolute path on the machine running the server. The browser does not offer a native OS folder picker. No arbitrary folder discovery, upload, copying or relocation occurs.

Removing a project removes its catalog entry only. It never deletes the project folder. Missing/moved folders stay visible as unavailable until removed/reopened. The catalog stores root locations, display names and last-opened timestamps in `projects.json`; it is not a second copy of product data. Maximum 100 entries. Back up this file and the project folders separately.

## Isolation and switching

Each registered location has an opaque catalog ID independent from `manifest.projectId`. Copies that share a manifest ID remain separate locations. Alias paths resolving to the same real folder reuse one entry. Project routes permanently identify their location:

```text
/                                  Projects
/project/:catalogId/               Studio
/api/projects                      GET catalog; POST create
/api/projects/open                 POST {path} register existing
/api/projects/:catalogId            GET metadata; DELETE forget only
/api/projects/:catalogId/visit      POST record last opened
/api/projects/:catalogId/workspace  GET snapshot; POST save
/api/projects/:catalogId/...        Context, commands, proposals and documents
```

There is **no mutable server-wide active project**. The root is resolved for each request. Unscoped project APIs are rejected in workspace mode. Each browser tab has its own client and revision. Two tabs can use different projects on the same server/port.

The Projects button in Studio opens a switcher. Unsaved model/layout or inspector edits require **Cancel / Discard and switch / Save and switch**. Save first applies a valid inspector draft, then awaits a successful workspace save. Failure keeps the current project and edits. An unavailable target is checked before prompting. Switching uses a full-page navigation, resetting selection, undo/redo, navigation history, proposals and pending UI callbacks. Drafts and view histories are not retained across project switches or crashes. Browser navigation/closing retains the native unsaved-changes warning.

## Save protection and boundaries

Multi-project writes require `X-Product-Graph-Revision`, returned as `workspaceRevision` by snapshot and write responses. It fingerprints the saved graph, layout and canonical location. A stale or different-location revision is rejected, preserving client edits. Read-only context/preview requests never advance the client's write revision. Legacy single-project clients can still omit the header.

Save checks product identity, graph shape, validation, record sizes, filename collisions and layout paths before writing. Stored JSON records absent from the submitted graph are removed from the managed graph directories so deleted objects do not reappear on reload. This does not remove Markdown documents. Individual files use temporary-file replacement. **The entire graph/catalog/proposal operation is not a multi-file transaction, does not offer crash rollback and does not coordinate concurrent external filesystem writers.** Back up projects. A conflict requires manual reconciliation; there is no automatic merge.

The service listens on loopback, rejects unexpected Hosts/cross-origin requests, bounds request bodies and rejects symlinks inside managed project data. Catalog creation/update uses a short-lived lock file and atomic file replacement. A process crash can leave a lock; stop all workspace processes before removing a known stale lock. This local service is not a remotely hosted multi-user server and should not be exposed publicly.

## Documents

Choose **Documents** in project tools. This is a **read-only source browser**, not a rich-text editor:

- Separate source (`documents/`) from generated (`projections/`, `agent-context/`) Markdown.
- Search title/path; filter by source/generated or links to the selected product object.
- Read exact UTF-8 text, select/copy it, use an ATX-heading outline, follow local inline Markdown links and inspect backlinks.
- Link back to graph objects through existing GraphDocument links / node.document references. Document hyperlinks do not create semantic graph edges.
- Refresh explicitly after external edits. Missing source records are shown as unavailable. Unsaved graph links are not presented as saved data.

The reader never renders HTML, fetches remote media, edits documents, or rewrites Markdown. Index bounds: 500 readable files, 1 MiB per file, 8 MiB text total, 3,000 scanned directory entries and depth 12. Hidden files, `node_modules` and symlinks are skipped. Only Markdown under the three allowed roots is readable. Registered missing-document metadata can also appear in the list. Results disclose truncation/skipped entries.

Outline/link extraction is intentionally partial: ATX headings outside frontmatter/fences, simple inline local links without whitespace/parentheses in destinations. Reference links, setext headings, wikilinks, HTML links, image links and full CommonMark semantics are not supported. This is not a complete knowledge graph or full-text search index.

## Verification

```sh
npm run test:workspace
PRODUCT_GRAPH_BROWSER=/path/to/chromium npm run test:workspace:browser
# Optional actual browser-to-server integration (loopback navigation must be permitted):
PRODUCT_GRAPH_LIVE_BROWSER=/path/to/chromium npm run test:workspace:live
```

The first suite uses real temporary folders and HTTP servers plus a small client-unit fixture. The normal browser suite runs actual HTML/CSS/ES modules with in-memory API responses and a captured navigation destination. It does not prove full-page navigation or browser-to-server integration. The opt-in live suite starts the real server and browser; it must be run in a runtime permitting loopback browser navigation. Browser suites skip explicitly without the corresponding environment variable. No external credentials or provider access are needed.

Not included: multiple document tabs, source editing, rich-text preview, file rename/move/trash, file watchers, configurable ignore syntax, local document version history, shared cross-project patterns, graph merging across projects, multi-project MCP, SwiftUI compilation or native macOS packaging. See [Hibi document-management notes](hibi-document-management.md) for the next document slices.
