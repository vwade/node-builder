import type { Point } from './camera.js';

export interface Edge_anchor {
	position: Point;
	normal: Point;
}

export type Edge_route_kind = 'line' | 'quadratic';

export interface Edge_route_options {
	/**
	 * Curvature blend between 0 (straight line) and 1 (maximum curve).
	 * Defaults to 0.6 to keep gentle bends on standard port layouts.
	 */
	curvature?: number;
	/** Minimum handle distance when generating curves. */
	min_handle?: number;
	/**
	 * Ratio of the distance between anchors used as the base handle length.
	 * The resolved handle will be `distance * handle_ratio` clamped by
	 * `min_handle`.
	 */
	handle_ratio?: number;
}

export interface Edge_route_result {
	kind: Edge_route_kind;
	path: string;
}

const DEFAULT_CURVATURE = 0.6;
const DEFAULT_MIN_HANDLE = 40;
const DEFAULT_HANDLE_RATIO = 0.45;
const STRAIGHT_ALIGNMENT_THRESHOLD = 0.9;
const STRAIGHT_DISTANCE_THRESHOLD = 32;

export function route_edge(
	from: Edge_anchor,
	to: Edge_anchor,
	options: Edge_route_options = {},
): Edge_route_result {
	const curvature = clamp01(options.curvature ?? DEFAULT_CURVATURE);
	const min_handle = options.min_handle ?? DEFAULT_MIN_HANDLE;
	const handle_ratio = options.handle_ratio ?? DEFAULT_HANDLE_RATIO;
	const delta = {
		x: to.position.x - from.position.x,
		y: to.position.y - from.position.y,
	};
	const distance = Math.hypot(delta.x, delta.y);
	if (!Number.isFinite(distance) || distance === 0) {
		return {
			kind: 'line',
			path: `M ${from.position.x} ${from.position.y} L ${to.position.x} ${to.position.y}`,
		};
	}
	const unit = { x: delta.x / distance, y: delta.y / distance };
	const from_normal = normalize(from.normal);
	const to_normal = normalize(to.normal);
	const from_alignment = dot(from_normal, unit);
	const to_alignment = -dot(to_normal, unit);
	if (
		curvature <= Number.EPSILON ||
		(distance <= STRAIGHT_DISTANCE_THRESHOLD &&
			from_alignment >= STRAIGHT_ALIGNMENT_THRESHOLD &&
			to_alignment >= STRAIGHT_ALIGNMENT_THRESHOLD)
	) {
		return {
			kind: 'line',
			path: `M ${from.position.x} ${from.position.y} L ${to.position.x} ${to.position.y}`,
		};
	}
	const handle_length = Math.max(min_handle, distance * handle_ratio * curvature);
	const from_handle = {
		x: from.position.x + from_normal.x * handle_length,
		y: from.position.y + from_normal.y * handle_length,
	};
	const to_handle = {
		x: to.position.x + to_normal.x * handle_length,
		y: to.position.y + to_normal.y * handle_length,
	};
	const control = {
		x: (from_handle.x + to_handle.x) / 2,
		y: (from_handle.y + to_handle.y) / 2,
	};
	return {
		kind: 'quadratic',
		path: `M ${from.position.x} ${from.position.y} Q ${control.x} ${control.y} ${to.position.x} ${to.position.y}`,
	};
}

function normalize(vector: Point): Point {
	const length = Math.hypot(vector.x, vector.y);
	if (!length) {
		return { x: 0, y: 0 };
	}
	return { x: vector.x / length, y: vector.y / length };
}

function dot(a: Point, b: Point): number {
	return a.x * b.x + a.y * b.y;
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) {
		return DEFAULT_CURVATURE;
	}
	return Math.min(1, Math.max(0, value));
}
