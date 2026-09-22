import type http from "node:http";
import { guardLocalRequest, readBody, json } from "./local-http.ts";
import { LocalError } from "./local-files.ts";
import { loadImplementation, saveImplementation } from "./implementation-targets.ts";
import { buildImplementationContext } from "./implementation-context.ts";
import { buildTaskContext } from "./task-context.ts";

/** Project root is resolved by the existing router, never accepted from a request body. */
export async function handleImplementationRequest(root: string, request: http.IncomingMessage, response: http.ServerResponse): Promise<boolean> {
  const pathname = (request.url || "").split("?")[0];
  if (!["/api/implementation", "/api/implementation/context"].includes(pathname)) return false;
  guardLocalRequest(request);
  if (pathname === "/api/implementation" && request.method === "GET") json(response, 200, loadImplementation(root));
  else if (pathname === "/api/implementation" && request.method === "POST") json(response, 200, saveImplementation(root, JSON.parse(await readBody(request, 2 * 1024 * 1024))));
  else if (pathname === "/api/implementation/context" && request.method === "POST") json(response, 200, buildImplementationContext(root, JSON.parse(await readBody(request, 16384)), buildTaskContext));
  else throw new LocalError(405, "Method not allowed");
  return true;
}
