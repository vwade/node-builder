import type { Edge, Graph, Node } from './types.js';
import { add_node, connect, create_graph } from './graph.js';

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
