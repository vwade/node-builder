export interface Camera_limits {
	min_scale: number;
	max_scale: number;
}

export interface Camera_state {
	x: number;
	y: number;
	scale: number;
}

export interface Point {
	x: number;
	y: number;
}

export interface Viewport_dimensions {
	width: number;
	height: number;
}

export interface Fit_camera_options {
	padding?: number | { x?: number; y?: number };
	limits?: Camera_limits;
}

export const DEFAULT_CAMERA_LIMITS: Camera_limits = {
	min_scale: 0.25,
	max_scale: 4,
};

export const DEFAULT_CAMERA_STATE: Camera_state = {
	x: 0,
	y: 0,
	scale: 1,
};

export function clamp_scale(scale: number, limits: Camera_limits = DEFAULT_CAMERA_LIMITS): number {
	return Math.min(limits.max_scale, Math.max(limits.min_scale, scale));
}

export function pan_camera(camera: Camera_state, dx: number, dy: number): Camera_state {
	if (!dx && !dy) {
		return camera;
	}
	return {
		...camera,
		x: camera.x + dx,
		y: camera.y + dy,
	};
}

export function zoom_camera(
	camera: Camera_state,
	target_scale: number,
	pivot?: Point,
	limits: Camera_limits = DEFAULT_CAMERA_LIMITS,
): Camera_state {
	const clamped = clamp_scale(target_scale, limits);
	if (!pivot) {
		if (clamped === camera.scale) {
			return camera;
		}
		return {
			...camera,
			scale: clamped,
		};
	}
	if (clamped === camera.scale) {
		return camera;
	}
	const ratio = clamped / camera.scale;
	const offset_x = pivot.x - camera.x;
	const offset_y = pivot.y - camera.y;
	return {
		x: pivot.x - offset_x * ratio,
		y: pivot.y - offset_y * ratio,
		scale: clamped,
	};
}

export function reset_camera(
	camera: Camera_state,
	fallback: Camera_state = DEFAULT_CAMERA_STATE,
): Camera_state {
	if (
		camera.x === fallback.x &&
		camera.y === fallback.y &&
		camera.scale === fallback.scale
	) {
		return camera;
	}
	return {
		x: fallback.x,
		y: fallback.y,
		scale: fallback.scale,
	};
}

export function fit_camera_to_rect(
	camera: Camera_state,
	rect: { x: number; y: number; width: number; height: number },
	viewport: Viewport_dimensions,
	options: Fit_camera_options = {},
): Camera_state {
	const limits = options.limits ?? DEFAULT_CAMERA_LIMITS;
	const padding_x = resolve_padding(options.padding, 'x');
	const padding_y = resolve_padding(options.padding, 'y');
	const viewport_width = Math.max(viewport.width, 1);
	const viewport_height = Math.max(viewport.height, 1);
	const available_width = Math.max(viewport_width - padding_x * 2, 1);
	const available_height = Math.max(viewport_height - padding_y * 2, 1);
	const rect_width = Math.max(rect.width, 0);
	const rect_height = Math.max(rect.height, 0);
	const scale_x = rect_width > 0 ? available_width / rect_width : Number.POSITIVE_INFINITY;
	const scale_y = rect_height > 0 ? available_height / rect_height : Number.POSITIVE_INFINITY;
	const fit_scale = Math.min(scale_x, scale_y);
	const target_scale = clamp_scale(
		Number.isFinite(fit_scale) ? fit_scale : limits.max_scale,
		limits,
	);
	const screen_width = rect_width * target_scale;
	const screen_height = rect_height * target_scale;
	const leftover_width = Math.max(available_width - screen_width, 0);
	const leftover_height = Math.max(available_height - screen_height, 0);
	const offset_x = padding_x + leftover_width / 2;
	const offset_y = padding_y + leftover_height / 2;
	const target_x = rect.x - offset_x / target_scale;
	const target_y = rect.y - offset_y / target_scale;
	if (
		target_x === camera.x &&
		target_y === camera.y &&
		target_scale === camera.scale
	) {
		return camera;
	}
	return {
		x: target_x,
		y: target_y,
		scale: target_scale,
	};
}

function resolve_padding(
	padding: Fit_camera_options['padding'],
	axis: 'x' | 'y',
): number {
	if (typeof padding === 'number') {
		return Math.max(padding, 0);
	}
	if (typeof padding === 'object' && padding !== null) {
		const value = padding[axis];
		if (typeof value === 'number') {
			return Math.max(value, 0);
		}
	}
	return 0;
}
