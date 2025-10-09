import { describe, expect, it } from 'vitest';
import { route_edge } from '../src/react/edge-routing.js';

describe('route_edge', () => {
	it('returns a straight line when anchors face each other closely', () => {
		const from = {
			position: { x: 0, y: 0 },
			normal: { x: 1, y: 0 },
		};
		const to = {
			position: { x: 24, y: 0 },
			normal: { x: -1, y: 0 },
		};
		const route = route_edge(from, to);
		expect(route.kind).toBe('line');
		expect(route.path).toBe('M 0 0 L 24 0');
		expect(route.metrics?.curvature).toBe(0);
	});

	it('generates a quadratic path when anchors diverge', () => {
		const from = {
			position: { x: 0, y: 0 },
			normal: { x: 1, y: 0 },
		};
		const to = {
			position: { x: 120, y: 80 },
			normal: { x: 0, y: -1 },
		};
		const route = route_edge(from, to);
		expect(route.kind).toBe('quadratic');
		expect(route.path.startsWith('M 0 0 Q ')).toBe(true);
		expect(route.path.endsWith('120 80')).toBe(true);
		expect(route.control).toBeDefined();
		expect(route.handles?.from).toBeDefined();
		expect(route.metrics?.curvature ?? 0).toBeGreaterThan(0);
	});

	it('treats zero curvature as a straight line', () => {
		const from = {
			position: { x: 10, y: -10 },
			normal: { x: 0, y: 1 },
		};
		const to = {
			position: { x: 10, y: 90 },
			normal: { x: 0, y: -1 },
		};
		const route = route_edge(from, to, { curvature: 0 });
		expect(route.kind).toBe('line');
		expect(route.path).toBe('M 10 -10 L 10 90');
		expect(route.metrics?.curvature).toBe(0);
	});

	it('adjusts curvature based on anchor alignment and distance', () => {
		const aligned = route_edge(
			{
			position: { x: 0, y: 0 },
			normal: { x: 1, y: 0 },
			},
			{
			position: { x: 160, y: 0 },
			normal: { x: -1, y: 0 },
			},
		);
		const misaligned = route_edge(
			{
			position: { x: 0, y: 0 },
			normal: { x: 0, y: 1 },
			},
			{
			position: { x: 0, y: 160 },
			normal: { x: 0, y: 1 },
			},
		);
		const aligned_curvature = aligned.metrics?.curvature ?? 0;
		const misaligned_curvature = misaligned.metrics?.curvature ?? 0;
		expect(misaligned_curvature).toBeGreaterThan(aligned_curvature);
		expect(misaligned_curvature).toBeGreaterThan(0);
	});

	it('detours around rectangular obstacles by introducing curvature', () => {
		const from = {
			position: { x: 0, y: 0 },
			normal: { x: 1, y: 0 },
		};
		const to = {
			position: { x: 200, y: 0 },
			normal: { x: -1, y: 0 },
		};
		const obstacle = { id: 'blocker', x: 80, y: -32, width: 72, height: 64 };
		const route = route_edge(from, to, { obstacles: [obstacle], obstacle_padding: 12 });
		expect(route.kind).toBe('quadratic');
		expect(route.control).toBeDefined();
		expect(route.metrics?.curvature ?? 0).toBeGreaterThan(0);
		const midpoint = sample_quadratic(route, 0.5);
		const outside =
			midpoint.x <= obstacle.x ||
			midpoint.x >= obstacle.x + obstacle.width ||
			midpoint.y <= obstacle.y ||
			midpoint.y >= obstacle.y + obstacle.height;
		expect(outside).toBe(true);
	});

	it('nudges existing curves away from interfering obstacles', () => {
		const from = {
			position: { x: 40, y: 20 },
			normal: { x: 1, y: 0 },
		};
		const to = {
			position: { x: 220, y: 140 },
			normal: { x: -1, y: 0 },
		};
		const baseline = route_edge(from, to);
		if (!baseline.control) {
			throw new Error('expected control point');
		}
		const obstacle = {
			id: 'focus',
			x: baseline.control.x - 24,
			y: baseline.control.y - 24,
			width: 48,
			height: 48,
		};
		const adjusted = route_edge(from, to, { obstacles: [obstacle], obstacle_padding: 8 });
		expect(adjusted.kind).toBe('quadratic');
		expect(adjusted.control).toBeDefined();
		const delta_x = Math.abs((adjusted.control?.x ?? 0) - baseline.control.x);
		const delta_y = Math.abs((adjusted.control?.y ?? 0) - baseline.control.y);
		const displacement = Math.hypot(delta_x, delta_y);
		expect(displacement).toBeGreaterThan(4);
		const adjusted_mid = sample_quadratic(adjusted, 0.5);
		const avoids =
			adjusted_mid.x <= obstacle.x || adjusted_mid.x >= obstacle.x + obstacle.width ||
			adjusted_mid.y <= obstacle.y || adjusted_mid.y >= obstacle.y + obstacle.height;
		expect(avoids).toBe(true);
	});

	it('ignores specific obstacles when ids are provided', () => {
		const from = {
			position: { x: 0, y: 0 },
			normal: { x: 1, y: 0 },
			};
		const to = {
			position: { x: 200, y: 0 },
			normal: { x: -1, y: 0 },
			};
		const baseline = route_edge(from, to);
		const obstacle = { id: 'skip-me', x: 80, y: -32, width: 72, height: 64 };
		const blocked = route_edge(from, to, { obstacles: [obstacle], obstacle_padding: 12 });
		const ignored = route_edge(from, to, {
			obstacles: [obstacle],
			obstacle_padding: 12,
			ignore_obstacle_ids: ['skip-me'],
			});
		expect(blocked.path).not.toBe(baseline.path);
		expect(ignored.path).toBe(baseline.path);
		});
});

function sample_quadratic(route: ReturnType<typeof route_edge>, t: number) {
	const start = route.path.match(/M ([^ ]+) ([^ ]+)/);
	const curve = route.path.match(/Q ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)/);
	if (!start || !curve) {
		return { x: 0, y: 0 };
	}
	const from = { x: Number(start[1]), y: Number(start[2]) };
	const control = { x: Number(curve[1]), y: Number(curve[2]) };
	const to = { x: Number(curve[3]), y: Number(curve[4]) };
	const one_minus_t = 1 - t;
	return {
		x: one_minus_t * one_minus_t * from.x + 2 * one_minus_t * t * control.x + t * t * to.x,
		y: one_minus_t * one_minus_t * from.y + 2 * one_minus_t * t * control.y + t * t * to.y,
	};
}
