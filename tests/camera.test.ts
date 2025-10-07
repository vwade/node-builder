import { describe, expect, it } from 'vitest';
import {
	DEFAULT_CAMERA_LIMITS,
	DEFAULT_CAMERA_STATE,
	clamp_scale,
	pan_camera,
	reset_camera,
	zoom_camera,
} from '../src/react/camera.js';

describe('camera utilities', () => {
	it('clamps scale within bounds', () => {
		const limits = { min_scale: 0.5, max_scale: 2 } satisfies typeof DEFAULT_CAMERA_LIMITS;
		expect(clamp_scale(0.1, limits)).toBe(0.5);
		expect(clamp_scale(5, limits)).toBe(2);
		expect(clamp_scale(1.5, limits)).toBe(1.5);
	});

	it('returns original camera when pan deltas are zero', () => {
		const camera = { ...DEFAULT_CAMERA_STATE };
		expect(pan_camera(camera, 0, 0)).toBe(camera);
	});

	it('offsets camera when panning', () => {
		const camera = { ...DEFAULT_CAMERA_STATE };
		const panned = pan_camera(camera, 10, -5);
		expect(panned).not.toBe(camera);
		expect(panned.x).toBe(10);
		expect(panned.y).toBe(-5);
		expect(panned.scale).toBe(camera.scale);
	});

	it('zooms relative to a pivot point', () => {
		const camera = { x: 10, y: 20, scale: 1 } satisfies typeof DEFAULT_CAMERA_STATE;
		const pivot = { x: 30, y: 40 };
		const zoomed = zoom_camera(camera, 2, pivot, DEFAULT_CAMERA_LIMITS);
		expect(zoomed.scale).toBeCloseTo(2);
		const before_world = {
			x: (pivot.x - camera.x) / camera.scale,
			y: (pivot.y - camera.y) / camera.scale,
		};
		const after_world = {
			x: (pivot.x - zoomed.x) / zoomed.scale,
			y: (pivot.y - zoomed.y) / zoomed.scale,
		};
		expect(after_world.x).toBeCloseTo(before_world.x, 5);
		expect(after_world.y).toBeCloseTo(before_world.y, 5);
	});

	it('resets to fallback camera state', () => {
		const camera = { x: 5, y: 5, scale: 0.75 } satisfies typeof DEFAULT_CAMERA_STATE;
		const fallback = { x: 1, y: 2, scale: 1 } satisfies typeof DEFAULT_CAMERA_STATE;
		const reset = reset_camera(camera, fallback);
		expect(reset).not.toBe(camera);
		expect(reset).toEqual(fallback);
	});
});
