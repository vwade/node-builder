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
	const seeds = collect_id_seeds(serialized);
	if (Object.keys(seeds).length > 0) {
		prime_ids(seeds);
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

function collect_id_seeds(serialized: Serialized_graph): Record<string, number> {
	const maxima = new Map<string, number>();
	for (const node of serialized.nodes) {
		record_max_suffix(maxima, node.id);
	}
	for (const edge of serialized.edges) {
		record_max_suffix(maxima, edge.id);
	}
	return Object.fromEntries(maxima);
}

function record_max_suffix(target: Map<string, number>, id: string | undefined): void {
	if (!id) {
		return;
	}
	const separator = id.lastIndexOf('_');
	if (separator === -1 || separator === id.length - 1) {
		return;
	}
	const prefix = id.slice(0, separator);
	const suffix = id.slice(separator + 1);
	if (!/^[0-9a-z]+$/i.test(suffix)) {
		return;
	}
	const value = parseInt(suffix, 36);
	if (Number.isNaN(value)) {
		return;
	}
	const current = target.get(prefix) ?? 0;
	if (value > current) {
		target.set(prefix, value);
	}
}
