# Product Graph thesis: shared meaning, independent implementations

**Tự do khi suy nghĩ. Có cấu trúc khi định nghĩa. Có kiểm chứng khi triển khai.**

Product Graph is a local visual workspace where humans and agents define a product through shared objects, flows, rules and experience. The product model is independent of implementation technology. Targets, reusable templates and custom extensions describe how supported parts become software.

**Sản phẩm là trung tâm. Graph giữ ý nghĩa. Template giảm việc lặp lại. Platform là lựa chọn triển khai.**

Swift/SwiftUI is one possible implementation, not the definition or scope of Product Graph. A web interface, native interface, backend API, worker and CLI can reference the same product model. Platform independence is not a promise of automatic generation for every platform. Every generator must have implemented, tested capability boundaries; none is registered today.

This is the product north star. The [visual-authoring contract](visual-authoring.md) and [implementation-target contract](implementation-targets.md) distinguish working behavior from future capabilities.

## The job we serve

A product-minded solo developer or small team should be able to make a feature precise enough for a person or agent to work on it without losing intent, constraints or open questions. A non-programmer can express meaning without editing JSON; an engineer can inspect contracts and custom implementation references.

Optimize for clear decisions, recoverable changes, reusable mechanisms and evidence. Do not optimize for graph size, generated-code volume, unexplained health percentages or impressive agent prose.

## Three layers, one product

| Layer | Responsibility |
| --- | --- |
| Product definition | Objects, relations, flows, rules, experience, business policies, constraints and acceptance. |
| Implementation definition | One or more explicit targets, architecture choices, pinned templates, bindings and custom boundaries. |
| Application artifacts | Code, configuration, tests and builds produced only by supported implementations. |

The user defines what is special about this product rather than rebuilding the foundation every time. Templates can provide repeated mechanisms such as navigation, catalog forms, persistence, history, export/import or entitlement wiring. A project still owns what its objects mean, what a flow changes, who gets access and how success is verified. A generic item model must not erase the differences between a bottle, plant, material and piece of equipment.

A feature is a useful working scope connecting the necessary objects, flows, rules, screens and verification. Product, Business and Architecture remain semantic views; they are not independent forms that must all be completed before any feature can be explored.

## Conceptual influences and boundaries

| Concept | Contribution | Boundary |
| --- | --- | --- |
| Sketchnote | Start with words, questions, assumptions and visual associations. | A drawing, group or proximity is not accepted meaning. |
| No-code | Ask what the product manages, does, shows and must not allow. | Only explicit supported definitions have mappings. |
| Low-code | Escape hatches with input/output, ownership and implementation references. | A reference is not permission to read, write or execute code. |
| n8n-inspired interaction | Inspectable steps, data, branches, reusable subflows and sample cases. | A product graph is not one automation workflow; no n8n runtime is embedded. |
| Contextd-inspired discipline | Task artifacts with source identity, inclusion reasons, gaps and budget boundaries. | Derived context is not another canonical model or mandatory agent runtime. |
| Semantic Model Studio | Work on a feature/object; change lenses without losing context. | Focus is semantic, not a required radial layout. |

These are influences, not compatibility claims. This direction imports no n8n, contextd, Hibi or external agent runtime. Existing design attribution remains in `THIRD_PARTY_NOTICES.md`.

## Progressive precision

**Sketch:** a note can remain a note and a question can remain unresolved. Stable source IDs preserve what was originally expressed. Untyped arrows are source/presentation information, not business rules or execution order.

**Model:** the human explicitly defines or reviews an interpretation. Reuse existing objects instead of duplicating them for each lens or target. Questions/assumptions require acknowledgement; original sources remain. New objects begin as drafts. Accepted meaning, implemented behavior and verified evidence are distinct states.

**Implementation:** select an environment and technical approach only when useful. Define inputs, outputs, failure cases, ownership and supported mappings. Targets may share product IDs but use different implementation references. A template owns only its generated output; custom code must not be overwritten by regeneration. Samples are test data, not the end user's real data.

Precision is progressive rather than a rigid wizard. Formalize the part being handed off, not every exploratory note. A user with a clear requirement should not be forced to draw sticky notes before defining it.

## Four kinds of connection

| Connection | Meaning | Runtime effect |
| --- | --- | --- |
| Sketch arrow | Visual association. | None. |
| Semantic relation | A rule constrains a feature; a screen supports a flow. | None by default. |
| Control flow | Explicit next step/branch in a supported workflow. | Only via a validated execution plan. |
| Data flow | Typed output-to-input mapping. | Only via a compatible runner/compiler. |

A visual group is not automatically a module, transaction or permission boundary. A conceptual cycle is not universally an error. Product behavior and the development process (context → proposal → review → code → test) are different workflow subjects, even when linked.

## Reuse without hiding decisions

- **Pattern / blueprint:** reusable structure for the product model.
- **Knowledge pack:** guidance for agent judgment, constraints and verification.
- **Implementation template:** reusable mechanisms/conventions for a particular target.
- **Binding:** a project's explicit connection from product meaning to a supported slot or custom extension.

Do not infer generator support from a template filename or a language string. A mapping should reveal whether it is a declaration, needs configuration, is deferred, or requires custom implementation. A target that cannot meet a constraint must report it rather than silently changing the product.

Pin template identity/version and show changes before upgrading. One successful template test does not verify every project's business rules. Graph views may show template-provided structure on demand without forcing users to maintain hundreds of internal nodes.

## Human-agent loop

```text
Sketch / source → Explicit definition → Exact proposal review → Product model
                                                              │
                                Task + optional target context build
                                                              │
                                                      External agent
                                                              │
                                      Model proposal / code / evidence
                                                              │
                                                         Human review
```

Graph and documents retain accepted decisions; chat is not their only home. Agents are consumers/contributors through tools, not necessarily graph nodes. Model approval, code approval, credential access, code execution and publishing permission are separate decisions. Exported context grants none of these permissions; that declaration is not a sandbox for separately privileged clients.

## Ownership of information

| Information | Owner |
| --- | --- |
| Product meaning | Canonical JSON graph and its explicit relationships. |
| Long-form source knowledge | Markdown files. |
| Exploratory notes | Sketch source with stable IDs. |
| Deployment choices | `implementation/targets.json`, referencing product IDs. |
| Layout / camera | Presentation, not business meaning. |
| Task context | Derived artifact, never a new source of product truth. |
| Generated/custom code | Explicit separate ownership through target contracts. |
| Test/run results | Evidence bound to source/code/build versions. |

The project catalog only points to folders. It is not a cross-project graph. Opening a second target does not copy the product model. Removing a target does not delete product objects or custom files.

## Context is more than the visible canvas

An explicit task and roots select product context. Global constraints, linked source sections, accepted decisions and verification can matter outside the visible neighborhood. A lens cannot hide mandatory constraints from an agent. Implementation tasks add only the selected target and related bindings; pure product tasks need no platform.

Keep included/excluded reasons, gaps and provenance visible. Hashes identify content, not truth. Budget estimates state their accounting boundary; required content is not silently trimmed. Product-only and target-aware context share the same source-selection builder rather than growing competing engines.

## What works now, and what remains

**Implemented:** local multi-project Studio; focus/lenses; read-only Markdown with document context; text-card sketching and explicit no-code definition proposals; reviewed Apply; task-context builds; multiple target configuration; pinned template declaration checks; per-target binding review and target-context export.

**Not implemented:** freehand interpretation, automatic agent reasoning inside Studio, general rule/condition builders, type-checked control/data ports, workflow/sample-data runtime, template graph instantiation, editable document sessions, multi-module template composition, cloud collaboration or executable application generators for SwiftUI or any other target.

The next implementation milestone should validate one narrow end-to-end target adapter without changing the technology-neutral product core. Evidence should demonstrate a feature is correctly implemented and tested, not just that files were generated.

**Build shared meaning first. Choose implementation deliberately. Verify the result.**
