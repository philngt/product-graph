# Product brief

Status: product direction plus the [source-inspected implementation baseline](README.md#baseline-and-status). Customer and commercial statements below are hypotheses, not measured market results.

## Product and problem

Product Graph is a local visual workspace in which people and coding agents define a product through shared objects, flows, rules and experience. A feature becomes precise through explicit interpretation and review; a task-specific subset becomes a traceable agent handoff. Implementation targets reference the same model instead of duplicating it for each technology.

The problem hypothesis is that product intent, notes, diagrams, specifications, agent conversations and code often drift apart. A developer repeatedly explains decisions and recreates common foundations; a non-programmer can express an idea but struggles to make its implications explicit. Product Graph should reduce that coordination work without requiring everyone to become an ontology designer.

## Audience and job

The initial audience is product-minded solo developers and small teams using coding agents across several projects. People without programming expertise should be able to express a feature and review its meaning, while engineers inspect contracts and custom implementation boundaries. This is a target audience, not a claim of validated adoption.

Primary job: **Make this part of the product clear enough for another person or agent to work on it without losing intent, constraints or open questions.**

Secondary jobs are to find why a rule exists, reuse an existing object, understand related changes, keep several projects separate, and prepare different implementation handoffs from the same product model.

## Value proposition

The graph is a shared model, not just a picture. Source notes survive interpretation. Decisions can be linked to product objects. Context includes actual linked source text, mandatory constraints and visible gaps. Targets preserve implementation choices without turning them into universal domain rules.

Templates are intended to supply repeated mechanisms such as navigation, persistence, forms or history. The product still owns object meaning, business policy and observable outcomes. Current template support covers pinned declarations and mapping checks, **not implementation generation**.

## Working product boundary

| Available capability | Value and limit |
| --- | --- |
| Local projects and focus-first Studio | Navigate several project folders; focus/lenses are views of one model per project. No real-time collaboration. |
| Text-card sketch → definition → proposal | Capture notes/questions/assumptions and explicitly map them to draft objects. No freehand interpretation or built-in model call. |
| Graph authoring and review | Edit objects/relations, inspect exact proposed commands, save and undo local graph edits. Review is not proof of business correctness. |
| Documents reader | Read Markdown with outline/backlinks and linked objects. Not a document editor or semantic parser of prose. |
| Product task context | Select roots, constraints and linked source; expose hashes, trace and gaps. No automatic agent execution. |
| Multiple implementation targets | Bind product IDs to pinned template slots, custom references or deferred choices. All mappings remain declarations. |

The [user flows](user-flows.md) show how to use this boundary. [Detailed contracts](README.md#detailed-contracts-and-reference-research) define limits.

## Non-goals for the current product

Do not become a general drawing suite, project-management system, hosted agent control plane or automation platform. Do not promise arbitrary no-code generation, universal framework support, perfect code-to-model round-tripping or safe execution of untrusted code. No database/service migration is justified merely by calling the product a graph.

## Product principles

Start informally; formalize only the part being handed off. Select a feature before asking which layer to edit. Reuse identities across views and targets. Separate semantic links from control/data flow. Show missing information rather than inventing it. Preserve custom ownership. Keep source files portable. Treat model approval, code approval and execution permission separately. The [thesis](product-thesis.md) is the canonical statement of these principles.

## Commercial hypothesis

The business model **for Product Graph itself is not decided**. It is different from the Business region used to model a customer's product. Local authoring could be the base offering, while a maintained template library, team workflow or advanced verification could become paid value. These are options to investigate, not commitments, shipped entitlements or price recommendations.

Before setting a paid boundary, test whether users repeatedly complete the authoring/handoff loop, whether reusable mechanisms actually save work, and what maintenance/support costs arise. Do not add paywalls, telemetry or account requirements based solely on this brief. A future pricing decision needs evidence and a recorded rationale.

## Success and validation plan

Use observable tasks rather than node counts or an unexplained health score. In an explicit study, ask a person to define one feature without editing JSON, keep a question unresolved, reuse an object, reject a proposal without losing notes, and hand off context containing the right constraints. Compare against their existing document/prompt workflow using the same task and tools.

Record task completion, assistance needed, missed constraints, rework and ability to explain a decision. Separately evaluate implementation outcomes and target-specific tests; context-selection tests do not prove agent quality. No baseline numbers, conversion goals or measured improvements are asserted here. Collection of study or usage data requires a separate consent/privacy decision.

Next priorities and exit conditions live in the [roadmap](roadmap.md), not in a fixed delivery-date promise.
