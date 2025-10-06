import type { Edge, Graph, Node } from './types.js';
import { add_node, connect, create_graph } from './graph.js';
import { prime_ids } from './id.js';

export interface Serialized_graph {
	nodes: Node[];
	edges: Edge[];
}

export function serialize_graph(graph: Graph): Serialized_graph {
	return {
		nodes: [...graph.nodes.values()].map(clone_node),
		edges: [...graph.edges.values()].map(clone_edge),
	};
}

export function deserialize_graph(serialized: Serialized_graph): Graph {
	const seed: Record<string, number> = {};
	for (const node of serialized.nodes) {
		track_id(seed, node.id);
	}
	for (const edge of serialized.edges) {
		track_id(seed, edge.id);
	}
	if (Object.keys(seed).length) {
		prime_ids(seed);
	}
	let graph = create_graph();
	for (const node of serialized.nodes) {
		graph = add_node(graph, clone_node(node));
	}
	for (const edge of serialized.edges) {
		graph = connect(graph, {
			from: { ...edge.from },
			to: { ...edge.to },
			id: edge.id,
			data: edge.data,
		});
	}
	return graph;
}

function track_id(seed: Record<string, number>, id: string): void {
	const separator = id.lastIndexOf('_');
	if (separator <= 0 || separator === id.length - 1) {
		return;
	}
	const prefix = id.slice(0, separator);
	const raw = id.slice(separator + 1);
	const value = parseInt(raw, 36);
	if (Number.isNaN(value)) {
		return;
	}
	const current = seed[prefix];
	if (!current || value > current) {
		seed[prefix] = value;
	}
}

function clone_node(node: Node): Node {
	return {
		...node,
		ports: node.ports.map((port) => ({ ...port })),
	};
}

function clone_edge(edge: Edge): Edge {
	return {
		...edge,
		from: { ...edge.from },
		to: { ...edge.to },
	};
}
