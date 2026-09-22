# Data model and information ownership

Status: describes the [implementation baseline](README.md#baseline-and-status). Exact TypeScript contracts and validators remain authoritative for accepted input; this document explains their meaning and limits.

## Product folder versus application repository

A user project contains `project.json`, `graph/` and optional source/configuration folders. This repository contains `src/`, `ui/`, `tests/` and engineering `docs/`. Editing repository docs does not silently create user-project graph nodes. Likewise a document-reader backlink does not imply a domain dependency.

| Information | Location in a user project | Owner |
| --- | --- | --- |
| Product identity | `project.json` | Project manifest. |
| Product objects | `graph/nodes/*.json` | Canonical semantic model. |
| Semantic relationships | `graph/edges/*.json` | Canonical semantic model. |
| Document records and graph links | `graph/documents/*.json` | Structured references, not the Markdown body. |
| Long-form knowledge | `documents/` | Source Markdown. |
| Exploratory cards/arrows | `sketches/board.json` | Independent sketch source. |
| Target choices and bindings | `implementation/targets.json` | Implementation definition, referencing product IDs. |
| View positions/pins | `layout/*.json` | Presentation. Camera/navigation also have session-only state. |
| Focus and library definitions | `focus-areas/`, `patterns/`, `templates/`, `tours/` | Project-local supporting definitions. |
| Generated views and legacy bundles | `projections/`, `agent-context/context.*`, `agent-context/scopes/` | Derived artifacts produced by explicit commands. |
| Proposals | `agent-context/proposals/*.json` | Review records; not product truth before Apply. |

Not all optional folders exist in a new project. Target/task CLI exports go to stdout; they do not automatically populate a persistent build-artifact directory. Source: [io.ts](../src/io.ts), [cli.ts](../src/cli.ts), [workspace.ts](../src/workspace.ts).

## Core graph

[types.ts](../src/types.ts) defines `Graph = { manifest, nodes, edges, documents }`.

A `GraphNode` has `id`, `type`, `region`, `title`, optional `status`, `data` and `document`. A `GraphEdge` has optional `id`, `kind`, `from`, `to` and optional `data`. A `GraphDocument` has `id`, `title`, `path`, optional `purpose`, `status` and `links` to product IDs.

The regions are `intent`, `product`, `business`, `workflow`, `domain`, `experience`, `architecture`, `decision`, `quality`. A feature is a useful connected working scope, not an additional storage hierarchy. The `status` string is not a globally enforced maturity state machine. Business nodes describe a product's plans/entitlements; they do not implement billing.

Example objects and relationship below illustrate accepted record shape, not a full app or executable workflow:

```json
{
  "nodes": [
    {"id":"feature:record-usage","region":"product","type":"feature","title":"Record usage","status":"draft"},
    {"id":"domain:bottle","region":"domain","type":"entity","title":"Bottle"}
  ],
  "edges": [
    {"id":"edge:usage-bottle","from":"feature:record-usage","to":"domain:bottle","kind":"uses"}
  ]
}
```

Graph edge kinds are broader than the Sketch definition form's explicit vocabulary. Typed control/data ports and an execution-plan schema do not exist yet. Do not claim `relationClass` is required on every existing edge. [validate.ts](../src/validate.ts) checks required fields, supported regions, references and selected diagnostics/cycles; it does not prove complete business semantics. [visual-authoring.ts](../src/visual-authoring.ts) adds stricter checks for sketch-origin proposals.

The loader accepts JSON manifests, maps legacy `layer` to `region`, and does not load YAML manifests. Saving normalizes graph-record filenames and rejects collisions, including case-insensitive collisions. Do not infer the persisted filename by simply appending `.json` to an ID.

## Sketch and proposal

`productgraph.sketch.v1` stores notes with stable ID, kind (`note`, `question`, `assumption`), text, position and optional focus ID, plus untyped links. It is not a second semantic graph. A definition maps selected note IDs to new or existing product IDs. New objects start as drafts and preserve source provenance; reuse does not overwrite an existing object's title/data.

A proposal contains commands, affected IDs, source, status and a base graph revision. Sketch proposals additionally retain source notes, board revision and explicit mappings. Proposal creation may write a review record but does not modify product objects. The [authoring contract](visual-authoring.md) owns exact payloads, limits and review requirements.

## Implementation definition

A project can have zero or multiple targets. Roles are `interface`, `backend`, `worker`, `cli`, `library`; environment, language, framework and storage are explicit strings. One target currently has at most one foundation-template pin and one binding per product object. Binding modes are `template`, `custom`, `deferred`.

A pin is ID + version + definition hash. A slot declares accepted node types and target metadata compatibility. It is not a generator. Custom references are inert strings, not verified paths. Dangling bindings can remain visible for review rather than being silently deleted with a product object. [implementation-targets.md](implementation-targets.md) owns the precise schema/example.

## Identity and revision boundaries

| Identity | What it represents | Not interchangeable with |
| --- | --- | --- |
| Catalog ID | A registered folder/route in the local workspace. | Product manifest ID. |
| Product ID | Logical identity in `project.json`. | A user/tenant security principal. |
| Node/document/sketch ID | Identity within that source/model. | Filename, display title or screen coordinates. |
| Graph fingerprint | Structured graph content. | Markdown content or full project revision. |
| Workspace revision | Graph + layout + canonical location for the HTTP save path. | Sketch or target revision. |
| Board revision | Board + product identity + canonical location. | Graph revision; moving a card can invalidate a sketch proposal. |
| Proposal revision | Exact reviewed proposal content. | Proof of human identity or execution consent. |
| Implementation revision | Config + graph fingerprint + current template inventory + location. | Markdown bodies or layout revision. |
| Source/content hashes | Captured source bytes and selected context content. | Factual correctness or approval. |
| Context build ID | Identity of the retained request/source/projection result. | A completed implementation or test run. |

Hash fields are not all calculated by one universal serializer. Use the owning builder rather than independently recomputing a supposedly equivalent revision. Sources: [revision.ts](../src/revision.ts), [server.ts](../src/server.ts), [visual-authoring.ts](../src/visual-authoring.ts), [implementation-targets.ts](../src/implementation-targets.ts).

## Evolution rules

Preserve product IDs across views/targets. Introduce schema versions and explicit migration for incompatible changes; do not silently drop unknown data. Keep drawings, documents, product graph and implementation configuration connected through references rather than copies. Future code artifacts and evidence require versioned contracts of their own; no current general evidence ingestion or generated/custom lifecycle should be inferred from a metadata field.
