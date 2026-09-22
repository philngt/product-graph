# Product Graph documentation

**Product meaning first. Implementation is a choice. Evidence is explicit.**

This is the entry point for contributors, product decisions and agent handoffs. These documents describe **Product Graph itself**. A product being designed in Studio has its own folder, graph, `documents/` and implementation configuration; this repository's `docs/` is not automatically loaded into every user project.

## Baseline and status

The implementation descriptions in this documentation set were checked against `main` at **`98c67f8c91bcd3bdc69946275dc75408a1bfc34f`**, on **2026-09-22**. This is a source-inspection baseline, not a release certificate or a new successful test run. Later implementation changes must update the affected documentation with evidence.

- **Implemented** means an identifiable code path exists at that baseline; it does not imply full integration, security or platform verification.
- **Planned** means a design direction or backlog item, not a working button, API or generator.
- **Hypothesis** means a product/business assumption that still needs validation.
- **Verified** must identify the test/run, revision, environment and what was actually checked. A historical PR report is not current evidence by itself.

No executable application generator or workflow runner is registered at this baseline. Swift/SwiftUI is one possible target, not the product's scope.

## Read by question

| Question | Primary document |
| --- | --- |
| Why does this product exist? | [Product thesis](product-thesis.md) |
| Who is it for, and what value should it deliver? | [Product brief](product-brief.md) |
| How is the application currently built? | [Architecture](architecture.md) |
| Which data belongs where, and what do IDs/revisions mean? | [Data model](data-model.md) |
| How does a person complete work in Studio? | [User flows](user-flows.md) |
| How do agents receive context and return proposals? | [Agent workflow](agent-workflow.md) |
| How do I run and change the repository? | [Development guide](development.md) |
| What must be tested, and what does each suite cover? | [Verification guide](verification.md) |
| What should be built next? | [Roadmap](roadmap.md) |
| Why were the main architecture choices made? | [Architecture decisions](architecture-decisions.md) |
| What rules should a coding agent follow in this repo? | [AGENTS.md](../AGENTS.md) |

Suggested first read: thesis → brief → architecture → user flows. Before implementation, read the relevant slice contract below and its source/tests.

## Detailed contracts and reference research

| Document | Owns the details of |
| --- | --- |
| [Semantic Model Studio](semantic-model-studio.md) | Focus, lens, selection, visibility and navigation/edit-history separation. |
| [Multi-project workspace](multi-project-workspace.md) | Catalog, routes, saved-source documents, project switching and local-file boundaries. |
| [Visual authoring](visual-authoring.md) | Sketch storage, explicit definitions, exact proposal review and product task context. |
| [Implementation targets](implementation-targets.md) | Target configuration, pins, bindings, mapping findings and target-specific context. |
| [Paper Studio](paper-studio.md) | Original visual/canvas slice and its historical scope. |
| [Hibi research](hibi-document-management.md) | Reference observations and possible document-management ideas, not an implementation checklist already completed. |

Older slice documents preserve the scope at the time they were written. For example, the original Paper Studio's Target placeholder is superseded by the implementation-target contract. Do not infer that a capability is still absent solely because an older slice listed it as future work.

## Documentation ownership and change rules

The thesis owns principles; the brief owns users/value and hypotheses; architecture/data-model describe the implementation; detailed contracts own exact payloads/limits; the roadmap owns proposed work. Avoid copying entire schemas into several pages. Link to the contract and implementation instead.

When changing behavior, update its contract, the relevant flow, and tests together. When changing a major boundary, add or supersede a decision record. If code and a normative rule disagree, report the discrepancy; do not describe the rule as already enforced. Historical source links and test reports remain evidence of their own revision only.

[Repository overview](../README.md) · [Current scripts](../package.json) · [Core graph types](../src/types.ts)
