import { add_node, connect, move_nodes, remove_edge, remove_node } from './graph.js';
import { can_redo, can_undo, create_history, push, redo, undo } from './history.js';
import type { Connect_input } from './graph.js';
import type { History } from './history.js';
import type { Command, Edge_id, Graph, Node, Node_id } from './types.js';

export interface Command_state {
	history: History;
}

export function create_command_state(initial: Graph, limit = 100): Command_state {
	return {
		history: create_history(initial, limit),
	};
}

export function get_present_graph(state: Command_state): Graph {
	return state.history.present;
}

export function execute_command<R>(state: Command_state, command: Command<R>): { state: Command_state; result?: R } {
	const { graph, result } = command.do(state.history.present);
	const history = push(state.history, graph);
	if (history === state.history) {
		return { state, result };
	}
	return {
		state: { history },
		result,
	};
}

export function undo_command(state: Command_state): Command_state {
	const history = undo(state.history);
	return history === state.history ? state : { history };
}

export function redo_command(state: Command_state): Command_state {
	const history = redo(state.history);
	return history === state.history ? state : { history };
}

export function can_undo_command(state: Command_state): boolean {
	return can_undo(state.history);
}

export function can_redo_command(state: Command_state): boolean {
	return can_redo(state.history);
}

export function create_add_node_command(node: Node): Command<Node> {
	return {
		type: 'add_node',
		payload: node,
		do(graph) {
			return { graph: add_node(graph, node), result: node };
		},
		undo(graph) {
			return remove_node(graph, node.id);
		},
	};
}

export function create_move_nodes_command(node_ids: Node_id[], dx: number, dy: number): Command<void> {
	return {
		type: 'move_nodes',
		payload: { node_ids, dx, dy },
		do(graph) {
			return { graph: move_nodes(graph, node_ids, dx, dy) };
		},
		undo(graph) {
			return move_nodes(graph, node_ids, -dx, -dy);
		},
	};
}

export function create_connect_command(input: Connect_input): Command<Edge_id> {
	let created_edge_id: Edge_id | null = input.id ?? null;
	return {
		type: 'connect',
		payload: input,
		do(graph) {
			const before = created_edge_id ? null : new Set(graph.edges.keys());
			const next = connect(graph, input);
			if (!created_edge_id) {
				for (const candidate of next.edges.keys()) {
					if (!before?.has(candidate)) {
						created_edge_id = candidate;
						break;
					}
				}
			}
			if (!created_edge_id) {
				throw new Error('Failed to determine edge id for connect command');
			}
			return { graph: next, result: created_edge_id };
		},
		undo(graph) {
			if (!created_edge_id) {
				return graph;
			}
			return remove_edge(graph, created_edge_id);
		},
	};
}

export function create_disconnect_command(edge_id: Edge_id): Command<void> {
	return {
		type: 'disconnect',
		payload: edge_id,
		do(graph) {
			return { graph: remove_edge(graph, edge_id) };
		},
	};
}
