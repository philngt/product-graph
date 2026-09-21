import fs from "node:fs";
import type { ProjectAdapter } from "./types.ts";

export const localAdapter: ProjectAdapter = {
  name: "local",
  version: "1.0.0",
  capabilities: ["filesystem", "graph", "documents"],
  detect: (projectRoot) => fs.existsSync(`${projectRoot}/project.json`),
};
