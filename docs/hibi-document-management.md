# Learning from Hibi without replacing the product model

Reference: [schmayterling/hibi](https://github.com/schmayterling/hibi) at `0e839c06329d6fe9c7fd628fc59041fc031a5bf1`. This is a review of its published guides/architecture, not an executed Hibi build or a source-code transplant. Hibi declares AGPL-3.0. No Hibi source, assets, fonts or dependencies have been copied into this implementation. Existing Product Graph attribution for Design Studio AI is unchanged.

## What the reference describes

| Reference | Useful behavior | Product Graph adaptation |
| --- | --- | --- |
| [Workspaces](https://github.com/schmayterling/hibi/blob/0e839c06329d6fe9c7fd628fc59041fc031a5bf1/docs/guides/workspaces.md) | An ordinary folder, in-place files, recent workspaces, display metadata distinct from paths, bounded browsing, symlink exclusion, configurable ignore rules and outline. | Register existing project folders without importing; opaque catalog location IDs; bounded source list and outline. Ignore configuration and live file watching remain deferred. |
| [Editing](https://github.com/schmayterling/hibi/blob/0e839c06329d6fe9c7fd628fc59041fc031a5bf1/docs/guides/editing.md) | Source/formatted/side-by-side modes; unsaved tabs; explicit handling of external edits. Its guide warns that formatted editing may normalize unsupported source constructs. | Start with exact read-only UTF-8 source. Never round-trip arbitrary Markdown through a partial visual renderer. Add editing only with document-specific revision checks, dirty tabs and recovery tests. |
| [Graph and tags](https://github.com/schmayterling/hibi/blob/0e839c06329d6fe9c7fd628fc59041fc031a5bf1/docs/editing/graph-and-tags.md) | Local Markdown links and incoming/outgoing connections; separate layout from files; bounded index; tags as an addon. Wikilinks are explicitly unsupported there. | Show document links/backlinks separately from typed product relations. Do not infer a domain relationship merely because one Markdown file links another. Tags and a document-link canvas are deferred. |
| [Version history](https://github.com/schmayterling/hibi/blob/0e839c06329d6fe9c7fd628fc59041fc031a5bf1/docs/editing/version-history.md) | Local snapshots after successful saves; restore into editor before replacing disk; bounded history is not a backup. | Future document history should restore a draft first, keep provenance, and require explicit save. The current document reader performs no writes and has no version store. |
| [Architecture](https://github.com/schmayterling/hibi/blob/0e839c06329d6fe9c7fd628fc59041fc031a5bf1/docs/ai-agents/development/architecture.md) | Privileged filesystem access behind a validated bridge; selected canonical folders and relative document paths; guarded operations; safe static rendering. | Keep filesystem authority on the local server, not generic browser-provided paths. Resolve catalog IDs, restrict document roots, bound reads, reject traversal/symlinks, and display source without executing HTML. |

## Keep three models distinct

1. **Project catalog:** where projects live and which was opened recently. It must not combine their graphs or agent contexts.
2. **Product graph:** typed semantic meaning: intent, feature, rule, workflow, screen, architecture and verification. Canonical JSON remains authoritative.
3. **Document navigation:** Markdown source/projection paths, headings and document hyperlinks. These are supporting context, not a replacement semantic ontology.

A document may be linked to several product objects through existing document records. A graph lens and a document browser are different views of project context. Moving visual nodes must never move files; removing a catalog entry must never delete a project; merely reading generated context must never make it independently editable truth.

## Recommended next document slices

**Source editor with draft tabs:** one tab per canonical path, reopen selects an existing tab, independent dirty indicators and undo, Save/Discard/Cancel, preserve drafts on failed writes, and conflict detection based on the file revision rather than only the graph revision. Saving must not silently regenerate source documents or overwrite generated projections.

**Outline and navigation:** a real Markdown parser for full syntax support, lazy folder expansion, find-in-document, keyboard navigation, stable graph backlinks and handling for missing files. Keep optional full-text indexing bounded and rebuildable, not canonical data.

**File operations and history:** preview rename/move effects on registered paths and relative links; confirm only actual destructive operations; local snapshots after successful saves; restore to draft first. Cross-file link rewrites require a recoverable plan, not an unreviewed bulk replace.

**Generated-context discipline:** source remains editable by its owner; projections show generator/revision provenance and can be regenerated from the graph. A stale generated file is a verification issue, not a competing product decision.

Do not add Hibi's full format/addon/plugin stack merely to get these interactions. Product Graph's dominant task remains building a product model. The document experience should reduce lost context, not turn the app into an unrelated general-purpose writing suite.
