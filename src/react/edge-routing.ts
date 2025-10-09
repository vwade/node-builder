import type { Point } from './camera.js';

export interface Edge_anchor {
	position: Point;
	normal: Point;
}

export type Edge_route_kind = 'line' | 'quadratic';

export interface Edge_obstacle {
	id?: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

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
	/** Rectangular regions the router should avoid when possible. */
	obstacles?: Edge_obstacle[];
	/** Extra padding applied around each obstacle. */
	obstacle_padding?: number;
	/** Number of curve samples used when testing obstacle overlaps. */
	obstacle_samples?: number;
	/** Obstacle identifiers that should be ignored during routing. */
	ignore_obstacle_ids?: string[];
}

export interface Edge_route_diagnostics_options {
	/** Number of samples collected across the resolved path. */
	samples?: number;
	/**
	 * Optional obstacle list override. When omitted the router's obstacle set
	 * (after padding) is used for diagnostics.
	 */
	obstacles?: Edge_obstacle[];
	/** Extra padding applied when expanding diagnostic obstacle regions. */
	obstacle_padding?: number;
}

export interface Edge_route_obstacle_hit {
	obstacle: Edge_obstacle;
	point: Point;
	sample_index: number;
}

export interface Edge_route_diagnostics {
	samples: Point[];
	obstacle_hits: Edge_route_obstacle_hit[];
	intersects: boolean;
	min_clearance: number;
	total_length: number;
}

export interface Edge_route_metrics {
	curvature: number;
	distance: number;
	from_alignment: number;
	to_alignment: number;
	average_alignment: number;
}

export interface Edge_route_result {
	kind: Edge_route_kind;
	path: string;
	control?: Point;
	handles?: { from: Point; to: Point };
	metrics?: Edge_route_metrics;
}

const DEFAULT_CURVATURE = 0.6;
const DEFAULT_MIN_HANDLE = 40;
const DEFAULT_HANDLE_RATIO = 0.45;
const DEFAULT_OBSTACLE_PADDING = 12;
const DEFAULT_OBSTACLE_SAMPLES = 12;
const DEFAULT_DIAGNOSTIC_SAMPLES = 24;
const STRAIGHT_ALIGNMENT_THRESHOLD = 0.9;
const STRAIGHT_DISTANCE_THRESHOLD = 32;
const STRAIGHT_CURVATURE_THRESHOLD = 0.15;
const CURVATURE_DISTANCE_RANGE = 240;
const OBSTACLE_SHIFT_MULTIPLIER = 0.65;
const OBSTACLE_SHIFT_ATTEMPTS = [
	{ direction: 1, scale: 1 },
	{ direction: -1, scale: 1 },
	{ direction: 1, scale: 1.5 },
	{ direction: -1, scale: 1.5 },
];
const OBSTACLE_SHIFT_MAX_SCALE = OBSTACLE_SHIFT_ATTEMPTS.reduce(
	(max, attempt) => Math.max(max, Math.abs(attempt.scale)),
	0,
);
const OBSTACLE_SHIFT_FALLBACK_MULTIPLIER = 3;
const OBSTACLE_SHIFT_FALLBACK_STEP = 0.5;

export function route_edge(
	from: Edge_anchor,
	to: Edge_anchor,
	options: Edge_route_options = {},
): Edge_route_result {
	const base_curvature = clamp01(options.curvature ?? DEFAULT_CURVATURE);
	const min_handle = options.min_handle ?? DEFAULT_MIN_HANDLE;
	const handle_ratio = options.handle_ratio ?? DEFAULT_HANDLE_RATIO;
	const delta = {
		x: to.position.x - from.position.x,
		y: to.position.y - from.position.y,
	};
	const distance = Math.hypot(delta.x, delta.y);
	const metrics: Edge_route_metrics = {
		curvature: 0,
		distance,
		from_alignment: 0,
		to_alignment: 0,
		average_alignment: 0,
	};
	if (!Number.isFinite(distance) || distance === 0) {
		return {
			kind: 'line',
			path: `M ${from.position.x} ${from.position.y} L ${to.position.x} ${to.position.y}`,
			metrics,
		};
	}
	const unit = { x: delta.x / distance, y: delta.y / distance };
	const from_normal = normalize(from.normal);
	const to_normal = normalize(to.normal);
	const from_alignment = dot(from_normal, unit);
	const to_alignment = -dot(to_normal, unit);
	metrics.from_alignment = from_alignment;
	metrics.to_alignment = to_alignment;
	const average_alignment = clamp01((from_alignment + to_alignment) / 2);
	metrics.average_alignment = average_alignment;
	const misalignment = 1 - average_alignment;
	const distance_factor = clamp01((distance - STRAIGHT_DISTANCE_THRESHOLD) / CURVATURE_DISTANCE_RANGE);
	let resolved_curvature = clamp01(
		base_curvature * (0.35 + misalignment * 0.65) +
			misalignment * 0.45 +
			distance_factor * 0.2,
	);
	metrics.curvature = resolved_curvature;
	let route: Edge_route_result;
	if (
		resolved_curvature <= Number.EPSILON ||
		(distance <= STRAIGHT_DISTANCE_THRESHOLD &&
			from_alignment >= STRAIGHT_ALIGNMENT_THRESHOLD &&
			to_alignment >= STRAIGHT_ALIGNMENT_THRESHOLD) ||
		(average_alignment >= STRAIGHT_ALIGNMENT_THRESHOLD &&
			resolved_curvature < STRAIGHT_CURVATURE_THRESHOLD)
	) {
		const line_metrics = { ...metrics, curvature: 0 };
		route = {
			kind: 'line',
			path: `M ${from.position.x} ${from.position.y} L ${to.position.x} ${to.position.y}`,
			metrics: line_metrics,
		};
	} else {
		const handles = compute_handles(from, to, from_normal, to_normal, distance, resolved_curvature, min_handle, handle_ratio);
		const control = compute_control(handles.from, handles.to);
		route = {
			kind: 'quadratic',
			path: build_quadratic_path(from.position, control, to.position),
			control,
			handles,
			metrics,
		};
	}
	if (options.obstacles && options.obstacles.length) {
		const obstacle_padding = options.obstacle_padding ?? DEFAULT_OBSTACLE_PADDING;
		const obstacle_samples = options.obstacle_samples ?? DEFAULT_OBSTACLE_SAMPLES;
		route = avoid_obstacles({
			from,
			to,
			route,
			distance,
			unit,
			from_normal,
			to_normal,
			min_handle,
			handle_ratio,
			resolved_curvature,
			obstacles: options.obstacles,
			obstacle_padding,
			obstacle_samples,
			ignore_ids: options.ignore_obstacle_ids,
		});
		resolved_curvature = route.metrics?.curvature ?? resolved_curvature;
	}
	return route;
}


export function diagnose_edge_route(
	from: Edge_anchor,
	to: Edge_anchor,
	route: Edge_route_result,
	options: Edge_route_diagnostics_options = {},
): Edge_route_diagnostics {
	const sample_count = Math.max(2, Math.floor(options.samples ?? DEFAULT_DIAGNOSTIC_SAMPLES));
	const diagnostics_obstacles = options.obstacles ?? [];
	const padded_obstacles = diagnostics_obstacles.length
		? expand_obstacles(diagnostics_obstacles, options.obstacle_padding ?? 0)
		: diagnostics_obstacles;
	const points = sample_route_points(route, from.position, to.position, sample_count);
	const obstacle_hits: Edge_route_obstacle_hit[] = [];
	let min_clearance = Number.POSITIVE_INFINITY;
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index];
		for (const obstacle of padded_obstacles) {
			if (point_in_rect(point, obstacle)) {
				obstacle_hits.push({ obstacle, point, sample_index: index });
				min_clearance = 0;
				continue;
			}
			const distance = distance_to_rect(point, obstacle);
			if (distance < min_clearance) {
				min_clearance = distance;
			}
		}
	}
	if (!diagnostics_obstacles.length) {
		min_clearance = Number.POSITIVE_INFINITY;
	}
	const total_length = compute_path_length(points);
	return {
		samples: points,
		obstacle_hits,
		intersects: obstacle_hits.length > 0,
		min_clearance,
		total_length,
	};
}

function sample_route_points(
	route: Edge_route_result,
	from: Point,
	to: Point,
	samples: number,
): Point[] {
	if (route.kind === 'quadratic') {
		const control = route.control ?? parse_quadratic_control(route.path);
		if (control) {
			return sample_quadratic(from, control, to, samples);
		}
	}
	return sample_line(from, to, samples);
}

function parse_quadratic_control(path: string): Point | null {
	const match = path.match(/Q ([^ ]+) ([^ ]+) [^ ]+ [^ ]+/);
	if (!match) {
		return null;
	}
	const x = Number(match[1]);
	const y = Number(match[2]);
	if (Number.isNaN(x) || Number.isNaN(y)) {
		return null;
	}
	return { x, y };
}

function sample_line(from: Point, to: Point, samples: number): Point[] {
	const points: Point[] = [];
	for (let step = 0; step <= samples; step += 1) {
		const t = samples === 0 ? 0 : step / samples;
		points.push({
			x: from.x + (to.x - from.x) * t,
			y: from.y + (to.y - from.y) * t,
		});
	}
	return points;
}

function compute_path_length(points: Point[]): number {
	let length = 0;
	for (let index = 0; index < points.length - 1; index += 1) {
		const current = points[index];
		const next = points[index + 1];
		length += Math.hypot(next.x - current.x, next.y - current.y);
	}
	return length;
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

function compute_handles(
	from: Edge_anchor,
	to: Edge_anchor,
	from_normal: Point,
	to_normal: Point,
	distance: number,
	curvature: number,
	min_handle: number,
	handle_ratio: number,
): { from: Point; to: Point } {
	const handle_length = Math.max(min_handle, distance * handle_ratio * curvature);
	return {
		from: {
			x: from.position.x + from_normal.x * handle_length,
			y: from.position.y + from_normal.y * handle_length,
		},
		to: {
			x: to.position.x + to_normal.x * handle_length,
			y: to.position.y + to_normal.y * handle_length,
		},
	};
}

function compute_control(from: Point, to: Point): Point {
	return {
		x: (from.x + to.x) / 2,
		y: (from.y + to.y) / 2,
	};
}

function build_quadratic_path(from: Point, control: Point, to: Point): string {
	return `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
}

interface Obstacle_context {
	from: Edge_anchor;
	to: Edge_anchor;
	route: Edge_route_result;
	distance: number;
	unit: Point;
	from_normal: Point;
	to_normal: Point;
	min_handle: number;
	handle_ratio: number;
	resolved_curvature: number;
	obstacles: Edge_obstacle[];
	obstacle_padding: number;
	obstacle_samples: number;
	ignore_ids?: string[];
}

function avoid_obstacles(context: Obstacle_context): Edge_route_result {
	const { route } = context;
	if (route.kind === 'line') {
		return reroute_line(context);
	}
	if (route.kind === 'quadratic' && route.control) {
		return adjust_quadratic(context);
	}
	return route;
}

function reroute_line(context: Obstacle_context): Edge_route_result {
	const {
		from,
		to,
		unit,
		min_handle,
		handle_ratio,
		resolved_curvature,
		distance,
		obstacles,
		obstacle_padding,
		obstacle_samples,
	} = context;
	if (!obstacles.length) {
		return context.route;
	}
	const effective_obstacles = filter_endpoint_obstacles(
		expand_obstacles(obstacles, obstacle_padding),
		from.position,
		to.position,
		context.ignore_ids,
	);
	if (!line_hits_obstacle(from.position, to.position, effective_obstacles)) {
		return context.route;
	}
	const detour_curvature = Math.max(resolved_curvature, 0.45);
	const handles = compute_handles(
		from,
		to,
		normalize(from.normal),
		normalize(to.normal),
		distance,
		detour_curvature,
		min_handle,
		handle_ratio,
	);
	const perpendicular = { x: -unit.y, y: unit.x };
	const detour_base = Math.max(distance * OBSTACLE_SHIFT_MULTIPLIER, min_handle, obstacle_padding * 2);
	for (const attempt of OBSTACLE_SHIFT_ATTEMPTS) {
		const offset = detour_base * attempt.scale * attempt.direction;
		const shifted_handles = shift_handles(handles, perpendicular, offset);
		const control = compute_control(shifted_handles.from, shifted_handles.to);
		if (!curve_hits_obstacle(from.position, control, to.position, effective_obstacles, obstacle_samples)) {
			const metrics = merge_route_metrics(
				context.route.metrics,
				{ curvature: detour_curvature },
				context.distance,
			);
			return {
				kind: 'quadratic',
				path: build_quadratic_path(from.position, control, to.position),
				control,
				handles: shifted_handles,
				metrics,
			};
		}
	}
	const base_control = compute_control(handles.from, handles.to);
	let fallback_route = context.route;
	let fallback_projection = 0;
	for (const direction of [1, -1]) {
		for (
			let scale = OBSTACLE_SHIFT_MAX_SCALE;
			scale <= OBSTACLE_SHIFT_MAX_SCALE * OBSTACLE_SHIFT_FALLBACK_MULTIPLIER;
			scale += OBSTACLE_SHIFT_FALLBACK_STEP
		) {
			const signed_scale = scale * direction;
			if (!signed_scale) {
				continue;
			}
			const offset = detour_base * signed_scale;
			const shifted_handles = shift_handles(handles, perpendicular, offset);
			const control = compute_control(shifted_handles.from, shifted_handles.to);
			const metrics = merge_route_metrics(
				context.route.metrics,
				{ curvature: detour_curvature },
				context.distance,
			);
			if (!curve_hits_obstacle(from.position, control, to.position, effective_obstacles, obstacle_samples)) {
				return {
					kind: 'quadratic',
					path: build_quadratic_path(from.position, control, to.position),
					control,
					handles: shifted_handles,
					metrics,
				};
			}
			const projection = Math.abs(
				perpendicular.x * (control.x - base_control.x) + perpendicular.y * (control.y - base_control.y),
			);
			if (projection > fallback_projection) {
				fallback_projection = projection;
				fallback_route = {
					kind: 'quadratic',
					path: build_quadratic_path(from.position, control, to.position),
					control,
					handles: shifted_handles,
					metrics,
				};
			}
		}
	}
	return fallback_route;
}

function adjust_quadratic(context: Obstacle_context): Edge_route_result {
	const {
		from,
		to,
		route,
		unit,
		obstacles,
		obstacle_padding,
		obstacle_samples,
	} = context;
	if (!route.control) {
		return route;
	}
	const effective_obstacles = filter_endpoint_obstacles(
		expand_obstacles(obstacles, obstacle_padding),
		from.position,
		to.position,
		context.ignore_ids,
	);
	const base_intersects = line_hits_obstacle(from.position, to.position, effective_obstacles);
	if (!curve_hits_obstacle(from.position, route.control, to.position, effective_obstacles, obstacle_samples) && !base_intersects) {
		return route;
	}
	const perpendicular = { x: -unit.y, y: unit.x };
	const handles = route.handles ?? {
		from: route.control,
		to: route.control,
	};
	const shift_base = Math.max(context.min_handle, context.distance * 0.35, obstacle_padding * 2);
	for (const attempt of OBSTACLE_SHIFT_ATTEMPTS) {
		const offset = shift_base * attempt.scale * attempt.direction;
		const shifted_handles = shift_handles(handles, perpendicular, offset);
		const control = compute_control(shifted_handles.from, shifted_handles.to);
		if (!curve_hits_obstacle(from.position, control, to.position, effective_obstacles, obstacle_samples)) {
			const metrics = merge_route_metrics(
				route.metrics,
				{ curvature: Math.max(route.metrics?.curvature ?? 0, context.resolved_curvature) },
				context.distance,
			);
			return {
				kind: 'quadratic',
				path: build_quadratic_path(from.position, control, to.position),
				control,
				handles: shifted_handles,
				metrics,
			};
		}
	}
	const base_control = route.control;
	let fallback_route = route;
	let fallback_projection = 0;
	for (const direction of [1, -1]) {
		for (
			let scale = OBSTACLE_SHIFT_MAX_SCALE;
			scale <= OBSTACLE_SHIFT_MAX_SCALE * OBSTACLE_SHIFT_FALLBACK_MULTIPLIER;
			scale += OBSTACLE_SHIFT_FALLBACK_STEP
		) {
			const signed_scale = scale * direction;
			if (!signed_scale) {
				continue;
			}
			const offset = shift_base * signed_scale;
			const shifted_handles = shift_handles(handles, perpendicular, offset);
			const control = compute_control(shifted_handles.from, shifted_handles.to);
			const metrics = merge_route_metrics(
				route.metrics,
				{ curvature: Math.max(route.metrics?.curvature ?? 0, context.resolved_curvature) },
				context.distance,
			);
			if (!curve_hits_obstacle(from.position, control, to.position, effective_obstacles, obstacle_samples)) {
				return {
					kind: 'quadratic',
					path: build_quadratic_path(from.position, control, to.position),
					control,
					handles: shifted_handles,
					metrics,
				};
			}
			const projection = Math.abs(
				perpendicular.x * (control.x - (base_control?.x ?? control.x)) +
				perpendicular.y * (control.y - (base_control?.y ?? control.y)),
			);
			if (projection > fallback_projection) {
				fallback_projection = projection;
				fallback_route = {
					kind: 'quadratic',
					path: build_quadratic_path(from.position, control, to.position),
					control,
					handles: shifted_handles,
					metrics,
				};
			}
		}
	}
	return fallback_route;
}

function shift_handles(
	handles: { from: Point; to: Point },
	direction: Point,
	offset: number,
): { from: Point; to: Point } {
	return {
		from: {
			x: handles.from.x + direction.x * offset,
			y: handles.from.y + direction.y * offset,
		},
		to: {
			x: handles.to.x + direction.x * offset,
			y: handles.to.y + direction.y * offset,
		},
	};
}

function expand_obstacles(obstacles: Edge_obstacle[], padding: number): Edge_obstacle[] {
	if (padding <= 0) {
		return obstacles;
	}
	return obstacles.map((obstacle) => ({
		...obstacle,
		x: obstacle.x - padding,
		y: obstacle.y - padding,
		width: obstacle.width + padding * 2,
		height: obstacle.height + padding * 2,
	}));
}

function line_hits_obstacle(
	from: Point,
	to: Point,
	obstacles: Edge_obstacle[],
	allow_from_inside = false,
	allow_to_inside = false,
): boolean {
	for (const obstacle of obstacles) {
		const from_inside = point_in_rect(from, obstacle);
		const to_inside = point_in_rect(to, obstacle);
		if ((from_inside && !allow_from_inside) || (to_inside && !allow_to_inside)) {
			return true;
		}
		if (segment_intersects_rect(from, to, obstacle)) {
			return true;
		}
	}
	return false;
}

function curve_hits_obstacle(
	from: Point,
	control: Point,
	to: Point,
	obstacles: Edge_obstacle[],
	samples: number,
): boolean {
	const points = sample_quadratic(from, control, to, Math.max(3, samples));
	const start_obstacles = obstacles.filter((obstacle) => point_in_rect(from, obstacle));
	const end_obstacles = obstacles.filter((obstacle) => point_in_rect(to, obstacle));
	const start_set = new Set(start_obstacles);
	const end_set = new Set(end_obstacles);
	const point_memberships = points.map((point) =>
		obstacles.filter((obstacle) => point_in_rect(point, obstacle)),
	);
	for (let index = 1; index < point_memberships.length - 1; index += 1) {
		if (point_memberships[index].length) {
			return true;
		}
	}
	for (let index = 0; index < points.length - 1; index += 1) {
		const from_members = point_memberships[index];
		const to_members = point_memberships[index + 1];
		const allow_from = from_members.some(
			(obstacle) => start_set.has(obstacle) || end_set.has(obstacle),
		);
		const allow_to = to_members.some(
			(obstacle) => start_set.has(obstacle) || end_set.has(obstacle),
		);
		if (line_hits_obstacle(points[index], points[index + 1], obstacles, allow_from, allow_to)) {
			return true;
		}
	}
	return false;
}

function sample_quadratic(from: Point, control: Point, to: Point, samples: number): Point[] {
	const points: Point[] = [];
	for (let step = 0; step <= samples; step += 1) {
		const t = step / samples;
		points.push(resolve_quadratic_point(from, control, to, t));
	}
	return points;
}

function resolve_quadratic_point(from: Point, control: Point, to: Point, t: number): Point {
	const one_minus_t = 1 - t;
	const x = one_minus_t * one_minus_t * from.x + 2 * one_minus_t * t * control.x + t * t * to.x;
	const y = one_minus_t * one_minus_t * from.y + 2 * one_minus_t * t * control.y + t * t * to.y;
	return { x, y };
}

function merge_route_metrics(
	source: Edge_route_metrics | undefined,
	updates: Partial<Edge_route_metrics>,
	fallback_distance: number,
): Edge_route_metrics {
	return {
		curvature: updates.curvature ?? source?.curvature ?? 0,
		distance: updates.distance ?? source?.distance ?? fallback_distance,
		from_alignment: updates.from_alignment ?? source?.from_alignment ?? 0,
		to_alignment: updates.to_alignment ?? source?.to_alignment ?? 0,
		average_alignment: updates.average_alignment ?? source?.average_alignment ?? 0,
	};
}

function distance_to_rect(point: Point, rect: Edge_obstacle): number {
	const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
	const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
	return Math.hypot(dx, dy);
}

function point_in_rect(point: Point, rect: Edge_obstacle): boolean {
	return (
		point.x >= rect.x &&
		point.x <= rect.x + rect.width &&
		point.y >= rect.y &&
		point.y <= rect.y + rect.height
	);
}

function filter_endpoint_obstacles(
	obstacles: Edge_obstacle[],
	from: Point,
	to: Point,
	ignore_ids: string[] | undefined,
): Edge_obstacle[] {
	const ignore = ignore_ids && ignore_ids.length ? new Set(ignore_ids) : undefined;
	return obstacles.filter((obstacle) => {
		if (ignore?.size && obstacle.id && ignore.has(obstacle.id)) {
			return false;
		}
		if (!ignore?.size) {
			return !point_in_rect(from, obstacle) && !point_in_rect(to, obstacle);
		}
		return true;
	});
}

function segment_intersects_rect(from: Point, to: Point, rect: Edge_obstacle): boolean {
	if (point_in_rect(from, rect) || point_in_rect(to, rect)) {
		return true;
	}
	const rect_points = [
		{ x: rect.x, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y + rect.height },
		{ x: rect.x, y: rect.y + rect.height },
	];
	for (let index = 0; index < rect_points.length; index += 1) {
		const start = rect_points[index];
		const end = rect_points[(index + 1) % rect_points.length];
		if (segments_intersect(from, to, start, end)) {
			return true;
		}
	}
	return false;
}

function segments_intersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
	const d1 = direction(a1, a2, b1);
	const d2 = direction(a1, a2, b2);
	const d3 = direction(b1, b2, a1);
	const d4 = direction(b1, b2, a2);
	if (d1 === 0 && on_segment(a1, a2, b1)) {
		return true;
	}
	if (d2 === 0 && on_segment(a1, a2, b2)) {
		return true;
	}
	if (d3 === 0 && on_segment(b1, b2, a1)) {
		return true;
	}
	if (d4 === 0 && on_segment(b1, b2, a2)) {
		return true;
	}
	return (d1 > 0 && d2 < 0 && d3 < 0 && d4 > 0) ||
		(d1 < 0 && d2 > 0 && d3 > 0 && d4 < 0);
}



function direction(a: Point, b: Point, c: Point): number {
	return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function on_segment(a: Point, b: Point, c: Point): boolean {
	return (
		Math.min(a.x, b.x) <= c.x &&
			c.x <= Math.max(a.x, b.x) &&
			Math.min(a.y, b.y) <= c.y &&
			c.y <= Math.max(a.y, b.y)
	);
}
