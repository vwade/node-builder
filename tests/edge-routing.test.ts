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
});
