import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from '../src/core/types.js';
import { gen_id, reset_ids } from '../src/core/id.js';
import {
	add_node,
	connect,
	create_graph,
	move_nodes,
	remove_edge,
	remove_node,
} from '../src/core/graph.js';
import { deserialize_graph, serialize_graph } from '../src/core/serialize.js';

function make_node(id: string, ports: Node['ports']): Node {
	return {
		id,
		type: 'test',
		x: 0,
		y: 0,
		ports,
	};
}

describe('graph operations', () => {
	beforeEach(() => {
		reset_ids();
	});

	it('adds, moves, and removes nodes', () => {
		const node_a = make_node('a', [
			{ id: 'a_out', node_id: 'a', side: 'right', kind: 'out', index: 0 },
		]);
		let graph = create_graph();
		graph = add_node(graph, node_a);
		expect(graph.nodes.get('a')?.ports[0].node_id).toBe('a');
		graph = move_nodes(graph, ['a'], 10, 20);
		expect(graph.nodes.get('a')?.x).toBe(10);
		expect(graph.nodes.get('a')?.y).toBe(20);
		graph = remove_node(graph, 'a');
		expect(graph.nodes.size).toBe(0);
	});

	it('connects nodes with matching ports', () => {
		const node_a = make_node('a', [
			{ id: 'a_out', node_id: 'a', side: 'right', kind: 'out', index: 0 },
		]);
		const node_b = make_node('b', [
			{ id: 'b_in', node_id: 'b', side: 'left', kind: 'in', index: 0 },
		]);
		let graph = create_graph();
		graph = add_node(graph, node_a);
		graph = add_node(graph, node_b);
		graph = connect(graph, {
			from: { node_id: 'a', port_id: 'a_out' },
			to: { node_id: 'b', port_id: 'b_in' },
		});
		expect(graph.edges.size).toBe(1);
		const edge = graph.edges.get('e_1');
		expect(edge?.from.port_id).toBe('a_out');
		expect(edge?.to.port_id).toBe('b_in');
	});

	it('prevents invalid connections', () => {
		const node_a = make_node('a', [
			{ id: 'a_in', node_id: 'a', side: 'left', kind: 'in', index: 0 },
		]);
		const node_b = make_node('b', [
			{ id: 'b_in', node_id: 'b', side: 'left', kind: 'in', index: 0 },
		]);
		let graph = create_graph();
		graph = add_node(graph, node_a);
		graph = add_node(graph, node_b);
		expect(() =>
			connect(graph, {
				from: { node_id: 'a', port_id: 'a_in' },
				to: { node_id: 'b', port_id: 'b_in' },
			}),
		).toThrowError('input port');
	});

	it('removes edges and cascade deletes when removing nodes', () => {
		const node_a = make_node('a', [
			{ id: 'a_out', node_id: 'a', side: 'right', kind: 'out', index: 0 },
		]);
		const node_b = make_node('b', [
			{ id: 'b_in', node_id: 'b', side: 'left', kind: 'in', index: 0 },
		]);
		let graph = create_graph();
		graph = add_node(graph, node_a);
		graph = add_node(graph, node_b);
		graph = connect(graph, {
			from: { node_id: 'a', port_id: 'a_out' },
			to: { node_id: 'b', port_id: 'b_in' },
		});
		graph = remove_edge(graph, 'e_1');
		expect(graph.edges.size).toBe(0);
		graph = connect(graph, {
			from: { node_id: 'a', port_id: 'a_out' },
			to: { node_id: 'b', port_id: 'b_in' },
		});
		graph = remove_node(graph, 'a');
		expect(graph.edges.size).toBe(0);
		expect(graph.nodes.has('b')).toBe(true);
	});

	it('serializes and deserializes a graph snapshot', () => {
		const node_a = make_node('a', [
			{ id: 'a_out', node_id: 'a', side: 'right', kind: 'out', index: 0 },
		]);
		const node_b = make_node('b', [
			{ id: 'b_in', node_id: 'b', side: 'left', kind: 'in', index: 0 },
		]);
		let graph = create_graph();
		graph = add_node(graph, node_a);
		graph = add_node(graph, node_b);
		graph = connect(graph, {
			from: { node_id: 'a', port_id: 'a_out' },
			to: { node_id: 'b', port_id: 'b_in' },
		});
		const serialized = serialize_graph(graph);
		const restored = deserialize_graph(serialized);
		expect(restored.nodes.size).toBe(2);
		expect(restored.edges.size).toBe(1);
		const roundtrip_edge = restored.edges.get('e_1');
		expect(roundtrip_edge?.data).toBeUndefined();
		expect(roundtrip_edge?.from.node_id).toBe('a');
		const restored_node = restored.nodes.get('a');
		expect(restored_node?.ports[0].node_id).toBe('a');
	});
	it('primes id counters from deserialized graphs', () => {
		const node_a = make_node('n_1', [
			{ id: 'n_1_out', node_id: 'n_1', side: 'right', kind: 'out', index: 0 },
		]);
		const node_b = make_node('n_2', [
			{ id: 'n_2_in', node_id: 'n_2', side: 'left', kind: 'in', index: 0 },
		]);
		let graph = create_graph();
		graph = add_node(graph, node_a);
		graph = add_node(graph, node_b);
		graph = connect(graph, {
			from: { node_id: 'n_1', port_id: 'n_1_out' },
			to: { node_id: 'n_2', port_id: 'n_2_in' },
			id: 'e_1',
		});
		const serialized = serialize_graph(graph);
		reset_ids();
		const restored = deserialize_graph(serialized);
		expect(restored.nodes.size).toBe(2);
		expect(gen_id('n')).toBe('n_3');
		expect(gen_id('e')).toBe('e_2');
	});

});
