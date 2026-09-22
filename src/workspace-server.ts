import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProjectRegistry } from "./project-registry.ts";
import { createProjectHandler } from "./server.ts";
import { LocalError } from "./local-files.ts";
import { guardLocalRequest, json, readBody } from "./local-http.ts";

const ui = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui");
const projectId = /^[a-f0-9-]{36}$/;

export function createWorkspaceHandler(home: string) {
  const registry = new ProjectRegistry(home);
  return async (request: http.IncomingMessage, response: http.ServerResponse) => {
    try {
      guardLocalRequest(request);
      const url = new URL(request.url || "/", `http://${request.headers.host}`);
      if (url.pathname === "/api/projects" && request.method === "GET") return json(response, 200, { projects: registry.list(), managedDirectory: path.join(registry.home, "projects") });
      if (url.pathname === "/api/projects" && request.method === "POST") {
        const input = JSON.parse(await readBody(request, 16384));
        const project = registry.create(input.name, input.description);
        return json(response, 201, { project });
      }
      if (url.pathname === "/api/projects/open" && request.method === "POST") {
        const input = JSON.parse(await readBody(request, 16384));
        return json(response, 200, { project: registry.register(input.path) });
      }
      const scoped = url.pathname.match(/^\/api\/projects\/([^/]+)(\/.*)?$/);
      if (scoped) {
        const id = scoped[1], suffix = scoped[2] || "";
        if (!projectId.test(id)) throw new LocalError(404, "Unknown project");
        if (!suffix && request.method === "DELETE") { registry.forget(id); return json(response, 200, { removedFromCatalog: true, filesDeleted: false }); }
        if (suffix === "/visit" && request.method === "POST") { registry.visit(id); return json(response, 200, { ok: true }); }
        // Resolve for THIS request. Never store a mutable server-wide active project.
        const root = registry.resolve(id);
        if (!suffix && request.method === "GET") return json(response, 200, { project: registry.list().find(item => item.id === id) });
        const allowed = /^\/(workspace|graph|context|agent-context|compare|commands|proposals(?:\/[^/]+(?:\/(?:preview|apply|reject))?)?|documents(?:\/read)?)$/;
        if (!allowed.test(suffix)) throw new LocalError(404, "Unknown project endpoint");
        request.url = `/api${suffix}${url.search}`;
        return await createProjectHandler(root, { requireRevision: true })(request, response);
      }
      if (url.pathname.startsWith("/api/")) throw new LocalError(404, "Choose a project; unscoped project API requests are not allowed in workspace mode");
      if (request.method !== "GET") throw new LocalError(405, "Method not allowed");
      let relative: string;
      const studio = url.pathname.match(/^\/project\/([a-f0-9-]{36})\/?$/);
      if (studio) { registry.resolve(studio[1]); relative = "index.html"; }
      else relative = url.pathname === "/" ? "projects.html" : url.pathname.slice(1);
      if (!/^[a-zA-Z0-9_-]+\.(html|js|css)$/.test(relative)) throw new LocalError(404, "Not found");
      const file = path.join(ui, relative);
      if (!fs.existsSync(file)) throw new LocalError(404, "Not found");
      const type = file.endsWith(".html") ? "text/html" : file.endsWith(".css") ? "text/css" : "text/javascript";
      response.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" });
      response.end(fs.readFileSync(file));
    } catch (error) {
      json(response, error instanceof LocalError ? error.status : error instanceof SyntaxError ? 400 : 500, { message: (error as Error).message });
    }
  };
}
export function startWorkspaceServer(home: string, port = 4173): http.Server {
  const server = http.createServer(createWorkspaceHandler(home));
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    console.log(`Product Graph projects: http://127.0.0.1:${typeof address === "object" ? address?.port : port}`);
  });
  return server;
}
