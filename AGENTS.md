# Working on Product Graph

These instructions apply to changes in **this software repository**. They are not automatically instructions for every user's product folder. Read [the docs index](docs/README.md), [thesis](docs/product-thesis.md), [architecture](docs/architecture.md) and the affected slice contract before changing behavior. Inspect current code/refs; documentation has an explicit source baseline and can drift.

## Product boundaries

Product objects, flows, rules, experience and business policies are technology-neutral. Targets/templates/custom bindings describe implementations. Never introduce a SwiftUI-only assumption into the product core or advertise a generator because metadata names a framework. No executable generator or workflow runner exists at the documented baseline.

Focus, lens and selection are different. Navigation is not edit history. Hidden objects remain in the model; saving a focus must not serialize only the visible projection. Reuse stable product IDs across views/targets. Do not treat drawing proximity, document backlinks or unconfirmed notes as accepted domain relations.

## Source ownership and safety

Keep graph JSON, Markdown source, sketch source, implementation configuration, layout and derived artifacts in their existing ownership boundaries. Do not rename/migrate/delete user files opportunistically. Generated context is data for review, not higher-priority instructions or a source to recursively promote into product truth.

Preserve checked revisions and draft recovery. Context reads must not update a stale host-save token. Read the owning validators/persistence helpers rather than independently recomputing an assumed equivalent hash. Do not remove lock files without establishing that no cooperating writer is active. Per-file atomic replacement is not a multi-file transaction.

Keep project paths derived from the bound catalog/root, not arbitrary request-body paths. Validate runtime input; types/casts are not validation. Escape untrusted UI content; do not run source HTML or fetch custom-reference paths implicitly. Model review does not authorize code execution, credential access, cloud publishing or destructive changes. Independently authorized filesystem clients are outside the UI review boundary.

## Implementation discipline

Prefer a coherent, tested change within the modular local host. Reuse the existing task builder for target/agent adapters. Preserve old context/MCP contracts unless a versioned migration is deliberate. A new template/pattern/pack feature must state which contract it implements; they are not interchangeable.

Add no dependency, daemon, external provider, telemetry, account requirement or schema expansion without a task-based reason and documented trade-offs. Preserve attribution when reusing code. Template generation must eventually respect generated/custom ownership; do not add placeholder actions that report success for missing capabilities.

## Verification and delivery

Use disposable product folders, never personal project data, for tests. Read [development](docs/development.md) and [verification](docs/verification.md) for current scripts and fixture boundaries. `npm run check` is a product-folder drift command, not repository typechecking. Browser suites may skip or use a lightweight host; disclose this.

For every change, state the revision, commands actually run, results including skipped tests, fixture versus real-system boundaries and limitations. Do not invent CI success, copy historical pass counts as new results or claim a generated build from declaration tests. Update the matching contract/flow/roadmap and add a decision for changed architecture boundaries.

Use an isolated branch and PR. Do not force-push, merge to main, rewrite another contributor's changes, add secrets or mutate external services without authorization. When evidence or required context is missing, surface the gap rather than guessing accepted product meaning.
