import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class LocalError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Resolve an existing or future project-relative path without following symlinks. */
export function localPath(root: string, relative: string): string {
  if (!relative || relative.includes("\\") || relative.includes("\0") || path.isAbsolute(relative)) throw new LocalError(400, "Expected a project-relative path");
  const parts = relative.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new LocalError(400, "Invalid path segment");
  let current = fs.realpathSync(root);
  for (const part of parts) {
    current = path.join(current, part);
    if (fs.existsSync(current) || (() => { try { return fs.lstatSync(current).isSymbolicLink(); } catch { return false; } })()) {
      if (fs.lstatSync(current).isSymbolicLink()) throw new LocalError(400, "Symbolic links are not supported in project data");
    }
  }
  return current;
}

export function readBounded(file: string, limit = 1024 * 1024): string {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw new LocalError(413, `File must be a regular file no larger than ${limit} bytes`);
    const bytes = Buffer.alloc(limit + 1);
    let count = 0;
    while (count <= limit) { const n = fs.readSync(fd, bytes, count, bytes.length - count, null); if (!n) break; count += n; }
    if (count > limit) throw new LocalError(413, "File grew beyond the reading limit");
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, count)); }
    catch { throw new LocalError(400, "Only UTF-8 text is supported"); }
  } finally { fs.closeSync(fd); }
}

/** Atomic replacement of one file; this is not a multi-file transaction. */
export function atomicText(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, text, { flag: "wx", mode: 0o600 }); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function assertProjectFiles(root: string): void {
  localPath(root, "project.json");
  const directories = ["graph/nodes", "graph/edges", "graph/documents", "layout", "focus-areas", "tours", "patterns", "templates", "agent-context/proposals"];
  for (const relative of directories) {
    const directory = localPath(root, relative);
    if (!fs.existsSync(directory)) continue;
    if (!fs.statSync(directory).isDirectory()) throw new LocalError(400, `Expected directory: ${relative}`);
    const files = fs.readdirSync(directory).filter(name => name.endsWith(".json"));
    if (files.length > 5000) throw new LocalError(413, `Too many records in ${relative}`);
    for (const name of files) {
      const file = localPath(root, `${relative}/${name}`);
      if (!fs.statSync(file).isFile() || fs.statSync(file).size > 1024 * 1024) throw new LocalError(413, `Record too large: ${relative}/${name}`);
    }
  }
  readBounded(localPath(root, "project.json"));
}
