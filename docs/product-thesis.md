# Product Graph thesis: a shared model for humans and agents

**Tự do khi suy nghĩ. Có cấu trúc khi định nghĩa. Có kiểm chứng khi triển khai.**

Product Graph is a local workspace where people and agents define, develop and verify a product through a shared visual model. People can begin with words, questions and connections rather than a schema. Meaning becomes explicit through review. Selected parts of that model become agent context and, when a supported compiler exists, application artifacts.

The graph is not simply a diagram attached to a specification. It is where an intent is expressed, interpretations are proposed, decisions become inspectable, and implementation evidence can be traced back to the product. Chat is a conversation channel, not the only place where accepted decisions live.

This document is the product north star. **It is not a claim that every capability below is implemented.** The capability table and [implementation contract](visual-authoring.md) define the shipped slice.

## Who and what we optimize for

The first audience is a product-minded solo developer or small team using coding agents to build several local-first applications. The first application-generation target remains a narrow SwiftUI template, not every platform or every type of software. A non-programmer should be able to express a feature and make product decisions without editing JSON, while an engineer can inspect contracts and implementation references.

The dominant user job is: “Help me make this part of the product precise enough that another person or agent can work on it without losing its intent, constraints or open questions.”

We optimize for task completion, understandable decisions, recoverable changes, and useful evidence. We do not optimize for the number of graph nodes, amount of generated code, an unexplained health percentage, or the sophistication of agent prose.

## What we combine, and what we do not copy

| Concept | Contribution | Boundary |
| --- | --- | --- |
| Sketchnote | Start with short notes, questions and visual connections. | A drawing or proximity is not automatically accepted meaning. Freehand input is a future capability. |
| No-code | Forms that ask what the app manages, does, shows and must not allow. | Only supported definitions have explicit mappings. No promise of arbitrary app generation. |
| Low-code | Escape hatches with inputs, outputs, ownership and implementation references. | A reference is not executable code, nor permission to read or execute it. |
| n8n-style workflow interaction | Inspectable inputs/outputs, branches, reusable subflows and sample cases. | The whole product graph is not an automation workflow. No n8n runtime is embedded. |
| Contextd-style build discipline | A task-specific artifact with source identities, inclusion reasons and gaps. | No second canonical graph or mandatory agent runtime. |
| Semantic Model Studio | Focus on a feature/object, change lenses without losing context, widen to All models. | Focus is semantic, not necessarily a radial geometric layout. |

These are conceptual influences. This slice imports no n8n, Hibi, contextd, Excalidraw or external agent runtime code. Existing Design Studio AI attribution remains in `THIRD_PARTY_NOTICES.md`.

## Three degrees of precision

### 1. Sketch: useful ambiguity

A person writes “Suggest a bottle I have not used recently”, draws a connection to “Record usage”, and asks “What if every bottle is excluded?” A question must be allowed to remain a question. Capturing it does not create a domain invariant or accepted requirement.

Sketch elements have stable IDs and retain the original text. Their position and untyped arrows are presentation/source information. They can be included in task context only with an explicit unconfirmed label. Empty spaces and missing definitions must not be filled with invented facts.

### 2. Model: explicit, reviewable meaning

The person chooses which sketch elements become features, entities, rules, screens or acceptance criteria, and which refer to existing objects. Relationships are selected explicitly. An assumption or question requires an acknowledgement of its proposed interpretation; that acknowledgement is not a verification result.

An agent may propose the same kind of mapping through a future adapter. It must show its interpretation and source, not silently promote speculation. The original sketch remains available after application, with provenance linking it to the proposed meaning.

**Human approval accepts a model change, not evidence that the requirement is true.** New objects start as drafts. “Reviewed”, “implemented” and “verified” must stay distinct.

### 3. Implementation: supported contracts and evidence

A buildable part of the model eventually defines inputs, outputs, behavior, failure cases, ownership and a supported target mapping. Sample data belongs to a test case, not the user's real application data. Simulation results and device/runtime test results must be distinguished.

Generated code and custom implementation have separate ownership. A template can regenerate its own artifacts but must not overwrite custom code. Low-code expressions require a bounded language and validation; arbitrary code requires a separate execution boundary. Neither is implemented by merely storing a function reference.

Precision is progressive, not a global wizard. Formalize the part being handed off; keep unused alternatives and exploratory notes as sketches.

## Four kinds of connections

| Connection | Meaning | Runtime effect |
| --- | --- | --- |
| Sketch arrow | A visual association chosen by a person. | None. |
| Semantic relation | For example, a rule constrains a feature or a screen supports a workflow. | None by default. |
| Control flow | An explicit next step or branch in a supported workflow. | Only through a defined execution plan. |
| Data flow | A typed mapping from an output to another input. | Only after compatibility checks in a supported runner/compiler. |

A visual group is not automatically a module, transaction or authorization boundary. A `constrains` edge does not mean “execute the rule node and then execute the feature node”. Cycles in a conceptual model are not universally errors.

There are also two different workflow subjects: the behavior of the application being designed, and the development process (build context, obtain a proposal, review, generate, test). They can reference each other but must not become one untyped workflow.

## The human-agent collaboration loop

```text
Capture source → Select scope → Define/propose meaning → Review exact change
                                                      ↓
                                               Canonical model
                                                      ↓
                                  Build task context + source manifest
                                                      ↓
                                                External agent
                                                      ↓
                                      Proposal / implementation evidence
                                                      ↓
                                                 Human review
```

The canvas is a shared work surface. The agent is normally a consumer/contributor through tools, not necessarily a node in the product model. An agent becomes a workflow node only when the actual product/workflow has an agent step.

Permission gates are separate: accepting a graph diff, accepting a code change, running code, accessing credentials, and publishing an app are different decisions. Context exports explicitly grant no execution, write or external-access permission. That declaration is an interface boundary, not a sandbox that can prevent a separately privileged tool from acting.

## One owner for each kind of information

| Information | Owner / storage |
| --- | --- |
| Accepted product structure | Canonical JSON graph. |
| Exploratory notes and visual links | Separate sketch source with stable IDs. |
| Long-form source knowledge | Markdown documents. |
| Layout and camera | Presentation state; no business meaning inferred from coordinates. |
| Task context | Derived artifact, never a new source of product truth. |
| Generated application | Target artifact with graph/source mapping. |
| Run/test results | Evidence bound to the source/build version. |

The project catalog only points at project folders. It is not a cross-project semantic graph. Project Graph IDs, sketch IDs and context build IDs have different meanings. Views reference the same product objects rather than copying them into separate Workflow/Domain/Architecture models.

## Focus is not the whole agent context

A focus helps navigation. A task may also need global constraints, a decision outside the neighborhood, linked source sections and acceptance criteria. A Domain lens must not hide mandatory Experience or Architecture constraints from an agent handoff.

Context builds require an explicit task and roots. They show what was selected, what was omitted, why, and what remains unresolved. Source hashes describe identity, not truth. A fixed build identity must bind the source content and projection request; timestamps and layout are not evidence of implementation correctness.

Required material must not be silently trimmed to fit a budget. Missing or excluded material produces a gap, not an invented substitute. Approximate character or token counts must be labelled as estimates with their accounting boundary.

## Golden path implemented by this slice

1. Open an existing project and choose **Sketch & define**.
2. Capture a note, question or assumption, arrange the cards and add an untyped arrow.
3. Save the sketch. The product graph is unchanged.
4. Select cards; choose new object kinds or reuse existing objects; choose the meaning of each selected arrow. Optional implementation declarations stay inert.
5. Create a pending proposal. Inspect new objects, relations, exact commands and original source notes.
6. Acknowledge the review and Apply. Stale graph, sketch or proposal versions are refused. Accepted objects enter the existing model as drafts.
7. Choose a task root and task. Build context from saved model/source material, inspect gaps and provenance, and export JSON or Markdown for an external agent.

This is a concrete authoring/handoff loop, not a no-code application runtime.

## Capability boundary

| Available in this slice | Deliberate follow-up |
| --- | --- |
| Text cards; note/question/assumption labels; untyped arrows; positions; sketch Undo/Redo and checked save. | Freehand ink, images/OCR, rich whiteboard components. |
| Explicit no-code definition forms; reuse existing objects; reviewed semantic proposal. | Agent-generated interpretations and domain-specific rule/condition builders. |
| Input/output/implementation-reference declarations. | Type-checked data ports, expression evaluation or custom-code execution. |
| Inspectable source snapshot and exact proposal review. | Full ghost-node/side-by-side visual diff for arbitrary transformations. |
| Task context with linked Markdown, mandatory constraints, identities, trace and gaps; HTTP/CLI/export. | Contextd packs adapter, broader policy/lifecycle engine, new MCP context-build tool. |
| Existing model lenses and local multi-project isolation. | Workflow runner, sample-data simulator, live collaboration or SwiftUI compiler. |

A button or diagram must not imply a capability in the right column already exists. Future execution should be introduced as a separate reviewed slice with tests of side effects and permission boundaries.

## Evidence and next decision

A useful release must demonstrate: a person can define one feature without editing JSON; questions are not promoted silently; existing objects can be reused; rejecting a proposal preserves sources; stale writes preserve drafts; task context includes global constraints and actual linked source content; project B cannot consume project A's local source by accident.

The next decision is whether the authoring loop helps people make better product decisions on real tasks. Then add typed workflow/sample-case support for one narrow template. Do not first build a general automation platform.

## Reference trail

- [Product Graph's existing Studio contract](semantic-model-studio.md), [multi-project boundary](multi-project-workspace.md), and [Hibi research](hibi-document-management.md).
- [contextd build-system model](https://github.com/philngt/contextd/blob/7c621a51fc35ac1d99ce5e7a98ac09094ab5b19f/docs/build-system-model.md): derived artifacts, retained builds and provenance.
- [contextd decision-first context](https://github.com/philngt/contextd/blob/7c621a51fc35ac1d99ce5e7a98ac09094ab5b19f/docs/decision-context.md): preserve mandatory facts/constraints and defer optional teaching.
- [n8n documentation source](https://github.com/n8n-io/n8n-docs): conceptual inspiration for inspectable steps, sample data and reusable subflows, not an imported engine or compatibility claim.

**Build shared meaning first. Make implementation explicit. Verify the result.**
