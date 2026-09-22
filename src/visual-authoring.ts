/** Sketch data is authored source, never executable or automatically accepted meaning.
 * All public inputs are validated here; HTTP and future adapters share this contract.
 */
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { atomicText, localPath, readBounded, LocalError } from "./local-files.ts";
import { loadGraph, prepareGraphWrite } from "./io.ts";
import { graphFingerprint } from "./revision.ts";
import { previewProposal, type ProposalPatch } from "./proposals.ts";
import { compareGraphs } from "./workspace.ts";
import type { Graph, GraphCommand, GraphNode, Region } from "./types.ts";

export const AUTHORING_KINDS: Record<string, { label: string; region: Region; type: string }> = {
  feature: { label: "A capability / feature", region: "product", type: "feature" },
  step: { label: "A workflow step", region: "workflow", type: "step" },
  entity: { label: "Something the app manages", region: "domain", type: "entity" },
  rule: { label: "A business rule", region: "domain", type: "rule" },
  screen: { label: "A screen / experience", region: "experience", type: "screen" },
  constraint: { label: "A project constraint", region: "intent", type: "constraint" },
  criterion: { label: "A way to verify success", region: "quality", type: "acceptance-criterion" },
};
export const SEMANTIC_RELATIONS = ["contains", "supports", "reads", "writes", "constrains", "verified-by", "implements", "relates-to"] as const;
export interface SketchNote {
  id: string;
  kind: "note" | "question" | "assumption";
  text: string;
  x: number;
  y: number;
  focusId?: string;
}
export interface SketchLink { id: string; from: string; to: string }
export interface SketchBoard { schemaVersion: "productgraph.sketch.v1"; notes: SketchNote[]; links: SketchLink[] }
export interface NoteMapping {
  noteId: string;
  existingNodeId?: string;
  kind?: string;
  title?: string;
  interpretationConfirmed: boolean;
  inputs?: string;
  outputs?: string;
  implementationRef?: string;
}
export interface AuthoringOrigin {
  schemaVersion: "productgraph.sketch-proposal.v1";
  boardRevision: string;
  sourceNotes: SketchNote[];
  mappings: NoteMapping[];
}
export type SketchProposal = ProposalPatch & { authoring: AuthoringOrigin };

export function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJSON((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const contentHash = (value: string | Uint8Array) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const objectHash = (value: unknown) => contentHash(stableJSON(value));
export function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LocalError(400, "Expected an object");
  return input as Record<string, unknown>;
}
export function text(input: unknown, name: string, max = 200): string {
  if (typeof input !== "string" || !input.trim() || input.length > max || input.includes("\0")) throw new LocalError(400, `Invalid ${name}: enter 1–${max} characters`);
  return input;
}
function id(input: unknown): string {
  const value = text(input, "local ID", 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) throw new LocalError(400, "Invalid local ID");
  return value;
}
export const emptyBoard = (): SketchBoard => ({ schemaVersion: "productgraph.sketch.v1", notes: [], links: [] });
export function validateBoard(input: unknown): SketchBoard {
  const raw = record(input);
  if (raw.schemaVersion !== "productgraph.sketch.v1" || !Array.isArray(raw.notes) || !Array.isArray(raw.links)) throw new LocalError(400, "Unsupported sketch board");
  if (raw.notes.length > 200 || raw.links.length > 500) throw new LocalError(413, "A sketch supports 200 notes and 500 links");
  const ids = new Set<string>();
  const notes = raw.notes.map(item => {
    const n = record(item), noteId = id(n.id);
    if (ids.has(noteId)) throw new LocalError(400, "Duplicate sketch ID");
    ids.add(noteId);
    if (!["note", "question", "assumption"].includes(String(n.kind))) throw new LocalError(400, "Unknown note kind");
    if (![n.x, n.y].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10000)) throw new LocalError(400, "Invalid sketch position");
    const note: SketchNote = { id: noteId, kind: n.kind as SketchNote["kind"], text: text(n.text, "note", 4000), x: n.x as number, y: n.y as number };
    if (n.focusId !== undefined) note.focusId = id(n.focusId);
    return note;
  });
  const links = raw.links.map(item => {
    const e = record(item), edgeId = id(e.id), from = id(e.from), to = id(e.to);
    if (ids.has(edgeId)) throw new LocalError(400, "Duplicate sketch ID");
    if (!notes.some(n => n.id === from) || !notes.some(n => n.id === to)) throw new LocalError(400, "Sketch link endpoints must exist");
    ids.add(edgeId);
    // Extra semantic/execute fields are deliberately NOT accepted as meaning.
    return { id: edgeId, from, to };
  });
  return { schemaVersion: "productgraph.sketch.v1", notes, links };
}

export function loadSketch(root: string) {
  const file = localPath(root, "sketches/board.json");
  const board = fs.existsSync(file) ? validateBoard(JSON.parse(readBounded(file, 1024 * 1024))) : emptyBoard();
  const projectId = loadGraph(root).manifest.projectId;
  return { board, boardRevision: objectHash({ projectId, location: fs.realpathSync(root), board }) };
}
export function saveSketch(root: string, input: unknown) {
  const payload = record(input), board = validateBoard(payload.board);
  const directory = localPath(root, "sketches");
  fs.mkdirSync(directory, { recursive: true });
  const lock = localPath(root, "sketches/write.lock");
  let fd: number;
  try { fd = fs.openSync(lock, "wx", 0o600); } catch { throw new LocalError(409, "Sketch is busy. Retry after the other writer finishes."); }
  try {
    if (payload.expectedRevision !== loadSketch(root).boardRevision) throw new LocalError(409, "Sketch changed on disk. Keep your draft; reopen and reconcile before saving.");
    const output = `${JSON.stringify(board, null, 2)}\n`;
    if (Buffer.byteLength(output) > 1024 * 1024) throw new LocalError(413, "Sketch exceeds 1 MiB");
    atomicText(localPath(root, "sketches/board.json"), output);
    return loadSketch(root);
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

/** Pure compilation of explicit form choices. No AI inference, execution, or disk writes. */
export function defineSketch(graph: Graph, board: SketchBoard, boardRevision: string, input: unknown, proposalId = `sketch-${randomUUID()}`): SketchProposal {
  const raw = record(input);
  if (raw.expectedBoardRevision !== boardRevision || raw.expectedGraphRevision !== graphFingerprint(graph)) throw new LocalError(409, "Model or sketch changed. Review current sources before defining meaning.");
  if (!Array.isArray(raw.mappings) || !raw.mappings.length || raw.mappings.length > 32 || !Array.isArray(raw.relations) || raw.relations.length > 100) throw new LocalError(400, "Choose 1–32 notes and at most 100 explicit relationships");
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  const usedNotes = new Set<string>(), bindings = new Map<string, string>();
  const commands: GraphCommand[] = [];
  const sourceNotes: SketchNote[] = [];
  const mappings: NoteMapping[] = [];
  for (const item of raw.mappings) {
    const m = record(item), noteId = id(m.noteId), note = board.notes.find(n => n.id === noteId);
    if (!note || usedNotes.has(noteId)) throw new LocalError(400, "Choose existing, distinct sketch notes");
    usedNotes.add(noteId);
    if (note.kind !== "note" && m.interpretationConfirmed !== true) throw new LocalError(400, "Explicitly resolve/acknowledge questions and assumptions before proposing meaning");
    const mapping: NoteMapping = { noteId, interpretationConfirmed: m.interpretationConfirmed === true };
    if (m.existingNodeId !== undefined && m.existingNodeId !== "") {
      const existing = id(m.existingNodeId);
      if (!nodeIds.has(existing)) throw new LocalError(400, "Existing object not found in this project");
      mapping.existingNodeId = existing;
      bindings.set(noteId, existing);
    } else {
      const kind = text(m.kind, "definition kind"), definition = Object.hasOwn(AUTHORING_KINDS, kind) ? AUTHORING_KINDS[kind] : null;
      if (!definition) throw new LocalError(400, "Unsupported definition kind");
      const title = text(m.title, "object title").trim();
      const newId = `${definition.region}:sketch-${noteId}`;
      if (nodeIds.has(newId)) throw new LocalError(409, "This note already has an object in that region. Reuse it instead of creating a duplicate.");
      nodeIds.add(newId); bindings.set(noteId, newId);
      Object.assign(mapping, { kind, title });
      for (const field of ["inputs", "outputs", "implementationRef"] as const) {
        if (m[field] !== undefined && m[field] !== "") mapping[field] = text(m[field], field, 1000);
      }
      const node: GraphNode = {
        id: newId, region: definition.region, type: definition.type, title, status: "draft",
        data: {
          description: note.text,
          sketchOrigin: { noteId, boardRevision, sourceKind: note.kind, sourceHash: objectHash(note), interpretationConfirmed: mapping.interpretationConfirmed },
          ...(mapping.inputs || mapping.outputs || mapping.implementationRef ? {
            implementationContract: { inputs: mapping.inputs || "", outputs: mapping.outputs || "", reference: mapping.implementationRef || "", executable: false },
          } : {}),
        },
      };
      commands.push({ type: "create-node", node });
    }
    sourceNotes.push({ ...note }); mappings.push(mapping);
  }
  const seenRelations = new Set<string>();
  for (const item of raw.relations) {
    const relation = record(item), from = bindings.get(id(relation.from)), to = bindings.get(id(relation.to));
    if (!from || !to || from === to || !SEMANTIC_RELATIONS.includes(relation.kind as typeof SEMANTIC_RELATIONS[number])) throw new LocalError(400, "Choose distinct mapped objects and an explicit semantic relationship (not an execution edge)");
    const kind = relation.kind as string, key = JSON.stringify([from, kind, to]);
    if (seenRelations.has(key) || graph.edges.some(e => e.from === from && e.to === to && e.kind === kind)) throw new LocalError(409, "Relationship already exists; omit duplicate links");
    seenRelations.add(key);
    commands.push({ type: "create-edge", edge: { id: `${proposalId}:edge-${commands.length}`, from, to, kind, data: { relationClass: "semantic", executable: false } } });
  }
  if (!commands.length) throw new LocalError(400, "Nothing to propose: add a new object or explicit relationship");
  return {
    id: proposalId, source: "human", title: text(raw.title || "Define sketch meaning", "proposal title"),
    rationale: "Explicit no-code definitions from saved sketch notes. Applying defines draft meaning, not verified truth or execution permission.",
    status: "pending", baseRevision: graphFingerprint(graph), commands, affectedIds: [...new Set(bindings.values())],
    authoring: { schemaVersion: "productgraph.sketch-proposal.v1", boardRevision, sourceNotes, mappings },
  };
}
export function createSketchProposal(root: string, input: unknown) {
  const graph = loadGraph(root), { board, boardRevision } = loadSketch(root);
  const proposal = defineSketch(graph, board, boardRevision, input);
  const preview = previewProposal(graph, proposal);
  if (preview.diagnostics.some(d => d.level === "error")) throw new LocalError(400, "Definition would create an invalid product graph");
  prepareGraphWrite(root, preview.graph); // Preflight only; no product writes during proposal creation.
  atomicText(localPath(root, `agent-context/proposals/${proposal.id}.json`), `${JSON.stringify(proposal, null, 2)}\n`);
  return { proposal, proposalRevision: objectHash(proposal), diff: compareGraphs(graph, preview.graph), diagnostics: preview.diagnostics };
}
export function sketchOriginCurrent(root: string, proposal: ProposalPatch): boolean {
  const origin = (proposal as Partial<SketchProposal>).authoring;
  if (!origin) return true;
  return origin.schemaVersion === "productgraph.sketch-proposal.v1" && origin.boardRevision === loadSketch(root).boardRevision;
}
