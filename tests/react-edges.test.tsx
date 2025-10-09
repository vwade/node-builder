import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Edge, Node } from '../src/core/types.js';
import { Graph_canvas } from '../src/react/canvas.js';
import { Graph_edge_layer } from '../src/react/edges.js';
import type { Graph_edge_render_args } from '../src/react/edges.js';
import { build_port_geometry_map } from '../src/react/ports.js';

const EDGE_NODES: Node[] = [
	{
		id: 'node-a',
		type: 'Alpha',
		x: 50,
		y: 50,
		ports: [
			{ id: 'node-a-in', node_id: 'node-a', side: 'left', kind: 'in', index: 0 },
			{ id: 'node-a-out', node_id: 'node-a', side: 'right', kind: 'out', index: 0 },
		],
	},
	{
		id: 'node-b',
		type: 'Beta',
		x: 280,
		y: 180,
		ports: [
			{ id: 'node-b-in', node_id: 'node-b', side: 'left', kind: 'in', index: 0 },
			{ id: 'node-b-out', node_id: 'node-b', side: 'right', kind: 'out', index: 0 },
		],
	},
];

const EDGE_LIST: Edge[] = [
	{
		id: 'edge-1',
		from: { node_id: 'node-a', port_id: 'node-a-out' },
		to: { node_id: 'node-b', port_id: 'node-b-in' },
	},
];

describe('Graph_edge_layer', () => {
	test('renders edge paths between ports', () => {
		const { container } = render(
			<Graph_canvas>
				<Graph_edge_layer nodes={EDGE_NODES} edges={EDGE_LIST} />
			</Graph_canvas>,
		);
		const paths = container.querySelectorAll('path');
		expect(paths.length).toBeGreaterThan(0);
		const primary = Array.from(paths).find((path) => path.getAttribute('stroke') === '#38bdf8');
		expect(primary).toBeTruthy();
		expect(primary?.getAttribute('d')).toMatch(/^M/);
	});

	test('renders a preview path when provided', () => {
		const geometry_map = build_port_geometry_map(EDGE_NODES, {
			default_width: 180,
			default_height: 104,
		});
		const from_geometry = geometry_map.get('node-a')?.get('node-a-out');
		if (!from_geometry) {
			throw new Error('missing from geometry');
		}
		const preview = {
			from: {
				node: EDGE_NODES[0],
				port: EDGE_NODES[0].ports[1],
				position: from_geometry.position,
			},
			pointer: { x: from_geometry.position.x + 120, y: from_geometry.position.y + 40 },
		};
		const { container } = render(
			<Graph_canvas>
				<Graph_edge_layer nodes={EDGE_NODES} edges={[]} preview={preview} />
			</Graph_canvas>,
		);
		const preview_path = container.querySelector('path[stroke="#f97316"]');
		expect(preview_path).toBeTruthy();
		expect(preview_path?.getAttribute('stroke-dasharray')).toBe('8 6');
	});

	test('passes route data to render_edge callback', () => {
		const render_edge = vi.fn(({ route }) => <path data-testid="custom-edge" d={route.path} />);
		const { getByTestId } = render(
			<Graph_canvas>
				<Graph_edge_layer nodes={EDGE_NODES} edges={EDGE_LIST} render_edge={render_edge} />
			</Graph_canvas>,
		);
		expect(render_edge).toHaveBeenCalled();
		const args = render_edge.mock.calls[0][0];
		expect(args.route.path).toMatch(/^M/);
		expect(args.route.metrics?.distance).toBeGreaterThan(0);
		expect(getByTestId('custom-edge')).toBeTruthy();
	});

	test('allows overriding routing logic with router prop', () => {
		const router = vi.fn(() => ({ kind: 'line', path: 'M 1 2 L 3 4' }));
		const { container } = render(
			<Graph_canvas>
				<Graph_edge_layer nodes={EDGE_NODES} edges={EDGE_LIST} router={router} />
			</Graph_canvas>,
		);
		expect(router).toHaveBeenCalled();
		const path = container.querySelector('path');
		expect(path?.getAttribute('d')).toBe('M 1 2 L 3 4');
	});

	test('default routing detours around blocking nodes', () => {
		const nodes: Node[] = [
			{
				id: 'start',
				type: 'Start',
				x: 40,
				y: 60,
				ports: [
					{ id: 'start-out', node_id: 'start', side: 'right', kind: 'out', index: 0 },
				],
			},
			{
				id: 'block',
				type: 'Blocker',
				x: 180,
				y: 30,
				ports: [],
			},
			{
				id: 'end',
				type: 'End',
				x: 360,
				y: 70,
				ports: [
					{ id: 'end-in', node_id: 'end', side: 'left', kind: 'in', index: 0 },
				],
			},
		];
		const edges: Edge[] = [
			{
				id: 'obstacle-edge',
				from: { node_id: 'start', port_id: 'start-out' },
				to: { node_id: 'end', port_id: 'end-in' },
			},
		];
		const render_edge = vi.fn(({ route }: Graph_edge_render_args) => (
			<path data-testid="obstacle-edge" d={route.path} />
		));
		render(
			<Graph_canvas>
				<Graph_edge_layer nodes={nodes} edges={edges} render_edge={render_edge} />
			</Graph_canvas>,
		);
		expect(render_edge).toHaveBeenCalled();
		const args = render_edge.mock.calls[0][0] as Graph_edge_render_args;
		expect(args.route.kind).toBe('quadratic');
		const sample = sample_quadratic_path(args.route.path, 0.5);
		const blocker = nodes[1];
		const blocker_rect = {
			x: blocker.x,
			y: blocker.y,
			width: blocker.w ?? 180,
			height: blocker.h ?? 104,
		};
		const outside =
			sample.x <= blocker_rect.x ||
			sample.x >= blocker_rect.x + blocker_rect.width ||
			sample.y <= blocker_rect.y ||
			sample.y >= blocker_rect.y + blocker_rect.height;
		expect(outside).toBe(true);
	});
});

function sample_quadratic_path(path: string, t: number) {
	const move = path.match(/M ([^ ]+) ([^ ]+)/);
	const quad = path.match(/Q ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)/);
	if (!move || !quad) {
		return { x: 0, y: 0 };
	}
	const from = { x: Number(move[1]), y: Number(move[2]) };
	const control = { x: Number(quad[1]), y: Number(quad[2]) };
	const to = { x: Number(quad[3]), y: Number(quad[4]) };
	const one_minus_t = 1 - t;
	return {
		x: one_minus_t * one_minus_t * from.x + 2 * one_minus_t * t * control.x + t * t * to.x,
		y: one_minus_t * one_minus_t * from.y + 2 * one_minus_t * t * control.y + t * t * to.y,
	};
}
