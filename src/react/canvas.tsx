import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { CSSProperties, JSX, PointerEvent as React_pointer_event, ReactNode } from 'react';
import {
	DEFAULT_CAMERA_LIMITS,
	DEFAULT_CAMERA_STATE,
	clamp_scale,
	pan_camera,
	zoom_camera,
} from './camera.js';
import type { Camera_limits, Camera_state, Point } from './camera.js';

export interface Graph_viewport {
	width: number;
	height: number;
}

export interface Graph_camera_context_value {
	camera: Camera_state;
	viewport: Graph_viewport;
	limits: Camera_limits;
	set_camera: (next: Camera_state | ((current: Camera_state) => Camera_state)) => void;
	reset_camera: () => void;
}

const Graph_camera_context = createContext<Graph_camera_context_value | null>(null);

export function use_graph_camera(): Graph_camera_context_value {
	const context = useContext(Graph_camera_context);
	if (!context) {
		throw new Error('Graph_camera_context missing. Wrap your tree in <Graph_canvas>.');
	}
	return context;
}

type Dom_global = typeof globalThis & Partial<Window & { ResizeObserver: typeof ResizeObserver }>;
const dom_global = globalThis as Dom_global;
const has_dom = typeof dom_global.document !== 'undefined';
const use_isomorphic_layout_effect = has_dom ? useLayoutEffect : useEffect;


interface Drag_state {
	pointer_id: number;
	origin: Point;
	camera: Camera_state;
}

type Pointer_capture_target = HTMLElement & {
	setPointerCapture?: (pointer_id: number) => void;
	hasPointerCapture?: (pointer_id: number) => boolean;
	releasePointerCapture?: (pointer_id: number) => void;
};

export interface Graph_canvas_props {
	children?: ReactNode;
	className?: string;
	style?: CSSProperties;
	min_scale?: number;
	max_scale?: number;
	initial_camera?: Partial<Camera_state>;
	on_camera_change?: (camera: Camera_state) => void;
}

export function Graph_canvas(props: Graph_canvas_props): JSX.Element {
	const {
		children,
		className,
		style,
		min_scale,
		max_scale,
		initial_camera,
		on_camera_change,
	} = props;
	const resolved_limits = useMemo(() => {
		const min = min_scale ?? DEFAULT_CAMERA_LIMITS.min_scale;
		const max = max_scale ?? DEFAULT_CAMERA_LIMITS.max_scale;
		if (min > max) {
			return { min_scale: max, max_scale: min };
		}
		return { min_scale: min, max_scale: max };
	}, [min_scale, max_scale]);
	const limits_ref = useRef(resolved_limits);
	useEffect(() => {
		limits_ref.current = resolved_limits;
	}, [resolved_limits]);
	const initial_values = useMemo(() => {
		const base = initial_camera ?? {};
		const scale = clamp_scale(base.scale ?? DEFAULT_CAMERA_STATE.scale, resolved_limits);
		return {
			x: base.x ?? DEFAULT_CAMERA_STATE.x,
			y: base.y ?? DEFAULT_CAMERA_STATE.y,
			scale,
		};
	}, [initial_camera, resolved_limits]);
	const initial_ref = useRef(initial_values);
	const [camera, set_camera_state] = useState<Camera_state>(initial_values);
	useEffect(() => {
		initial_ref.current = initial_values;
		set_camera_state((prev) => {
			if (
				prev.x === initial_values.x &&
				prev.y === initial_values.y &&
				prev.scale === initial_values.scale
			) {
				return prev;
			}
			return initial_values;
		});
	}, [initial_values]);
	useEffect(() => {
		set_camera_state((prev) => {
			const clamped = clamp_scale(prev.scale, resolved_limits);
			if (clamped === prev.scale) {
				return prev;
			}
			return { ...prev, scale: clamped };
		});
	}, [resolved_limits]);
	const container_ref = useRef<HTMLDivElement | null>(null);
	const drag_ref = useRef<Drag_state | null>(null);
	const [is_panning, set_is_panning] = useState(false);
	const [viewport, set_viewport] = useState<Graph_viewport>({ width: 0, height: 0 });
	use_isomorphic_layout_effect(() => {
		if (!has_dom) {
			return;
		}
		const element = container_ref.current;
		if (!element) {
			return;
		}
		const update = () => {
			const rect = element.getBoundingClientRect();
			set_viewport({ width: rect.width, height: rect.height });
		};
		update();
		const Observer = dom_global.ResizeObserver;
		if (!Observer) {
			if (!dom_global.addEventListener || !dom_global.removeEventListener) {
				return;
			}
			dom_global.addEventListener('resize', update);
			return () => {
				dom_global.removeEventListener?.('resize', update);
			};
		}
		const observer = new Observer(() => update());
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	const set_camera = useCallback((next: Camera_state | ((current: Camera_state) => Camera_state)) => {
		set_camera_state((prev) => {
			const computed = typeof next === 'function' ? (next as (current: Camera_state) => Camera_state)(prev) : next;
			if (
				prev.x === computed.x &&
				prev.y === computed.y &&
				prev.scale === computed.scale
			) {
				return prev;
			}
			return computed;
		});
	}, []);
	const reset = useCallback(() => {
		const target = initial_ref.current;
		set_camera_state((prev) => {
			const scale = clamp_scale(target.scale, limits_ref.current);
			if (
				prev.x === target.x &&
				prev.y === target.y &&
				prev.scale === scale
			) {
				return prev;
			}
			return { x: target.x, y: target.y, scale };
		});
	}, []);
	useEffect(() => {
		if (!on_camera_change) {
			return;
		}
		on_camera_change(camera);
	}, [camera, on_camera_change]);
	const handle_wheel = useCallback((event: WheelEvent) => {
		if (!container_ref.current) {
			return;
		}
		event.preventDefault();
		const rect = container_ref.current.getBoundingClientRect();
		const pivot: Point = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
		const delta_scale = Math.exp(-event.deltaY * 0.001);
		set_camera_state((prev) => {
			const next_scale = prev.scale * delta_scale;
			return zoom_camera(prev, next_scale, pivot, limits_ref.current);
		});
	}, []);
	useEffect(() => {
		const element = container_ref.current;
		if (!element) {
			return;
		}
		const listener = (event: WheelEvent) => handle_wheel(event);
		element.addEventListener('wheel', listener, { passive: false });
		return () => element.removeEventListener('wheel', listener);
	}, [handle_wheel]);
	const handle_pointer_down = useCallback((event: React_pointer_event<HTMLDivElement>) => {
		if (event.button !== 0) {
			return;
		}
		if (event.currentTarget !== event.target) {
			return;
		}
		event.preventDefault();
		const target = event.currentTarget as Pointer_capture_target;
		target.setPointerCapture?.(event.pointerId);
		drag_ref.current = {
			pointer_id: event.pointerId,
			origin: { x: event.clientX, y: event.clientY },
			camera,
		};
		set_is_panning(true);
	}, [camera]);
	const handle_pointer_move = useCallback((event: React_pointer_event<HTMLDivElement>) => {
		const drag = drag_ref.current;
		if (!drag || drag.pointer_id !== event.pointerId) {
			return;
		}
		event.preventDefault();
		const dx = event.clientX - drag.origin.x;
		const dy = event.clientY - drag.origin.y;
		set_camera_state(() => pan_camera(drag.camera, dx, dy));
	}, []);
	const end_pan = useCallback(() => {
		drag_ref.current = null;
		set_is_panning(false);
	}, []);
	const handle_pointer_up = useCallback((event: React_pointer_event<HTMLDivElement>) => {
		const target = event.currentTarget as Pointer_capture_target;
		if (
			target.releasePointerCapture &&
			(!target.hasPointerCapture || target.hasPointerCapture(event.pointerId))
		) {
			target.releasePointerCapture(event.pointerId);
		}
		if (drag_ref.current?.pointer_id === event.pointerId) {
			end_pan();
		}
	}, [end_pan]);
	const handle_pointer_cancel = useCallback(() => {
		end_pan();
	}, [end_pan]);
	const handle_double_click = useCallback(() => {
		reset();
	}, [reset]);
	const container_style: CSSProperties = {
		position: 'relative',
		overflow: 'hidden',
		touchAction: 'none',
		cursor: is_panning ? 'grabbing' : 'grab',
		...style,
	};
	const content_style: CSSProperties = {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		transformOrigin: '0 0',
		transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
	};
	const context_value = useMemo<Graph_camera_context_value>(() => ({
		camera,
		viewport,
		limits: resolved_limits,
		set_camera,
		reset_camera: reset,
	}), [camera, viewport, resolved_limits, set_camera, reset]);
	return (
		<div
			ref={container_ref}
			className={className}
			style={container_style}
			onPointerDown={handle_pointer_down}
			onPointerMove={handle_pointer_move}
			onPointerUp={handle_pointer_up}
			onPointerLeave={handle_pointer_cancel}
			onPointerCancel={handle_pointer_cancel}
			onDoubleClick={handle_double_click}
		>
			<div style={content_style}>
				<Graph_camera_context.Provider value={context_value}>
					{children}
				</Graph_camera_context.Provider>
			</div>
		</div>
	);
}

export function use_graph_viewport(): Graph_viewport {
	return use_graph_camera().viewport;
}

export function use_graph_limits(): Camera_limits {
	return use_graph_camera().limits;
}

export type { Camera_state } from './camera.js';
