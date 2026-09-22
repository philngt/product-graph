# Roadmap and capability gaps

Status: proposed priorities, not scheduled commitments or implemented features. Baseline: [current code and capability terminology](README.md#baseline-and-status). The product direction is owned by the [thesis](product-thesis.md).

## Current foundation

Local multi-project Studio, focus/lenses, read-only Documents, sketch-to-definition proposals, product task context, multiple implementation targets, template declaration/pin checks and target-aware context are present in source. Application generation, workflow execution, document editing, automatic sketch interpretation and template composition are not. Source presence is not full integration evidence.

## P0 — Make the existing integrated loop dependable

Close the full-host gap between feature harnesses and ordinary browser/server operation. Exercise Projects → Studio → Sketch → proposal Apply → Targets → context export with real files. Consolidate clear mutation/validation contracts where UI and backend paths differ, and document revision ownership across entry points. Investigate multi-file save/recovery behavior before increasing automatic writes.

**Exit:** reproducible full-host regression, stale-save/source-change cases retain drafts, project isolation is tested, dependencies/test prerequisites are recorded, and code versus documentation discrepancies have owners. Do not add a database or runtime merely to relabel these modules as engines.

## P1 — Make one feature definable without generic JSON editing

Add bounded no-code forms for object fields, flow inputs/outcomes, rules and acceptance cases. Support direct definition for clear requirements without forcing a sketch. Add source-document editing as a separate session with draft/revision/conflict semantics. Extend the context/agent adapter only through the existing builders; distinguish proposed meaning from accepted product decisions.

**Exit:** a person completes a specified feature definition, reuses an object, preserves an open question and hands off the right sources without manually editing JSON. State which controls are real versus only metadata. Evaluate usability separately from static tests.

## P2 — Prove one real implementation adapter

Choose a deliberately narrow target/template based on a representative task and available build/test environment. **No platform is preselected by this roadmap**; SwiftUI is one candidate, not a mandatory core dependency. Define supported object/flow/experience shapes and reject incompatible mappings explicitly.

Implement generation preview, source-to-file provenance, generated/custom ownership and a reproducible build/test for one feature. Keep ProductIR and canonical semantics technology-neutral.

**Exit:** a real generated artifact builds and passes specified acceptance cases; regeneration preserves custom work; unsupported capabilities and partial failures are reported. A framework label, file count or disabled Generate button is not completion.

## P3 — Grow reuse and verification deliberately

After the adapter succeeds, consider module/template composition, richer field/multi-slot binding, versioned pattern instances and reviewed upgrades. Introduce versioned implementation evidence and change impact tied to actual mappings. Choose whether a small workflow simulator is useful before designing a general automation runner.

**Exit:** repeated projects reuse a measured mechanism without erasing domain meaning, and upgrades expose drift/migrations instead of overwriting product choices. Each execution capability requires a permission/side-effect boundary and its own tests.

## Deferred unless evidence justifies scope

Freehand/image interpretation, real-time collaboration, hosted accounts, vector retrieval, a marketplace, agent scheduling, credentials/webhooks, universal round-trip engineering and one-click deployment are not commitments. Do not group them into an undifferentiated V2.

## Decisions still open

The first generator target, commercial model, source-editor approach and any stronger persistence/indexing mechanism require explicit choices. The platform-neutral model does not decide them automatically. Capture rationale and alternatives in the [decision register](architecture-decisions.md); use [verification](verification.md) to define evidence before changing a capability to Implemented/Verified.
