import { beforeEach, describe, expect, it } from 'vitest';
import type { Command, Node } from '../src/core/types.js';
import { add_node, create_graph, remove_node, set_node_position } from '../src/core/graph.js';
import {
	can_redo,
	can_undo,
	clear_history,
	create_history,
	execute_command,
	redo,
	undo,
} from '../src/core/history.js';

function make_node(id: string): Node {
	return {
		id,
		type: 'test',
		x: 0,
		y: 0,
		ports: [],
	};
}

describe('command history', () => {
	let base_graph = create_graph();

	beforeEach(() => {
		base_graph = create_graph();
	});

	it('executes commands and tracks undo/redo stacks', () => {
		let history = create_history(base_graph);
		const node = make_node('node_a');
		const command: Command<string> = {
			type: 'add_node',
			payload: node,
			do(graph) {
				const next = add_node(graph, node);
				return { graph: next, result: node.id };
			},
			undo(graph) {
				return remove_node(graph, node.id);
			},
		};
		const executed = execute_command(history, command);
		history = executed.history;
		expect(executed.result).toBe('node_a');
		expect(history.graph.nodes.has('node_a')).toBe(true);
		expect(can_undo(history)).toBe(true);
		expect(can_redo(history)).toBe(false);
		history = undo(history);
		expect(history.graph.nodes.size).toBe(0);
		expect(can_undo(history)).toBe(false);
		expect(can_redo(history)).toBe(true);
		history = redo(history);
		expect(history.graph.nodes.has('node_a')).toBe(true);
		expect(can_redo(history)).toBe(false);
	});

	it('clears redo stack when executing a new command after undo', () => {
		let history = create_history(base_graph);
		const first_node = make_node('first');
		const add_first: Command<void> = {
			type: 'add_first',
			do(graph) {
				return { graph: add_node(graph, first_node) };
			},
			undo(graph) {
				return remove_node(graph, first_node.id);
			},
		};
		history = execute_command(history, add_first).history;
		history = undo(history);
		expect(can_redo(history)).toBe(true);
		const second_node = make_node('second');
		const add_second: Command<void> = {
			type: 'add_second',
			do(graph) {
				return { graph: add_node(graph, second_node) };
			},
			undo(graph) {
				return remove_node(graph, second_node.id);
			},
		};
		history = execute_command(history, add_second).history;
		expect(can_redo(history)).toBe(false);
	});

	it('skips recording entries when commands do not mutate the graph', () => {
		let history = create_history(base_graph);
		const noop_command: Command<void> = {
			type: 'noop',
			do(graph) {
				return { graph };
			},
		};
		const executed = execute_command(history, noop_command);
		const next_history = executed.history;
		expect(next_history.undo_stack.length).toBe(0);
		expect(next_history.redo_stack.length).toBe(0);
		expect(can_undo(next_history)).toBe(false);
	});

	it('clears stacks while replacing the tracked graph', () => {
		let history = create_history(base_graph);
		const node = make_node('to_replace');
		history = execute_command(history, {
			type: 'add',
			do(graph) {
				return { graph: add_node(graph, node) };
			},
			undo(graph) {
				return remove_node(graph, node.id);
			},
		} as Command<void>).history;
		expect(history.undo_stack.length).toBe(1);
		const reset_graph = create_graph();
		history = clear_history(history, reset_graph);
		expect(history.graph).toBe(reset_graph);
		expect(history.undo_stack.length).toBe(0);
		expect(history.redo_stack.length).toBe(0);
	});
});
