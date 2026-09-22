import type http from "node:http";
import { LocalError } from "./local-files.ts";

/** Local-only service: no wildcard hosts, CORS, or cross-origin filesystem writes. */
export function guardLocalRequest(request: http.IncomingMessage): void {
  const host = request.headers.host || "";
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) throw new LocalError(403, "Only a loopback Host is allowed");
  const origin = request.headers.origin;
  if (origin && origin !== `http://${host}`) throw new LocalError(403, "Cross-origin requests are not allowed");
  if (request.headers["sec-fetch-site"] === "cross-site") throw new LocalError(403, "Cross-site requests are not allowed");
  if (!["GET", "HEAD"].includes(request.method || "") && !(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) throw new LocalError(415, "Writes require application/json");
}
export async function readBody(request: http.IncomingMessage, maxBytes = 8 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxBytes) throw new LocalError(413, "Request body is too large");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function json(response: http.ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}
