import type { Graph, GraphCommand, GraphNode } from "./types.ts";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export function applyCommand(input: Graph, command: GraphCommand): Graph {
  const graph = clone(input);
  if (command.type === "create-node") {
    if (graph.nodes.some((node) => node.id === command.node.id)) throw new Error(`Node already exists: ${command.node.id}`);
    graph.nodes.push(command.node);
  } else if (command.type === "update-node") {
    const node = graph.nodes.find((item) => item.id === command.id);
    if (!node) throw new Error(`Node not found: ${command.id}`);
    Object.assign(node, command.patch);
  } else if (command.type === "delete-node") {
    if (!graph.nodes.some((node) => node.id === command.id)) throw new Error(`Node not found: ${command.id}`);
    graph.nodes = graph.nodes.filter((node) => node.id !== command.id);
    graph.edges = graph.edges.filter((edge) => edge.from !== command.id && edge.to !== command.id);
  } else if (command.type === "create-edge") {
    if (!graph.nodes.some((node) => node.id === command.edge.from) || !graph.nodes.some((node) => node.id === command.edge.to)) throw new Error("Edge endpoints must reference existing nodes");
    if (graph.edges.some((edge) => edge.id === command.edge.id)) throw new Error(`Edge already exists: ${command.edge.id}`);
    graph.edges.push(command.edge);
  } else if (command.type === "delete-edge") {
    graph.edges = graph.edges.filter((edge) => edge.id !== command.id);
  }
  return graph;
}

export function applyCommands(input: Graph, commands: GraphCommand[]): Graph {
  return commands.reduce((graph, command) => applyCommand(graph, command), input);
}

export function nodeCommand(node: GraphNode): GraphCommand { return { type: "create-node", node }; }
