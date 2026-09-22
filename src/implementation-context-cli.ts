import path from "node:path";
import { loadImplementation } from "./implementation-targets.ts";
import { buildImplementationContext } from "./implementation-context.ts";
import { buildTaskContext } from "./task-context.ts";

const [directory, targetId, rootId, task, format = "json", ...extra] = process.argv.slice(2);
if (!directory || !targetId || !rootId || !task || extra.length || !["json", "markdown"].includes(format)) {
  console.error('Usage: context:target -- <project-directory> <target-id> <root-id> "task" [json|markdown]');
  process.exitCode = 2;
} else {
  try {
    const root = path.resolve(directory);
    const snapshot = loadImplementation(root);
    const result = buildImplementationContext(root, { targetId, expectedRevision: snapshot.revision, context: { task, rootIds: [rootId] } }, buildTaskContext);
    process.stdout.write(format === "json" ? `${JSON.stringify(result.artifact, null, 2)}\n` : result.markdown);
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
