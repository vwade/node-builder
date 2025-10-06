import { gen_id } from './id.js';
import type {
	Edge,
	Edge_id,
	Graph,
	Node,
	Node_id,
	Port,
	Port_id,
} from './types.js';

export interface Connect_input {
	from: { node_id: Node_id; port_id: Port_id };
	to: { node_id: Node_id; port_id: Port_id };
	id?: Edge_id;
	data?: Edge['data'];
}

export function create_graph(): Graph {
	return {
		nodes: new Map(),
		edges: new Map(),
	};
}

export function clone_graph(graph: Graph): Graph {
	return {
		nodes: new Map(graph.nodes),
		edges: new Map(graph.edges),
	};
}

export function add_node(graph: Graph, node: Node): Graph {
	if (graph.nodes.has(node.id)) {
		throw new Error(`Node with id "${node.id}" already exists`);
	}
	const normalized = normalize_node(node);
	const next = clone_graph(graph);
	next.nodes.set(normalized.id, normalized);
	return next;
}

export function update_node(graph: Graph, node: Node): Graph {
	if (!graph.nodes.has(node.id)) {
		throw new Error(`Node with id "${node.id}" does not exist`);
	}
	const normalized = normalize_node(node);
	const next = clone_graph(graph);
	next.nodes.set(normalized.id, normalized);
	return next;
}

export function remove_node(graph: Graph, node_id: Node_id): Graph {
	if (!graph.nodes.has(node_id)) {
		return graph;
	}
	const next = clone_graph(graph);
	next.nodes.delete(node_id);
	for (const [edge_id, edge] of next.edges) {
		if (edge.from.node_id === node_id || edge.to.node_id === node_id) {
			next.edges.delete(edge_id);
		}
	}
	return next;
}

export function move_nodes(graph: Graph, node_ids: Node_id[], dx: number, dy: number): Graph {
	if (!dx && !dy) {
		return graph;
	}
	let mutated = false;
	const next = clone_graph(graph);
	for (const node_id of node_ids) {
		const existing = next.nodes.get(node_id);
		if (!existing) {
			continue;
		}
		mutated = true;
		next.nodes.set(node_id, {
			...existing,
			x: existing.x + dx,
			y: existing.y + dy,
		});
	}
	return mutated ? next : graph;
}

export function set_node_position(graph: Graph, node_id: Node_id, x: number, y: number): Graph {
	const existing = graph.nodes.get(node_id);
	if (!existing) {
		throw new Error(`Node with id "${node_id}" does not exist`);
	}
	if (existing.x === x && existing.y === y) {
		return graph;
	}
	const next = clone_graph(graph);
	next.nodes.set(node_id, {
		...existing,
		x,
		y,
	});
	return next;
}

export function connect(graph: Graph, input: Connect_input): Graph {
	const { from, to } = input;
	const from_node = graph.nodes.get(from.node_id);
	const to_node = graph.nodes.get(to.node_id);
	if (!from_node) {
		throw new Error(`Cannot connect from missing node "${from.node_id}"`);
	}
	if (!to_node) {
		throw new Error(`Cannot connect to missing node "${to.node_id}"`);
	}
	const from_port = find_port(from_node, from.port_id);
	const to_port = find_port(to_node, to.port_id);
	if (!from_port) {
		throw new Error(`Port "${from.port_id}" not found on node "${from.node_id}"`);
	}
	if (!to_port) {
		throw new Error(`Port "${to.port_id}" not found on node "${to.node_id}"`);
	}
	if (from_port.kind === 'in') {
		throw new Error(`Cannot connect from an input port "${from.port_id}"`);
	}
	if (to_port.kind === 'out') {
		throw new Error(`Cannot connect to an output port "${to.port_id}"`);
	}
	const edge_id = input.id ?? gen_id('e');
	if (graph.edges.has(edge_id)) {
		throw new Error(`Edge with id "${edge_id}" already exists`);
	}
	const next = clone_graph(graph);
	const edge: Edge = {
		id: edge_id,
		from: { node_id: from.node_id, port_id: from.port_id },
		to: { node_id: to.node_id, port_id: to.port_id },
		data: input.data,
	};
	next.edges.set(edge.id, edge);
	return next;
}

export function remove_edge(graph: Graph, edge_id: Edge_id): Graph {
	if (!graph.edges.has(edge_id)) {
		return graph;
	}
	const next = clone_graph(graph);
	next.edges.delete(edge_id);
	return next;
}

export function disconnect(graph: Graph, edge_id: Edge_id): Graph {
	return remove_edge(graph, edge_id);
}

function normalize_node(node: Node): Node {
	const seen = new Set<Port_id>();
	const ports = node.ports.map((port, index) => {
		const id = port.id ?? `${node.id}_port_${index}`;
		if (seen.has(id)) {
			throw new Error(`Duplicate port id "${id}" on node "${node.id}"`);
		}
		seen.add(id);
		return {
			...port,
			id,
			node_id: node.id,
			index: port.index ?? index,
		};
	});
	return {
		...node,
		ports,
	};
}

function find_port(node: Node, port_id: Port_id): Port | undefined {
	return node.ports.find((port) => port.id === port_id);
}
