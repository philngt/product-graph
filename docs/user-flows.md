# User flows

Status: working flows at the [documentation baseline](README.md#baseline-and-status), followed by explicitly planned flows. The unit of work is a feature or another bounded product object; lenses are not mandatory wizard stages. The later [Editorial Studio update](studio-design.md) refines search, explicit forms, presentation focus and review without changing these source/permission boundaries.

## 1. Create or open a project — implemented

**Entry:** Projects home after `npm run workspace`.

Create a project with a name, or open an existing Product Graph folder by absolute path on the server's machine. The catalog remembers its location. Open its Studio page and return with **Projects** to choose another. Removing the catalog entry must not delete the folder.

When switching with unsaved graph/inspector changes, use Save and switch, Discard and switch, or Cancel. A failed save keeps the current session. This is not an OS-native folder picker or a multi-project in-memory draft manager. [Workspace contract](multi-project-workspace.md).

**Exit:** one project-bound Studio session; no model from another project is imported implicitly.

## 2. Sketch an idea and define meaning — implemented

**Entry:** Project tools → **Sketch & define**.

Capture Note, Question or Assumption cards. Arrange/select cards, add untyped arrows, then Save sketch. Select the part to formalize and choose **Define selection**. For each card, choose a supported object kind or reuse an existing object; acknowledge interpretations of questions/assumptions. Explicitly choose a semantic relation or leave an arrow untyped.

Create a pending proposal, inspect new objects, relations, exact commands and original source, acknowledge review, then Apply or Reject. New product objects are drafts. Sources remain after either action. Nothing is executed by defining input/output or a custom reference.

**Recovery:** save host model/inspector drafts first. If graph, sketch or reviewed proposal changed, preserve input and review current sources; never retry by suppressing revision checks. Closing protects uncaptured text/unsaved board changes, but does not persist every transient form choice. [Authoring contract](visual-authoring.md).

**Exit:** source notes plus either a reviewed model change or a retained unaccepted proposal.

## 3. Work on a feature across lenses — implemented with explicit forms

**Entry:** focus area, **Find anything** (`Command/Ctrl K`) or Show in model after a proposal. Project-wide search can inspect objects outside the visible lens; **Inspect** keeps focus while a **Focus** result deliberately changes it.

Click selects for inspection. **Focus here** changes the working scope. Change Product/Business/Workflow/Domain/Experience/Architecture lenses without changing object identity. Use Isolate, Expand +1 and All models as needed; Back/Forward restores navigation, not product edits.

**Add object** opens supported-kind/name/purpose fields. Creating in a focus requires choosing a semantic link; node and link form one undoable change. **Add relationship** searches existing objects by name instead of requiring a typed ID. Edit the selected object's supported properties and use advanced metadata only when necessary. Graph Undo/Redo changes the local graph/layout; **Save model** persists the full model, including hidden objects. Arrange/pin affects presentation, not ownership. Canvas focus (`Shift F`, Escape to exit) hides/inerts side panels without changing graph scope or dirty state.

**Recovery:** a lens/search-hidden selection stays inspectable. A deleted focus root produces an empty focus, not a silent whole-project fallback. Cancel a draft-discard prompt to keep unapplied inspector or new-object input. Failed saves retain working edits and display a persistent notice. **Review changes** exposes exact working-model before/after data; layout is explicitly outside that comparison.

**Limit:** specialized field, condition, branch and sample-case builders are planned. These explicit forms are not a full no-code workflow designer. [Studio contract](semantic-model-studio.md) and [design/interaction contract](studio-design.md).

## 4. Read source documents in context — implemented, read only

Open **Documents**, search by title/path, filter source/generated/linked-to-selection, and select a saved file. Use outline, local links/backlinks and linked objects to navigate. Return to the model without interpreting a Markdown link as a semantic edge.

**Recovery:** missing/unsafe/oversized sources are unavailable or limited, not replaced with invented text. Unsaved graph links are separate from saved document context. Edit source Markdown outside Studio for now; refresh saved inputs afterwards. No Markdown body is normalized, executed or edited by this reader. [Workspace contract](multi-project-workspace.md).

## 5. Build a product task handoff — implemented

**Entry:** Sketch tool → **Context for agent**, or the `context:task` CLI.

Save graph/inspector inputs. Choose an explicit root and describe the task. Include sketch notes only intentionally; they remain unconfirmed source. Build, then inspect mandatory constraints, linked source content, included/excluded reasons, gaps and budget accounting. Fix a blocking product ambiguity or deliberately hand off an investigation instead of calling the feature implemented.

Export JSON/Markdown from the same retained build. Required context is independent of the current UI lens. Private source still requires review before sending it to an external agent.

**Exit:** traceable context, not an agent run or code change. [Agent workflow](agent-workflow.md).

## 6. Configure an implementation and hand it off — implemented as declarations

Open **Targets**, add an explicit target role/environment and optional technical choices. Bind existing product objects to a pinned template slot, custom reference or deferred implementation. Save target configuration separately, then review missing/drifted/incompatible definitions and mappings.

Choose **Build target context**, task and root; review/export. The selected target is composed with product context; other targets' custom references are not copied into that declaration payload.

**Recovery:** save host drafts first; stale target saves preserve the modal input. Use Refresh saved inputs and reconcile. Re-pin a changed template deliberately. Deleting a target removes configuration only. Missing object bindings remain review findings.

**Exit:** implementation choices and target-aware context. A `mapped-declaration` is not buildability; Generate application remains unavailable. [Target contract](implementation-targets.md).

## 7. Receive changes and iterate — partly implemented

An external agent may use existing MCP tools to create a model proposal. Review exact commands/source in Studio and Apply or Reject. Code changes and application tests currently happen in external development tools; do not present them as a built-in Product Graph pipeline. Update the model deliberately when accepted product meaning changes.

When source/model choices change, build a new handoff instead of reusing a stale artifact as current. Compare/related-impact views help inspect known relationships; they are not complete causal source-code impact analysis.

## Planned application-delivery flow

```text
Choose a supported target adapter
  → Validate complete mappings and custom boundaries
  → Preview generated files and source mapping
  → Accept code changes with separate ownership
  → Build/test in the target environment
  → Attach versioned evidence
  → Review release permission separately
```

No generator, workflow simulation, automated evidence ingestion or publish runner exists yet. The next adapter must demonstrate one small feature end to end, not claim support from a framework dropdown.

## Acceptance walkthrough for contributors

Use two temporary projects, never personal data. Define one feature from a note, keep a question unresolved, reuse an object, reject a proposal and confirm notes survive. Switch lenses with a draft; test Cancel and failed-save recovery. Read a linked document, build task context, configure two targets referencing the same object, and export one target without the other's custom declarations. Delete a target and confirm the object still exists. See [verification](verification.md) for recording evidence and fixture limitations.
