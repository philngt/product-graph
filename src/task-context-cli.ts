import path from "node:path";
import { assertProjectFiles } from "./local-files.ts";
import { buildTaskContext } from "./task-context.ts";

// Read-only adapter: no materialization, model changes, or agent execution.
const [directory, rootId, task, format = "json", ...extra] = process.argv.slice(2);
if (!directory || !rootId || !task || extra.length || !["json", "markdown"].includes(format)) {
  console.error('Usage: npm run context:task -- <project-folder> <root-node-id> "task" [json|markdown]');
  process.exitCode = 2;
} else {
  try {
    const root = path.resolve(directory);
    assertProjectFiles(root);
    const result = buildTaskContext(root, { task, rootIds: [rootId] });
    process.stdout.write(format === "markdown" ? result.markdown : `${JSON.stringify(result.artifact, null, 2)}\n`);
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
