import { describe, expect, it } from 'vitest';
import {
	DEFAULT_TRANSFORM,
	DEFAULT_ZOOM_OPTIONS,
	pan_by,
	to_screen,
	to_world,
	zoom_at,
	type Canvas_point,
} from '../src/react/transform.js';

function expect_points_close(actual: Canvas_point, expected: Canvas_point, precision = 6): void {
	expect(actual.x).toBeCloseTo(expected.x, precision);
	expect(actual.y).toBeCloseTo(expected.y, precision);
}

describe('canvas transform helpers', () => {
	it('pans by offsets and preserves identity when stationary', () => {
		const start = { x: 10, y: -20, scale: 1 };
		const moved = pan_by(start, 5, -10);
		expect(moved).toEqual({ x: 15, y: -30, scale: 1 });
		expect(pan_by(start, 0, 0)).toBe(start);
	});

	it('converts between world and screen coordinates', () => {
		const transform = { x: 100, y: 50, scale: 2 };
		const world = { x: 10, y: 5 };
		const screen = to_screen(transform, world);
		expect(screen).toEqual({ x: 120, y: 60 });
		expect(to_world(transform, screen)).toEqual(world);
	});

	it('zooms around a pointer while keeping the anchor stable', () => {
		const pointer = { x: 150, y: 200 };
		const before_world = to_world(DEFAULT_TRANSFORM, pointer);
		const next = zoom_at(DEFAULT_TRANSFORM, pointer, -120, {
			...DEFAULT_ZOOM_OPTIONS,
			zoom_sensitivity: 0.001,
		});
		const expected_scale = Math.exp(0.12);
		expect(next.scale).toBeCloseTo(expected_scale, 6);
		const after_world = to_world(next, pointer);
		expect_points_close(after_world, before_world);
	});

	it('clamps zoom to configured bounds', () => {
		const pointer = { x: 0, y: 0 };
		const options = { ...DEFAULT_ZOOM_OPTIONS, min_scale: 0.5, max_scale: 2 };
		const zoomed_out = zoom_at(DEFAULT_TRANSFORM, pointer, 10_000, options);
		expect(zoomed_out.scale).toBe(options.min_scale);
		const zoomed_in = zoom_at(DEFAULT_TRANSFORM, pointer, -10_000, options);
		expect(zoomed_in.scale).toBe(options.max_scale);
	});
});
