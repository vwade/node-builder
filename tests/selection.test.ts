import { describe, expect, it } from 'vitest';
import {
	clear_selection,
	create_selection,
	deselect_edge,
	deselect_node,
	is_edge_selected,
	is_node_selected,
	select_edge,
	select_node,
	to_selection_arrays,
	toggle_edge,
	toggle_node,
} from '../src/core/selection.js';

function ids_from_set<T>(input: Set<T>): T[] {
	return [...input].sort();
}

describe('selection model', () => {
	it('starts empty and remains referentially stable when clearing', () => {
		const selection = create_selection();
		expect(selection.nodes.size).toBe(0);
		expect(selection.edges.size).toBe(0);
		expect(clear_selection(selection)).toBe(selection);
	});

	it('selects single nodes and clears previous edges', () => {
		let selection = create_selection();
		selection = select_edge(selection, 'edge_a');
		expect(ids_from_set(selection.edges)).toEqual(['edge_a']);
		selection = select_node(selection, 'node_a');
		expect(ids_from_set(selection.nodes)).toEqual(['node_a']);
		expect(selection.edges.size).toBe(0);
		expect(is_node_selected(selection, 'node_a')).toBe(true);
		expect(is_edge_selected(selection, 'edge_a')).toBe(false);
	});

	it('supports multi-select across nodes with append semantics', () => {
		let selection = create_selection();
		selection = select_node(selection, 'node_a');
		selection = select_node(selection, 'node_b', { append: true });
		selection = select_node(selection, 'node_c', { append: true });
		expect(ids_from_set(selection.nodes)).toEqual(['node_a', 'node_b', 'node_c']);
		expect(selection.edges.size).toBe(0);
	});

	it('keeps existing nodes when appending edges', () => {
		let selection = create_selection();
		selection = select_node(selection, 'node_a');
		selection = select_edge(selection, 'edge_a', { append: true });
		selection = select_edge(selection, 'edge_b', { append: true });
		expect(ids_from_set(selection.nodes)).toEqual(['node_a']);
		expect(ids_from_set(selection.edges)).toEqual(['edge_a', 'edge_b']);
	});

	it('replaces selection when append is false for edges', () => {
		let selection = create_selection();
		selection = select_node(selection, 'node_a');
		selection = select_edge(selection, 'edge_a', { append: true });
		selection = select_edge(selection, 'edge_b');
		expect(selection.nodes.size).toBe(0);
		expect(ids_from_set(selection.edges)).toEqual(['edge_b']);
	});

	it('deselects individual entities and collapses to empty', () => {
		let selection = create_selection();
		selection = select_node(selection, 'node_a');
		selection = select_edge(selection, 'edge_a', { append: true });
		selection = deselect_node(selection, 'node_a');
		expect(selection.nodes.size).toBe(0);
		expect(ids_from_set(selection.edges)).toEqual(['edge_a']);
		selection = deselect_edge(selection, 'edge_a');
		expect(selection.nodes.size).toBe(0);
		expect(selection.edges.size).toBe(0);
	});

	it('toggles selection state for nodes and edges', () => {
		let selection = create_selection();
		selection = toggle_node(selection, 'node_a');
		expect(ids_from_set(selection.nodes)).toEqual(['node_a']);
		selection = toggle_node(selection, 'node_a');
		expect(selection.nodes.size).toBe(0);
		selection = toggle_edge(selection, 'edge_a');
		expect(ids_from_set(selection.edges)).toEqual(['edge_a']);
		selection = toggle_edge(selection, 'edge_a');
		expect(selection.edges.size).toBe(0);
	});

	it('serializes selection to arrays without mutation', () => {
		let selection = create_selection();
		selection = select_node(selection, 'node_a');
		selection = select_edge(selection, 'edge_a', { append: true });
		const arrays = to_selection_arrays(selection);
		expect(arrays.nodes).toEqual(['node_a']);
		expect(arrays.edges).toEqual(['edge_a']);
		selection = deselect_node(selection, 'node_a');
		expect(arrays.nodes).toEqual(['node_a']);
	});
});
