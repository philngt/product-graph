import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadGraph } from "./io.ts";
import { localPath, readBounded, LocalError } from "./local-files.ts";

const ROOTS = ["documents", "projections", "agent-context"];
const markdown = /\.(md|markdown)$/i;
export interface DocumentEntry {
  path: string; title: string; kind: "source" | "generated"; available: boolean;
  bytes?: number; modifiedAt?: string; nodeIds: string[]; documentIds: string[];
}
interface Heading { level: number; title: string; line: number }
const permitted = (file: string) => ROOTS.includes(file.split("/")[0]) && markdown.test(file) && !file.split("/").some(part => !part || part.startsWith(".") || part === "node_modules");

/** A deliberately small Markdown reader, not a CommonMark parser or rich-text editor. */
export function documentStructure(source: string, file: string): { headings: Heading[]; targets: string[] } {
  const headings: Heading[] = [], targets = new Set<string>();
  const lines = source.split(/\r?\n/);
  let fence = "", frontmatter = lines[0]?.trim() === "---";
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (frontmatter) { if (index && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false; continue; }
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/);
    if (heading) headings.push({ level: heading[1].length, title: heading[2], line: index + 1 });
    // Inline links only; no reference links, HTML or wikilinks. Code spans are excluded.
    const prose = line.replace(/`+[^`]*`+/g, "");
    for (const match of prose.matchAll(/(?<!!)\[[^\]\n]+\]\(([^\s()]+)\)/g)) {
      let target: string;
      try { target = decodeURIComponent(match[1].split(/[?#]/)[0]); } catch { continue; }
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(target) || target.includes("\\") || target.includes("\0")) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      if (permitted(resolved)) targets.add(resolved);
    }
  }
  return { headings, targets: [...targets] };
}

function scan(root: string) {
  const graph = loadGraph(root);
  const files = new Map<string, { entry: DocumentEntry; content: string }>();
  const notices: string[] = [];
  let bytes = 0, examined = 0, truncated = false;
  const limit = () => files.size >= 500 || bytes >= 8 * 1024 * 1024 || examined >= 3000;
  function walk(relative: string, depth = 0) {
    if (limit()) { truncated = true; return; }
    let directory: string;
    try { directory = localPath(root, relative); if (!fs.existsSync(directory)) return; if (!fs.statSync(directory).isDirectory()) { notices.push(`Not a document folder: ${relative}`); return; } }
    catch { notices.push(`Skipped unsafe folder: ${relative}`); return; }
    if (depth > 12) { truncated = true; return; }
    for (const child of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (limit()) { truncated = true; return; }
      examined++;
      if (child.name.startsWith(".") || child.name === "node_modules" || child.isSymbolicLink()) continue;
      const file = `${relative}/${child.name}`;
      if (child.isDirectory()) { walk(file, depth + 1); continue; }
      if (!child.isFile() || !permitted(file)) continue;
      try {
        const absolute = localPath(root, file), content = readBounded(absolute, 1024 * 1024);
        const length = Buffer.byteLength(content);
        if (bytes + length > 8 * 1024 * 1024) { truncated = true; return; }
        bytes += length;
        const records = graph.documents.filter(document => document.path === file);
        const recordIds = records.map(document => document.id);
        const nodeIds = new Set(records.flatMap(document => document.links || []));
        for (const node of graph.nodes) if (node.document === file || recordIds.includes(node.document || "")) nodeIds.add(node.id);
        files.set(file, { content, entry: { path: file, title: records[0]?.title || path.posix.basename(file), kind: file.startsWith("documents/") ? "source" : "generated", available: true, bytes: length, modifiedAt: fs.statSync(absolute).mtime.toISOString(), nodeIds: [...nodeIds], documentIds: recordIds } });
      } catch { notices.push(`Unreadable, oversized or non-UTF-8 document: ${file}`); }
    }
  }
  ROOTS.forEach(relative => walk(relative));
  const documents = [...files.values()].map(value => value.entry);
  // Missing records are visible; reading them never broadens the allowed roots.
  for (const record of graph.documents) if (!files.has(record.path) && !documents.some(item => item.path === record.path)) {
    documents.push({ path: record.path, title: record.title, kind: record.path.startsWith("documents/") ? "source" : "generated", available: false, nodeIds: record.links || [], documentIds: [record.id] });
  }
  return { graph, files, documents, notices, truncated };
}

export function listDocuments(root: string) {
  const { documents, notices, truncated } = scan(root);
  return { documents, notices, truncated, source: "saved", limits: { files: 500, bytesPerFile: 1048576, totalBytes: 8388608 }, capabilities: { editing: false, fullMarkdownParsing: false, liveWatching: false } };
}
export function readDocument(root: string, file: string) {
  if (!permitted(file)) throw new LocalError(400, "Choose a Markdown document under documents/, projections/ or agent-context/");
  localPath(root, file);
  const { graph, files, truncated } = scan(root);
  const value = files.get(file);
  if (!value) throw new LocalError(404, "Document is unavailable or outside the bounded document index");
  const structure = documentStructure(value.content, file);
  const links = structure.targets.map(target => ({ path: target, title: files.get(target)?.entry.title || target, available: files.has(target) }));
  const backlinks = [...files].filter(([other, data]) => other !== file && documentStructure(data.content, other).targets.includes(file)).map(([, data]) => data.entry);
  return { ...value.entry, content: value.content, revision: `sha256:${createHash("sha256").update(value.content).digest("hex")}`, source: "saved", headings: structure.headings, links, backlinks, nodes: graph.nodes.filter(node => value.entry.nodeIds.includes(node.id)), truncated, limitations: ["Read-only source; no HTML rendering or external media requests.", "Outline supports ATX headings; local inline Markdown links only. Reference links and wikilinks are not indexed.", "Saved files only. Refresh to see external edits; indexing is bounded."] };
}
