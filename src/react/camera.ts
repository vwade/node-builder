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
