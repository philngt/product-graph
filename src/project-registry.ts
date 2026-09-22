import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadGraph, writeJson } from "./io.ts";
import { atomicText, assertProjectFiles, LocalError, readBounded } from "./local-files.ts";

export interface RegisteredProject { id: string; root: string; name: string; addedAt: string; lastOpenedAt: string | null }
interface Registry { version: 1; projects: RegisteredProject[] }
export interface ProjectSummary extends RegisteredProject { available: boolean; description?: string; message?: string }
const uuid = /^[a-f0-9-]{36}$/;

/** The catalog stores locations only. Each folder remains its own canonical product. */
export class ProjectRegistry {
  home: string;
  file: string;
  constructor(home: string) {
    fs.mkdirSync(home, { recursive: true });
    this.home = fs.realpathSync(home);
    this.file = path.join(this.home, "projects.json");
  }
  private read(): Registry {
    if (!fs.existsSync(this.file)) return { version: 1, projects: [] };
    const value = JSON.parse(readBounded(this.file));
    if (value.version !== 1 || !Array.isArray(value.projects) || value.projects.length > 100 || value.projects.some((item: RegisteredProject) => !uuid.test(item.id) || typeof item.name !== "string" || !path.isAbsolute(item.root))) throw new LocalError(400, "Invalid project registry; restore the catalog from a backup");
    if (new Set(value.projects.map((item: RegisteredProject) => item.id)).size !== value.projects.length) throw new LocalError(400, "Duplicate registry IDs");
    return value;
  }
  private update<T>(change: (registry: Registry) => T): T {
    const lock = `${this.file}.lock`;
    let fd: number;
    try { fd = fs.openSync(lock, "wx"); } catch { throw new LocalError(409, "Project catalog is busy. Retry; remove a stale lock only after stopping other workspace processes."); }
    try { const registry = this.read(); const result = change(registry); atomicText(this.file, `${JSON.stringify(registry, null, 2)}\n`); return result; }
    finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  list(): ProjectSummary[] {
    return this.read().projects.map(project => {
      try {
        const root = this.resolve(project.id);
        const { manifest } = loadGraph(root);
        return { ...project, name: manifest.name || project.name, description: manifest.description, available: true };
      } catch (error) { return { ...project, available: false, message: String((error as Error).message) }; }
    }).sort((a, b) => (b.lastOpenedAt || b.addedAt).localeCompare(a.lastOpenedAt || a.addedAt) || a.id.localeCompare(b.id));
  }
  resolve(id: string): string {
    if (!uuid.test(id)) throw new LocalError(404, "Unknown project");
    const project = this.read().projects.find(item => item.id === id);
    if (!project) throw new LocalError(404, "Unknown project");
    if (!fs.existsSync(project.root)) throw new LocalError(410, "Project folder is unavailable. Open its new location or remove this catalog entry.");
    if (fs.realpathSync(project.root) !== project.root) throw new LocalError(409, "Project location changed; open it again explicitly");
    assertProjectFiles(project.root);
    return project.root;
  }
  register(input: string): RegisteredProject {
    if (typeof input !== "string" || !path.isAbsolute(input) || input.includes("\0") || input.length > 4096) throw new LocalError(400, "Enter an absolute folder path on the machine running Studio");
    let root: string;
    try { root = fs.realpathSync(input); } catch { throw new LocalError(404, "Project folder not found"); }
    try { assertProjectFiles(root); }
    catch (error) { if (error instanceof LocalError) throw error; throw new LocalError(400, "Not a readable Product Graph folder: project.json is required"); }
    const graph = loadGraph(root);
    if (!graph.manifest.projectId || !graph.manifest.name || !graph.manifest.schemaVersion) throw new LocalError(400, "Not a Product Graph project: invalid project.json");
    return this.update(registry => {
      const existing = registry.projects.find(project => project.root === root);
      if (existing) return existing;
      if (registry.projects.length >= 100) throw new LocalError(413, "This catalog supports up to 100 projects");
      const project = { id: randomUUID(), root, name: graph.manifest.name, addedAt: new Date().toISOString(), lastOpenedAt: null };
      registry.projects.push(project);
      return project;
    });
  }
  create(name: string, description = ""): RegisteredProject {
    if (typeof name !== "string" || !name.trim() || name.length > 120 || /[\r\n\0]/.test(name)) throw new LocalError(400, "Project name must contain 1–120 characters on one line");
    if (typeof description !== "string" || description.length > 2000) throw new LocalError(400, "Description is too long");
    const id = randomUUID();
    const directory = path.join(this.home, "projects");
    fs.mkdirSync(directory, { recursive: true });
    if (fs.realpathSync(directory) !== directory) throw new LocalError(400, "Managed projects directory must not be a symbolic link");
    const root = path.join(directory, id);
    fs.mkdirSync(root);
    try {
      for (const relative of ["graph/nodes", "graph/edges", "graph/documents", "documents", "layout", "focus-areas", "patterns", "templates", "agent-context/proposals"]) fs.mkdirSync(path.join(root, relative), { recursive: true });
      writeJson(path.join(root, "project.json"), { framework: "0.1.0", schemaVersion: "1.0.0", projectId: id, name: name.trim(), description });
      writeJson(path.join(root, "graph/nodes/product.json"), { id: "product:root", region: "product", type: "product", title: name.trim(), status: "draft", document: "document:overview" });
      writeJson(path.join(root, "graph/documents/overview.json"), { id: "document:overview", title: "Product overview", path: "documents/overview.md", links: ["product:root"] });
      fs.writeFileSync(path.join(root, "documents/overview.md"), `# Product overview\n\n${name.trim()}\n\n${description}\n\n## Intent\n\nDescribe the problem and desired outcome.\n`);
      return this.register(root);
    } catch (error) { fs.rmSync(root, { recursive: true, force: true }); throw error; }
  }
  visit(id: string): void {
    this.resolve(id);
    this.update(registry => { registry.projects.find(project => project.id === id)!.lastOpenedAt = new Date().toISOString(); });
  }
  forget(id: string): void {
    this.update(registry => {
      if (!registry.projects.some(project => project.id === id)) throw new LocalError(404, "Unknown project");
      registry.projects = registry.projects.filter(project => project.id !== id);
    }); // Deliberately never removes or relocates a project folder.
  }
}
