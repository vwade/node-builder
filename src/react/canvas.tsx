import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as React_pointer_event,
	type ReactNode,
	type WheelEvent as React_wheel_event,
} from 'react';
import type { Edge, Graph, Node, Port } from '../core/types.js';
import {
	DEFAULT_TRANSFORM,
	DEFAULT_ZOOM_OPTIONS,
	type Canvas_point,
	type Canvas_transform,
	type Zoom_options,
	pan_by,
	to_screen,
	to_world,
	zoom_at,
} from './transform.js';

export interface Node_render_input {
	node: Node;
	transform: Canvas_transform;
	world: Canvas_point;
	screen: Canvas_point;
}

export interface Edge_endpoint_render_input {
	node?: Node;
	port?: Port;
	world: Canvas_point | null;
	screen: Canvas_point | null;
}

export interface Edge_render_input {
	edge: Edge;
	from: Edge_endpoint_render_input;
	to: Edge_endpoint_render_input;
	transform: Canvas_transform;
}

export interface Graph_canvas_props {
	graph: Graph;
	render_node: (input: Node_render_input) => ReactNode;
	render_edge?: (input: Edge_render_input) => ReactNode;
	class_name?: string;
	style?: CSSProperties;
	background?: ReactNode;
	show_grid?: boolean;
	initial_transform?: Canvas_transform;
	min_scale?: number;
	max_scale?: number;
	zoom_sensitivity?: number;
	on_transform_change?: (transform: Canvas_transform) => void;
}

interface Canvas_context_value {
	transform: Canvas_transform;
	to_screen: (point: Canvas_point) => Canvas_point;
	to_world: (point: Canvas_point) => Canvas_point;
}

interface Pan_state {
	pointer_id: number;
	origin_client: Canvas_point;
	start_transform: Canvas_transform;
}

export const Canvas_context = createContext<Canvas_context_value | null>(null);

export function use_canvas(): Canvas_context_value {
	const value = useContext(Canvas_context);
	if (!value) {
		throw new Error('use_canvas must be used within a Graph_canvas');
	}
	return value;
}

export function Graph_canvas(props: Graph_canvas_props) {
	const {
		graph,
		render_node,
		render_edge,
		class_name,
		style,
		background,
		show_grid = true,
		initial_transform,
		min_scale = DEFAULT_ZOOM_OPTIONS.min_scale,
		max_scale = DEFAULT_ZOOM_OPTIONS.max_scale,
		zoom_sensitivity = DEFAULT_ZOOM_OPTIONS.zoom_sensitivity,
		on_transform_change,
	} = props;
	const container_ref = useRef<HTMLDivElement | null>(null);
	const pan_state_ref = useRef<Pan_state | null>(null);
	const zoom_options = useMemo<Zoom_options>(() => ({
		min_scale,
		max_scale,
		zoom_sensitivity,
	}), [min_scale, max_scale, zoom_sensitivity]);
	const [transform, set_transform] = useState<Canvas_transform>(
		initial_transform ?? DEFAULT_TRANSFORM,
	);
	useEffect(() => {
		if (!initial_transform) {
			return;
		}
		set_transform(initial_transform);
	}, [initial_transform]);
	const set_transform_with_callback = useCallback(
		(update: Canvas_transform | ((previous: Canvas_transform) => Canvas_transform)) => {
			set_transform(previous => {
				const next = typeof update === 'function' ? update(previous) : update;
				if (
					on_transform_change &&
					(next.x !== previous.x || next.y !== previous.y || next.scale !== previous.scale)
				) {
					on_transform_change(next);
				}
				return next;
			});
		},
		[on_transform_change],
	);
	const handle_pointer_down = useCallback(
		(event: React_pointer_event<HTMLDivElement>) => {
			if (event.button !== 0 && event.button !== 1) {
				return;
			}
			event.preventDefault();
			const pointer_state: Pan_state = {
				pointer_id: event.pointerId,
				origin_client: { x: event.clientX, y: event.clientY },
				start_transform: transform,
			};
			pan_state_ref.current = pointer_state;
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[transform],
	);
	const handle_pointer_move = useCallback(
		(event: React_pointer_event<HTMLDivElement>) => {
			const pointer_state = pan_state_ref.current;
			if (!pointer_state || pointer_state.pointer_id !== event.pointerId) {
				return;
			}
			event.preventDefault();
			const dx = event.clientX - pointer_state.origin_client.x;
			const dy = event.clientY - pointer_state.origin_client.y;
			const next_transform = pan_by(pointer_state.start_transform, dx, dy);
			set_transform_with_callback(next_transform);
		},
		[set_transform_with_callback],
	);
	const clear_pan_state = useCallback(() => {
		pan_state_ref.current = null;
	}, []);
	const handle_pointer_up = useCallback(
		(event: React_pointer_event<HTMLDivElement>) => {
			const pointer_state = pan_state_ref.current;
			if (!pointer_state || pointer_state.pointer_id !== event.pointerId) {
				return;
			}
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			clear_pan_state();
		},
		[clear_pan_state],
	);
	const handle_pointer_cancel = useCallback(
		(event: React_pointer_event<HTMLDivElement>) => {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			clear_pan_state();
		},
		[clear_pan_state],
	);
	const handle_wheel = useCallback(
		(event: React_wheel_event<HTMLDivElement>) => {
			event.preventDefault();
			const container = container_ref.current;
			if (!container) {
				return;
			}
			const bounds = container.getBoundingClientRect();
			const point: Canvas_point = {
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top,
			};
			set_transform_with_callback(previous => zoom_at(previous, point, event.deltaY, zoom_options));
		},
		[zoom_options, set_transform_with_callback],
	);
	const nodes = useMemo(() => Array.from(graph.nodes.values()), [graph]);
	const edges = useMemo(() => Array.from(graph.edges.values()), [graph]);
	const node_elements = nodes.map(node => {
		const world: Canvas_point = { x: node.x, y: node.y };
		const screen = to_screen(transform, world);
		return (
			<div
				key={node.id}
				data-node-id={node.id}
				style={{
					position: 'absolute',
					left: node.x,
					top: node.y,
				}}
			>
				{render_node({ node, transform, world, screen })}
			</div>
		);
	});
	const edge_elements = render_edge
		? (
			<svg
				className="nova-node-edge-layer"
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					pointerEvents: 'none',
					overflow: 'visible',
				}}
			>
				{edges.map(edge => {
					const from_node = graph.nodes.get(edge.from.node_id);
					const to_node = graph.nodes.get(edge.to.node_id);
					const from_port = from_node?.ports.find(port => port.id === edge.from.port_id) ?? null;
					const to_port = to_node?.ports.find(port => port.id === edge.to.port_id) ?? null;
					const from_world = from_node ? { x: from_node.x, y: from_node.y } : null;
					const to_world = to_node ? { x: to_node.x, y: to_node.y } : null;
					const from_screen = from_world ? to_screen(transform, from_world) : null;
					const to_screen_point = to_world ? to_screen(transform, to_world) : null;
					return (
						<g key={edge.id} data-edge-id={edge.id}>
							{render_edge({
								edge,
								from: {
									node: from_node ?? undefined,
									port: from_port ?? undefined,
									world: from_world,
									screen: from_screen,
								},
								to: {
									node: to_node ?? undefined,
									port: to_port ?? undefined,
									world: to_world,
									screen: to_screen_point,
								},
								transform,
							})}
						</g>
					);
				})}
			</svg>
		)
		: null;
	const context_value = useMemo<Canvas_context_value>(
		() => ({
			transform,
			to_screen: point => to_screen(transform, point),
			to_world: point => to_world(transform, point),
		}),
		[transform],
	);
	return (
		<Canvas_context.Provider value={context_value}>
			<div
				ref={container_ref}
				className={class_name}
				onPointerDown={handle_pointer_down}
				onPointerMove={handle_pointer_move}
				onPointerUp={handle_pointer_up}
				onPointerCancel={handle_pointer_cancel}
				onWheel={handle_wheel}
				style={{
					position: 'relative',
					overflow: 'hidden',
					touchAction: 'none',
					userSelect: 'none',
					...style,
				}}
			>
				{background}
				{show_grid ? <Canvas_grid transform={transform} /> : null}
				<div
					className="nova-node-canvas"
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
						transformOrigin: '0 0',
					}}
				>
					{edge_elements}
					<div
						className="nova-node-canvas-nodes"
						style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
					>
						{node_elements}
					</div>
				</div>
			</div>
		</Canvas_context.Provider>
	);
}

export interface Canvas_grid_props {
	transform: Canvas_transform;
	size?: number;
	major_every?: number;
	minor_color?: string;
	major_color?: string;
	style?: CSSProperties;
}

export function Canvas_grid(props: Canvas_grid_props) {
	const {
		transform,
		size = 24,
		major_every = 4,
		minor_color = 'rgba(255, 255, 255, 0.06)',
		major_color = 'rgba(255, 255, 255, 0.12)',
		style,
	} = props;
	const safe_scale = Math.max(transform.scale, Number.EPSILON);
	const minor_step = size * safe_scale;
	const major_step = minor_step * major_every;
	const minor_position = compute_background_position(transform, size);
	const major_position = compute_background_position(transform, size * major_every);
	const background_position = [minor_position, minor_position, major_position, major_position].join(', ');
	const background_size = [
		`${minor_step}px ${minor_step}px`,
		`${minor_step}px ${minor_step}px`,
		`${major_step}px ${major_step}px`,
		`${major_step}px ${major_step}px`,
	].join(', ');
	return (
		<div
			aria-hidden="true"
			className="nova-node-canvas-grid"
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundImage: `linear-gradient(${minor_color} 1px, transparent 1px), linear-gradient(90deg, ${minor_color} 1px, transparent 1px), linear-gradient(${major_color} 1px, transparent 1px), linear-gradient(90deg, ${major_color} 1px, transparent 1px)`,
				backgroundSize: background_size,
				backgroundPosition: background_position,
				pointerEvents: 'none',
				...style,
			}}
		/>
	);
}

function compute_background_position(transform: Canvas_transform, world_step: number): string {
	const world_origin = to_world(transform, { x: 0, y: 0 });
	const offset_x = wrap_modulo(world_origin.x, world_step);
	const offset_y = wrap_modulo(world_origin.y, world_step);
	const screen_offset_x = -offset_x * transform.scale;
	const screen_offset_y = -offset_y * transform.scale;
	return `${screen_offset_x}px ${screen_offset_y}px`;
}

function wrap_modulo(value: number, step: number): number {
	const remainder = value % step;
	return remainder < 0 ? remainder + step : remainder;
}
