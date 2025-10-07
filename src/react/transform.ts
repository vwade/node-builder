export interface Canvas_point {
	x: number;
	y: number;
}

export interface Canvas_transform {
	x: number;
	y: number;
	scale: number;
}

export interface Zoom_options {
	min_scale: number;
	max_scale: number;
	zoom_sensitivity: number;
}

export const DEFAULT_TRANSFORM: Canvas_transform = {
	x: 0,
	y: 0,
	scale: 1,
};

export const DEFAULT_ZOOM_OPTIONS: Zoom_options = {
	min_scale: 0.25,
	max_scale: 4,
	zoom_sensitivity: 0.0015,
};

export function pan_by(transform: Canvas_transform, dx: number, dy: number): Canvas_transform {
	if (!dx && !dy) {
		return transform;
	}
	return {
		...transform,
		x: transform.x + dx,
		y: transform.y + dy,
	};
}

export function zoom_at(
	transform: Canvas_transform,
	point: Canvas_point,
	delta: number,
	options: Zoom_options = DEFAULT_ZOOM_OPTIONS,
): Canvas_transform {
	if (!delta) {
		return transform;
	}
	const target_scale = clamp_scale(
		transform.scale * Math.exp(-delta * options.zoom_sensitivity),
		options.min_scale,
		options.max_scale,
	);
	if (target_scale === transform.scale) {
		return transform;
	}
	const world = to_world(transform, point);
	return {
		scale: target_scale,
		x: point.x - world.x * target_scale,
		y: point.y - world.y * target_scale,
	};
}

export function to_screen(transform: Canvas_transform, point: Canvas_point): Canvas_point {
	return {
		x: point.x * transform.scale + transform.x,
		y: point.y * transform.scale + transform.y,
	};
}

export function to_world(transform: Canvas_transform, point: Canvas_point): Canvas_point {
	return {
		x: (point.x - transform.x) / transform.scale,
		y: (point.y - transform.y) / transform.scale,
	};
}

function clamp_scale(value: number, min: number, max: number): number {
	if (value < min) {
		return min;
	}
	if (value > max) {
		return max;
	}
	return value;
}
