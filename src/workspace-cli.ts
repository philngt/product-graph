import os from "node:os";
import path from "node:path";
import { startWorkspaceServer } from "./workspace-server.ts";

const [home = process.env.PRODUCT_GRAPH_HOME || path.join(os.homedir(), ".productgraph"), portText = "4173", ...extra] = process.argv.slice(2);
const port = Number(portText);
if (extra.length || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Usage: npm run workspace -- [catalog-directory] [port]");
  process.exitCode = 2;
} else {
  const server = startWorkspaceServer(path.resolve(home), port);
  server.on("error", error => { console.error(error.message); process.exitCode = 1; });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close());
}
