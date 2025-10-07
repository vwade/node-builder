import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Node } from '../src/core/types.js';
import { Graph_canvas } from '../src/react/canvas.js';
import { Graph_node_layer } from '../src/react/nodes.js';
import type { Graph_node_drag_event } from '../src/react/nodes.js';

const SAMPLE_NODES: Node[] = [
	{
		id: 'node-a',
		type: 'Alpha',
		x: 20,
		y: 30,
		ports: [],
	},
	{
		id: 'node-b',
		type: 'Beta',
		x: 140,
		y: 80,
		ports: [],
	},
];

describe('Graph_node_layer', () => {
	test('renders nodes with the default surface', () => {
		render(
			<Graph_canvas>
				<Graph_node_layer nodes={SAMPLE_NODES} />
			</Graph_canvas>,
		);
		const alpha = screen.getByText('Alpha');
		expect(alpha).toBeTruthy();
		const beta = screen.getByText('Beta');
		expect(beta).toBeTruthy();
	});

	test('emits drag updates for the selected node group', () => {
		const on_drag = vi.fn();
		const on_drag_start = vi.fn();
		const on_drag_end = vi.fn();
		const selected = new Set(['node-a', 'node-b']);
		const { container } = render(
			<Graph_canvas>
				<Graph_node_layer
					nodes={SAMPLE_NODES}
					selected_ids={selected}
					on_drag_start={on_drag_start}
					on_drag={on_drag}
					on_drag_end={on_drag_end}
				/>
			</Graph_canvas>,
		);
		// ...existing code...
		const target = container.querySelector('[data-node-id="node-a"]') as HTMLElement;
		// No need to manually mock pointer capture methods
		// ...existing code...
		fireEvent.pointerDown(target, {
			pointerId: 1,
			clientX: 200,
			clientY: 120,
			button: 0,
			buttons: 1,
			bubbles: true,
		});
		fireEvent.pointerMove(target, {
			pointerId: 1,
			clientX: 218,
			clientY: 148,
			buttons: 1,
			bubbles: true,
		});
		fireEvent.pointerUp(target, {
			pointerId: 1,
			clientX: 218,
			clientY: 148,
			button: 0,
			buttons: 0,
			bubbles: true,
		});
		expect(on_drag_start).toHaveBeenCalledTimes(1);
		expect(on_drag).toHaveBeenCalled();
		expect(on_drag_end).toHaveBeenCalledTimes(1);
		const payload = on_drag.mock.calls.at(-1)?.[0] as Graph_node_drag_event | undefined;
		expect(payload).toBeDefined();
		if (!payload) {
			throw new Error('expected drag payload');
		}
		expect(payload.delta).toEqual({ x: 18, y: 28 });
		expect(payload.positions.get('node-a')).toEqual({ x: 38, y: 58 });
		expect(payload.positions.get('node-b')).toEqual({ x: 158, y: 108 });
	});

	test('scales drag deltas according to the camera zoom', () => {
		const on_drag = vi.fn();
		const { container } = render(
			<Graph_canvas initial_camera={{ scale: 2 }}>
				<Graph_node_layer nodes={SAMPLE_NODES} on_drag={on_drag} />
			</Graph_canvas>,
		);
		const target = container.querySelector('[data-node-id="node-a"]') as HTMLElement;
		// No need to manually mock pointer capture methods
		fireEvent.pointerDown(target, {
			pointerId: 5,
			clientX: 100,
			clientY: 100,
			button: 0,
			buttons: 1,
			bubbles: true,
		});
		fireEvent.pointerMove(target, {
			pointerId: 5,
			clientX: 140,
			clientY: 160,
			buttons: 1,
			bubbles: true,
		});
		const payload = on_drag.mock.calls.at(-1)?.[0] as Graph_node_drag_event | undefined;
		expect(payload).toBeDefined();
		if (!payload) {
			throw new Error('expected drag payload');
		}
		expect(payload.delta).toEqual({ x: 20, y: 30 });
	});

	test('does not throw when pointer capture APIs are missing', () => {
		const { container } = render(<Graph_canvas />);
		const canvas = container.firstElementChild as HTMLElement;
		expect(canvas).toBeTruthy();
		expect(() => {
			fireEvent.pointerDown(canvas, {
				pointerId: 9,
				clientX: 10,
				clientY: 10,
				button: 0,
				buttons: 1,
				bubbles: true,
			});
			fireEvent.pointerMove(canvas, {
				pointerId: 9,
				clientX: 24,
				clientY: 18,
				buttons: 1,
				bubbles: true,
			});
			fireEvent.pointerUp(canvas, {
				pointerId: 9,
				clientX: 24,
				clientY: 18,
				button: 0,
				buttons: 0,
				bubbles: true,
			});
		}).not.toThrow();
	});
});
