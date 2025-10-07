import type { Edge_id, Node_id } from './types.js';

export type Selection_kind = 'node' | 'edge';

export interface Selection_state {
	nodes: Set<Node_id>;
	edges: Set<Edge_id>;
}

export interface Select_options {
	append?: boolean;
}

export function create_selection(): Selection_state {
	return {
		nodes: new Set(),
		edges: new Set(),
	};
}

export function clear_selection(selection: Selection_state): Selection_state {
	if (!selection.nodes.size && !selection.edges.size) {
		return selection;
	}
	return create_selection();
}

export function is_node_selected(selection: Selection_state, node_id: Node_id): boolean {
	return selection.nodes.has(node_id);
}

export function is_edge_selected(selection: Selection_state, edge_id: Edge_id): boolean {
	return selection.edges.has(edge_id);
}

export function select_node(selection: Selection_state, node_id: Node_id, options: Select_options = {}): Selection_state {
	const append = options.append ?? false;
	if (append) {
		if (selection.nodes.has(node_id)) {
			return selection;
		}
		const nodes = new Set(selection.nodes);
		nodes.add(node_id);
		return {
			nodes,
			edges: new Set(selection.edges),
		};
	}
	const already_only_node = selection.nodes.size === 1 && selection.nodes.has(node_id);
	if (already_only_node && !selection.edges.size) {
		return selection;
	}
	const nodes = new Set<Node_id>();
	nodes.add(node_id);
	return {
		nodes,
		edges: new Set<Edge_id>(),
	};
}

export function select_edge(selection: Selection_state, edge_id: Edge_id, options: Select_options = {}): Selection_state {
	const append = options.append ?? false;
	if (append) {
		if (selection.edges.has(edge_id)) {
			return selection;
		}
		const edges = new Set(selection.edges);
		edges.add(edge_id);
		return {
			nodes: new Set(selection.nodes),
			edges,
		};
	}
	const already_only_edge = selection.edges.size === 1 && selection.edges.has(edge_id);
	if (already_only_edge && !selection.nodes.size) {
		return selection;
	}
	const edges = new Set<Edge_id>();
	edges.add(edge_id);
	return {
		nodes: new Set<Node_id>(),
		edges,
	};
}

export function deselect_node(selection: Selection_state, node_id: Node_id): Selection_state {
	if (!selection.nodes.has(node_id)) {
		return selection;
	}
	const nodes = new Set(selection.nodes);
	nodes.delete(node_id);
	if (!nodes.size && !selection.edges.size) {
		return create_selection();
	}
	return {
		nodes,
		edges: new Set(selection.edges),
	};
}

export function deselect_edge(selection: Selection_state, edge_id: Edge_id): Selection_state {
	if (!selection.edges.has(edge_id)) {
		return selection;
	}
	const edges = new Set(selection.edges);
	edges.delete(edge_id);
	if (!edges.size && !selection.nodes.size) {
		return create_selection();
	}
	return {
		nodes: new Set(selection.nodes),
		edges,
	};
}

export function toggle_node(selection: Selection_state, node_id: Node_id): Selection_state {
	return selection.nodes.has(node_id)
		? deselect_node(selection, node_id)
		: select_node(selection, node_id, { append: true });
}

export function toggle_edge(selection: Selection_state, edge_id: Edge_id): Selection_state {
	return selection.edges.has(edge_id)
		? deselect_edge(selection, edge_id)
		: select_edge(selection, edge_id, { append: true });
}

export function to_selection_arrays(selection: Selection_state): { nodes: Node_id[]; edges: Edge_id[] } {
	return {
		nodes: [...selection.nodes],
		edges: [...selection.edges],
	};
}
