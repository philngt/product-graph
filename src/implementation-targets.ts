/** Deployment choices are project-owned configuration, not a second product graph.
 * Definitions, references and template metadata are inert; nothing executes here.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { loadGraph } from "./io.ts";
import { atomicText, assertProjectFiles, localPath, readBounded, LocalError } from "./local-files.ts";
import { graphFingerprint } from "./revision.ts";
import type { Graph } from "./types.ts";

export const IMPLEMENTATION_SCHEMA = "productgraph.implementation.v1";
export const TARGET_ROLES = ["interface", "backend", "worker", "cli", "library"] as const;
export interface TargetBinding {
  nodeId: string;
  mode: "template" | "custom" | "deferred";
  slot: string;
  reference: string;
}
export interface TemplatePin { id: string; version: string; definitionHash: string }
export interface ImplementationTarget {
  id: string;
  name: string;
  role: typeof TARGET_ROLES[number];
  environment: string;
  language: string;
  framework: string;
  storage: string;
  notes: string;
  template: TemplatePin | null;
  bindings: TargetBinding[];
}
export interface ImplementationConfig {
  schemaVersion: typeof IMPLEMENTATION_SCHEMA;
  projectId: string;
  targets: ImplementationTarget[];
}
export interface TemplateContract {
  schemaVersion: "productgraph.template-contract.v1";
  roles: string[];
  environments: string[];
  languages: string[];
  frameworks: string[];
  slots: Array<{ id: string; nodeTypes: string[] }>;
}
export interface TemplateDefinition {
  path: string;
  id: string;
  version: string;
  title: string;
  definitionHash: string;
  contract: TemplateContract | null;
  issue: string | null;
}
export interface MappingFinding { code: string; message: string; nodeId?: string }

const FILE = "implementation/targets.json";
const MAX_BYTES = 1024 * 1024;
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
};
export const implementationHash = (value: unknown): string => `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LocalError(400, "Expected implementation object");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new LocalError(400, "Unknown implementation field; do not silently discard newer configuration");
}
function str(value: unknown, label: string, max = 160, required = true): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.includes("\0") || value.length > max || (required && !value.trim())) throw new LocalError(400, `Invalid ${label}`);
  return value.trim();
}
function id(value: unknown): string {
  const result = str(value, "ID", 240);
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(result)) throw new LocalError(400, "Invalid local ID");
  return result;
}
function items(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new LocalError(400, `Expected array with at most ${limit} items`);
  return value;
}
function unique(values: string[]): void {
  if (new Set(values).size !== values.length) throw new LocalError(400, "Duplicate target, binding or slot ID");
}

export function validateImplementation(input: unknown, projectId: string): ImplementationConfig {
  const raw = record(input);
  fields(raw, ["schemaVersion", "projectId", "targets"]);
  if (raw.schemaVersion !== IMPLEMENTATION_SCHEMA) throw new LocalError(400, "Unsupported implementation schema");
  if (raw.projectId !== projectId) throw new LocalError(409, "Implementation belongs to a different product");
  const targets = items(raw.targets, 32).map(item => {
    const t = record(item);
    fields(t, ["id", "name", "role", "environment", "language", "framework", "storage", "notes", "template", "bindings"]);
    if (!TARGET_ROLES.includes(t.role as ImplementationTarget["role"])) throw new LocalError(400, "Unsupported target role");
    let pin: TemplatePin | null = null;
    if (t.template !== null && t.template !== undefined) {
      const p = record(t.template); fields(p, ["id", "version", "definitionHash"]);
      if (typeof p.definitionHash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(p.definitionHash)) throw new LocalError(400, "Template pin requires a definition hash");
      pin = { id: id(p.id), version: str(p.version, "template version"), definitionHash: p.definitionHash };
    }
    const bindings: TargetBinding[] = items(t.bindings, 128).map(item => {
      const b = record(item); fields(b, ["nodeId", "mode", "slot", "reference"]);
      if (!["template", "custom", "deferred"].includes(String(b.mode))) throw new LocalError(400, "Unsupported binding mode");
      return { nodeId: id(b.nodeId), mode: b.mode as TargetBinding["mode"], slot: str(b.slot, "slot", 160, false), reference: str(b.reference, "custom reference", 1000, false) };
    });
    unique(bindings.map(b => b.nodeId));
    return { id: id(t.id), name: str(t.name, "target name"), role: t.role as ImplementationTarget["role"],
      environment: str(t.environment, "environment"), language: str(t.language, "language", 160, false),
      framework: str(t.framework, "framework", 160, false), storage: str(t.storage, "storage", 300, false),
      notes: str(t.notes, "notes", 4000, false), template: pin, bindings };
  });
  unique(targets.map(t => t.id));
  const result: ImplementationConfig = { schemaVersion: IMPLEMENTATION_SCHEMA, projectId, targets };
  if (Buffer.byteLength(`${JSON.stringify(result, null, 2)}\n`) > MAX_BYTES) throw new LocalError(413, "Implementation exceeds 1 MiB");
  return result;
}

function templateContract(value: unknown): TemplateContract {
  const c = record(value);
  if (c.schemaVersion !== "productgraph.template-contract.v1") throw new LocalError(400, "Unsupported template contract");
  fields(c, ["schemaVersion", "roles", "environments", "languages", "frameworks", "slots"]);
  const names = (value: unknown) => items(value, 32).map(v => str(v, "capability"));
  const roles = names(c.roles), environments = names(c.environments);
  if (!roles.length || !environments.length || roles.some(r => !TARGET_ROLES.includes(r as ImplementationTarget["role"]))) throw new LocalError(400, "Declare template roles and environments");
  const slots = items(c.slots, 64).map(value => {
    const s = record(value); fields(s, ["id", "nodeTypes"]);
    const nodeTypes = names(s.nodeTypes);
    if (!nodeTypes.length) throw new LocalError(400, "Declare slot node types");
    return { id: id(s.id), nodeTypes };
  });
  unique(slots.map(s => s.id));
  return { schemaVersion: "productgraph.template-contract.v1", roles, environments,
    languages: names(c.languages ?? []), frameworks: names(c.frameworks ?? []), slots };
}

/** Legacy metadata stays inspectable; only an explicit contract enables mapping checks. */
export function loadImplementationTemplates(root: string): TemplateDefinition[] {
  const directory = localPath(root, "templates");
  if (!fs.existsSync(directory)) return [];
  const files = fs.readdirSync(directory).filter(name => name.endsWith(".json")).sort();
  if (files.length > 100) throw new LocalError(413, "Implementation template catalog exceeds 100 definitions");
  let total = 0;
  return files.map(file => {
    const relative = `templates/${file}`;
    const source = readBounded(localPath(root, relative), 512 * 1024);
    total += Buffer.byteLength(source);
    if (total > 2 * MAX_BYTES) throw new LocalError(413, "Template catalog exceeds 2 MiB");
    const definitionHash = `sha256:${createHash("sha256").update(source).digest("hex")}`;
    try {
      const raw = record(JSON.parse(source));
      const base = { path: relative, id: id(raw.id), version: str(raw.version, "version"), title: str(raw.title ?? raw.name ?? raw.id, "template title"), definitionHash };
      try { return { ...base, contract: templateContract(raw.implementation), issue: null }; }
      catch { return { ...base, contract: null, issue: "No supported implementation contract; metadata only" }; }
    } catch {
      return { path: relative, id: "", version: "", title: file, definitionHash, contract: null, issue: "Invalid or unversioned template definition" };
    }
  });
}

export function inspectTarget(target: ImplementationTarget, graph: Graph, templates: TemplateDefinition[]) {
  const findings: MappingFinding[] = [];
  const matches = target.template ? templates.filter(t => t.id === target.template!.id && t.version === target.template!.version) : [];
  const template = matches.length === 1 ? matches[0] : null;
  let compatible = false;
  if (target.template) {
    if (!template) findings.push({ code: "template-unresolved", message: "Pinned template is missing or its ID/version is ambiguous." });
    else if (template.definitionHash !== target.template.definitionHash) findings.push({ code: "template-drift", message: "Pinned definition changed; explicitly review and select it again." });
    else if (!template.contract) findings.push({ code: "metadata-only", message: "Template has no supported mapping contract." });
    else {
      const c = template.contract;
      compatible = c.roles.includes(target.role) && c.environments.includes(target.environment) &&
        (!c.languages.length || c.languages.includes(target.language)) && (!c.frameworks.length || c.frameworks.includes(target.framework));
      if (!compatible) findings.push({ code: "target-mismatch", message: "Role/environment/language/framework do not match the template's declared capabilities." });
    }
  }
  const bindings = target.bindings.map(binding => {
    const node = graph.nodes.find(n => n.id === binding.nodeId);
    let status = "needs-configuration", message = "Choose a template slot or custom implementation.";
    if (!node) { status = "missing-object"; message = "Product object no longer exists; binding retained for review."; }
    else if (binding.mode === "deferred") { status = "deferred"; message = "Implementation explicitly deferred."; }
    else if (binding.mode === "custom") {
      if (binding.reference) { status = "custom-declared"; message = "Reference only; code has not been read, executed or verified."; }
      else message = "Enter a custom reference.";
    } else if (compatible) {
      const slot = template!.contract!.slots.find(s => s.id === binding.slot);
      if (slot?.nodeTypes.includes(node.type)) { status = "mapped-declaration"; message = "Matches a declared slot; no generator is installed."; }
      else message = "Choose a slot that declares this product object type.";
    }
    if (!["mapped-declaration", "custom-declared"].includes(status)) findings.push({ code: status, nodeId: binding.nodeId, message });
    return { ...binding, title: node?.title || binding.nodeId, status, message };
  });
  if (!bindings.length) findings.push({ code: "no-bindings", message: "No product objects assigned to this target." });
  return { targetId: target.id, template, compatible, bindings, findings, generation: { available: false, reason: "No executable generator is registered. Configuration is not a build." } };
}

export function loadImplementation(root: string) {
  assertProjectFiles(root);
  const graph = loadGraph(root), file = localPath(root, FILE);
  const config = fs.existsSync(file) ? validateImplementation(JSON.parse(readBounded(file)), graph.manifest.projectId) :
    { schemaVersion: IMPLEMENTATION_SCHEMA, projectId: graph.manifest.projectId, targets: [] } as ImplementationConfig;
  const templates = loadImplementationTemplates(root);
  const graphRevision = graphFingerprint(graph);
  // File-backed optimistic snapshot includes model and template inputs; camera/layout is irrelevant.
  const revision = implementationHash({ location: fs.realpathSync(root), config, graphRevision, templates });
  return { config, revision, graphRevision, templates, nodes: graph.nodes.map(({ id, type, region, title }) => ({ id, type, region, title })),
    inspection: config.targets.map(t => inspectTarget(t, graph, templates)), source: FILE };
}

export function saveImplementation(root: string, input: unknown) {
  const payload = record(input); fields(payload, ["expectedRevision", "config"]);
  if (typeof payload.expectedRevision !== "string") throw new LocalError(428, "Load implementation configuration before saving");
  fs.mkdirSync(localPath(root, "implementation"), { recursive: true });
  const lock = localPath(root, "implementation/write.lock");
  let fd: number;
  try { fd = fs.openSync(lock, "wx", 0o600); }
  catch { throw new LocalError(409, "Implementation is busy; keep your draft and retry"); }
  try {
    const current = loadImplementation(root);
    if (payload.expectedRevision !== current.revision) throw new LocalError(409, "Model, template or targets changed. Keep your draft; reload and reconcile before saving.");
    const config = validateImplementation(payload.config, current.config.projectId);
    atomicText(localPath(root, FILE), `${JSON.stringify(config, null, 2)}\n`);
    return loadImplementation(root);
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
