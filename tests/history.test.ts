import { beforeEach, describe, expect, it } from 'vitest';
import {
	create_add_node_command,
	create_command_state,
	create_connect_command,
	create_move_nodes_command,
	execute_command,
	get_present_graph,
	redo_command,
	undo_command,
} from '../src/core/commands.js';
import { add_node, create_graph, move_nodes } from '../src/core/graph.js';
import {
	can_redo,
	can_undo,
	create_history,
	push,
	redo,
	undo,
} from '../src/core/history.js';
import { reset_ids } from '../src/core/id.js';
import type { Graph, Node } from '../src/core/types.js';

function node_with_ports(id: string, ports: Node['ports']): Node {
	return {
		id,
		type: 'node',
		x: 0,
		y: 0,
		ports,
	};
}

function graph_with_nodes(nodes: Node[]): Graph {
	let graph = create_graph();
	for (const node of nodes) {
		graph = add_node(graph, node);
	}
	return graph;
}

describe('history', () => {
	it('pushes states, enforces limit, and supports undo/redo', () => {
		let history = create_history(create_graph(), 2);
		const first = add_node(history.present, node_with_ports('a', []));
		history = push(history, first);
		expect(history.past).toHaveLength(1);
		expect(can_undo(history)).toBe(true);
		const second = add_node(first, node_with_ports('b', []));
		history = push(history, second);
		expect(history.past).toHaveLength(2);
		history = push(history, move_nodes(second, ['b'], 10, 0));
		expect(history.past).toHaveLength(2);
		history = undo(history);
		expect(history.present.nodes.get('b')?.x).toBe(0);
		expect(can_redo(history)).toBe(true);
		history = redo(history);
		expect(history.present.nodes.get('b')?.x).toBe(10);
		history = undo(history);
		history = undo(history);
		expect(can_undo(history)).toBe(false);
	});
});

describe('command stack', () => {
	beforeEach(() => {
		reset_ids();
	});

	it('executes commands with undo/redo flow', () => {
		let state = create_command_state(create_graph());
		const add = create_add_node_command(node_with_ports('n1', [
			{ id: 'n1_out', node_id: 'n1', side: 'right', kind: 'out', index: 0 },
		]));
		({ state } = execute_command(state, add));
		expect(get_present_graph(state).nodes.has('n1')).toBe(true);
		const move = create_move_nodes_command(['n1'], 5, 5);
		({ state } = execute_command(state, move));
		expect(get_present_graph(state).nodes.get('n1')?.x).toBe(5);
		state = undo_command(state);
		expect(get_present_graph(state).nodes.get('n1')?.x).toBe(0);
		state = redo_command(state);
		expect(get_present_graph(state).nodes.get('n1')?.y).toBe(5);
	});

	it('clears redo stack after new command', () => {
		let state = create_command_state(create_graph());
		({ state } = execute_command(state, create_add_node_command(node_with_ports('n1', []))));
		state = undo_command(state);
		({ state } = execute_command(state, create_add_node_command(node_with_ports('n2', []))));
		state = redo_command(state);
		expect(get_present_graph(state).nodes.size).toBe(1);
	});

	it('connect command assigns ids and supports undo', () => {
		const graph = graph_with_nodes([
			node_with_ports('n1', [
				{ id: 'n1_out', node_id: 'n1', side: 'right', kind: 'out', index: 0 },
			]),
			node_with_ports('n2', [
				{ id: 'n2_in', node_id: 'n2', side: 'left', kind: 'in', index: 0 },
			]),
		]);
		let state = create_command_state(graph);
		const connect_command = create_connect_command({
			from: { node_id: 'n1', port_id: 'n1_out' },
			to: { node_id: 'n2', port_id: 'n2_in' },
		});
		const exec = execute_command(state, connect_command);
		state = exec.state;
		expect(exec.result).toMatch(/^e_/);
		expect(get_present_graph(state).edges.size).toBe(1);
		state = undo_command(state);
		expect(get_present_graph(state).edges.size).toBe(0);
	});
});
