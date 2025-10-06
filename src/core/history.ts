import type { Command, Graph } from './types.js';

export interface Command_entry<R = unknown> {
	command: Command<R>;
	graph_before: Graph;
	graph_after: Graph;
	result?: R;
}

export interface History_state {
	graph: Graph;
	undo_stack: Command_entry[];
	redo_stack: Command_entry[];
}

export interface Execute_result<R = unknown> {
	history: History_state;
	result?: R;
}

export function create_history(initial_graph: Graph): History_state {
	return {
		graph: initial_graph,
		undo_stack: [],
		redo_stack: [],
	};
}

export function execute_command<R>(history: History_state, command: Command<R>): Execute_result<R> {
	const { graph: graph_before } = history;
	const { graph: graph_after, result } = command.do(graph_before);
	const mutated = graph_after !== graph_before;
	if (!mutated) {
		return {
			history: {
				graph: graph_after,
				undo_stack: history.undo_stack,
				redo_stack: history.redo_stack,
			},
			result,
		};
	}
	const entry: Command_entry<R> = {
		command,
		graph_before,
		graph_after,
		result,
	};
	return {
		history: {
			graph: graph_after,
			undo_stack: [...history.undo_stack, entry],
			redo_stack: [],
		},
		result,
	};
}

export function undo(history: History_state): History_state {
	if (!history.undo_stack.length) {
		return history;
	}
	const next_undo_stack = history.undo_stack.slice(0, -1);
	const entry = history.undo_stack[history.undo_stack.length - 1];
	const previous_graph = entry.command.undo ? entry.command.undo(history.graph) : entry.graph_before;
	return {
		graph: previous_graph,
		undo_stack: next_undo_stack,
		redo_stack: [...history.redo_stack, entry],
	};
}

export function redo(history: History_state): History_state {
	if (!history.redo_stack.length) {
		return history;
	}
	const next_redo_stack = history.redo_stack.slice(0, -1);
	const entry = history.redo_stack[history.redo_stack.length - 1];
	return {
		graph: entry.graph_after,
		undo_stack: [...history.undo_stack, entry],
		redo_stack: next_redo_stack,
	};
}

export function clear_history(history: History_state, graph: Graph): History_state {
	return {
		graph,
		undo_stack: [],
		redo_stack: [],
	};
}

export function can_undo(history: History_state): boolean {
	return history.undo_stack.length > 0;
}

export function can_redo(history: History_state): boolean {
	return history.redo_stack.length > 0;
}
