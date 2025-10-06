import type { Graph } from './types.js';

export interface History {
	past: Graph[];
	present: Graph;
	future: Graph[];
	limit: number;
}

export function create_history(initial: Graph, limit = 100): History {
	if (limit <= 0) {
		throw new Error('History limit must be greater than zero');
	}
	return {
		past: [],
		present: initial,
		future: [],
		limit,
	};
}

export function push(history: History, graph: Graph): History {
	if (history.present === graph) {
		return history;
	}
	const trimmed =
		history.past.length >= history.limit
			? [...history.past.slice(1), history.present]
			: [...history.past, history.present];
	return {
		past: trimmed,
		present: graph,
		future: [],
		limit: history.limit,
	};
}

export function undo(history: History): History {
	if (!history.past.length) {
		return history;
	}
	const previous = history.past[history.past.length - 1];
	return {
		past: history.past.slice(0, -1),
		present: previous,
		future: [history.present, ...history.future],
		limit: history.limit,
	};
}

export function redo(history: History): History {
	if (!history.future.length) {
		return history;
	}
	const next = history.future[0];
	return {
		past: [...history.past, history.present],
		present: next,
		future: history.future.slice(1),
		limit: history.limit,
	};
}

export function can_undo(history: History): boolean {
	return history.past.length > 0;
}

export function can_redo(history: History): boolean {
	return history.future.length > 0;
}
