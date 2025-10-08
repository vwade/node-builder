import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX, PointerEvent as React_pointer_event, ReactNode } from 'react';
import type { Node, Node_id, Port } from '../core/types.js';
import { use_graph_camera } from './canvas.js';
import type { Point } from './camera.js';
import type { Port_geometry } from './ports.js';
import { build_port_geometry_map } from './ports.js';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 104;

export interface Graph_node_render_state {
	selected: boolean;
	dragging: boolean;
}

export interface Graph_node_drag_event<T = unknown> {
	node_ids: Node_id[];
	positions: Map<Node_id, Point>;
	delta: Point;
	nodes: Map<Node_id, Node<T>>;
}

export interface Graph_node_pointer_event<T = unknown> {
	node: Node<T>;
	pointer_event: React_pointer_event<HTMLDivElement>;
}

export interface Graph_port_render_state {
	kind: Port['kind'];
	side: Port['side'];
	index: number;
	total: number;
	connecting: boolean;
	is_source: boolean;
	is_target: boolean;
	is_candidate: boolean;
}

export interface Graph_port_render_args<T = unknown> {
	node: Node<T>;
	port: Port;
	geometry: Port_geometry<T>;
	state: Graph_port_render_state;
}

export interface Graph_connection_endpoint<T = unknown> {
	node: Node<T>;
	port: Port;
	position: Point;
}

export interface Graph_connection_preview<T = unknown> {
	from: Graph_connection_endpoint<T>;
	pointer: Point;
	target?: Graph_connection_endpoint<T>;
}

export interface Graph_connection_complete_event<T = unknown> {
	from: Graph_connection_endpoint<T>;
	to: Graph_connection_endpoint<T>;
}

export interface Graph_connection_cancel_event<T = unknown> {
	from: Graph_connection_endpoint<T>;
	pointer: Point;
}

export interface Graph_node_layer_props<T = unknown> {
	nodes: Node<T>[];
	selected_ids?: ReadonlySet<Node_id>;
	className?: string;
	style?: CSSProperties;
	default_width?: number;
	default_height?: number;
	render_node?: (node: Node<T>, state: Graph_node_render_state) => ReactNode;
	render_port?: (args: Graph_port_render_args<T>) => ReactNode;
	on_node_pointer_down?: (event: Graph_node_pointer_event<T>) => void;
	on_drag_start?: (event: Graph_node_drag_event<T>) => void;
	on_drag?: (event: Graph_node_drag_event<T>) => void;
	on_drag_end?: (event: Graph_node_drag_event<T>) => void;
	on_connection_preview?: (event: Graph_connection_preview<T> | null) => void;
	on_connection_complete?: (event: Graph_connection_complete_event<T>) => void;
	on_connection_cancel?: (event: Graph_connection_cancel_event<T>) => void;
}

interface Node_drag_state {
	pointer_id: number;
	origin: Point;
	initial_positions: Map<Node_id, Point>;
	target_ids: Node_id[];
	scale: number;
}

interface Connection_runtime<T = unknown> {
pointer_id: number;
from: Graph_connection_endpoint<T>;
}

type Pointer_listener = (event: PointerEvent) => void;

const pointer_host = globalThis as typeof globalThis & {
addEventListener?: (type: string, listener: Pointer_listener) => void;
removeEventListener?: (type: string, listener: Pointer_listener) => void;
};

export function compute_drag_positions(initial_positions: Map<Node_id, Point>, delta: Point): Map<Node_id, Point> {
	const positions = new Map<Node_id, Point>();
	for (const [id, origin] of initial_positions) {
		positions.set(id, {
			x: origin.x + delta.x,
			y: origin.y + delta.y,
		});
	}
	return positions;
}

function default_render_node<T>(node: Node<T>, state: Graph_node_render_state): ReactNode {
	const surface_style: CSSProperties = {
		width: '100%',
		height: '100%',
		borderRadius: 12,
		background: state.selected ? '#eff6ff' : '#ffffff',
		border: `1px solid ${state.selected ? '#2563eb' : '#e5e7eb'}`,
		boxShadow: state.dragging ? '0 12px 30px rgba(15, 23, 42, 0.18)' : '0 2px 10px rgba(15, 23, 42, 0.08)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: 14,
		fontWeight: 600,
		color: '#111827',
		pointerEvents: 'none',
		userSelect: 'none',
	};
	return <div style={surface_style}>{node.type}</div>;
}

function default_render_port<T>(args: Graph_port_render_args<T>): ReactNode {
	const { state } = args;
	let fill = state.kind === 'out' ? '#2563eb' : '#1e293b';
	if (state.is_target) {
		fill = '#16a34a';
	} else if (state.is_candidate) {
		fill = '#38bdf8';
	}
	const scale = state.is_target ? 1.1 : state.is_source ? 1.05 : state.connecting && state.is_candidate ? 1.05 : 1;
	const style: CSSProperties = {
		width: 16,
		height: 16,
		borderRadius: 999,
		background: fill,
		border: state.is_target ? '2px solid #16a34a' : '2px solid #e2e8f0',
		boxShadow: state.is_source ? '0 0 0 4px rgba(37, 99, 235, 0.35)' : state.is_candidate ? '0 0 0 4px rgba(56, 189, 248, 0.25)' : '0 2px 8px rgba(15, 23, 42, 0.25)',
		transform: `scale(${scale})`,
		transition: 'transform 120ms ease, box-shadow 120ms ease',
		pointerEvents: 'none',
	};
	return <div data-port-handle style={style} />;
}

export function Graph_node_layer<T>(props: Graph_node_layer_props<T>): JSX.Element {
	const {
		nodes,
		selected_ids,
		className,
		style,
		default_width,
		default_height,
		render_node,
		render_port,
		on_node_pointer_down,
		on_drag_start,
		on_drag,
		on_drag_end,
		on_connection_preview,
		on_connection_complete,
		on_connection_cancel,
	} = props;
	const { camera, client_to_world } = use_graph_camera();
	const node_lookup = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes]);
	const drag_ref = useRef<Node_drag_state | null>(null);
	const connection_ref = useRef<Connection_runtime<T> | null>(null);
	const hover_port_ref = useRef<Graph_connection_endpoint<T> | null>(null);
	const listeners_ref = useRef<(() => void) | null>(null);
	const preview_ref = useRef<Graph_connection_preview<T> | null>(null);
	const [dragging_ids, set_dragging_ids] = useState<Set<Node_id>>(() => new Set());
	const [connection_preview, set_connection_preview_state] = useState<Graph_connection_preview<T> | null>(null);
	const resolved_render = render_node ?? default_render_node;
	const resolved_render_port = render_port ?? default_render_port;
	const resolved_width = default_width ?? DEFAULT_NODE_WIDTH;
	const resolved_height = default_height ?? DEFAULT_NODE_HEIGHT;
	const geometry_map = useMemo(
		() => build_port_geometry_map(nodes, { default_width: resolved_width, default_height: resolved_height }),
		[nodes, resolved_width, resolved_height],
	);
	const update_connection_preview = useCallback(
		(preview: Graph_connection_preview<T> | null) => {
			preview_ref.current = preview;
			set_connection_preview_state(preview);
			on_connection_preview?.(preview);
		},
		[on_connection_preview],
	);
	const finish_connection = useCallback(
		(target: Graph_connection_endpoint<T> | null) => {
			listeners_ref.current?.();
			listeners_ref.current = null;
			const runtime = connection_ref.current;
			connection_ref.current = null;
			hover_port_ref.current = null;
			const last_preview = preview_ref.current;
			update_connection_preview(null);
			if (!runtime) {
				return;
			}
			if (target) {
				on_connection_complete?.({ from: runtime.from, to: target });
			} else {
				const pointer = last_preview?.pointer ?? runtime.from.position;
				on_connection_cancel?.({ from: runtime.from, pointer });
			}
		},
		[on_connection_cancel, on_connection_complete, update_connection_preview],
	);
	const start_connection = useCallback(
		(node: Node<T>, port: Port, geometry: Port_geometry<T>, event: React_pointer_event<HTMLDivElement>) => {
			if (port.kind !== 'out') {
				return;
			}
			if (connection_ref.current) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const pointer_id = event.pointerId;
			const endpoint: Graph_connection_endpoint<T> = { node, port, position: geometry.position };
			connection_ref.current = { pointer_id, from: endpoint };
			hover_port_ref.current = null;
			const pointer = client_to_world(event.clientX, event.clientY);
			update_connection_preview({ from: endpoint, pointer });
			const handle_move = (native_event: PointerEvent) => {
				if (native_event.pointerId !== pointer_id) {
					return;
				}
				native_event.preventDefault();
				const pointer_point = client_to_world(native_event.clientX, native_event.clientY);
				const current_preview = preview_ref.current;
				if (!current_preview) {
					return;
				}
				update_connection_preview({ ...current_preview, pointer: pointer_point });
			};
			const handle_up = (native_event: PointerEvent) => {
				if (native_event.pointerId !== pointer_id) {
					return;
				}
				native_event.preventDefault();
				const target = hover_port_ref.current;
				const valid_target = target && target.port.kind === 'in' ? target : null;
				finish_connection(valid_target);
			};
			const handle_cancel = (native_event: PointerEvent) => {
				if (native_event.pointerId !== pointer_id) {
					return;
				}
				finish_connection(null);
			};
			const cleanup = () => {
				pointer_host.removeEventListener?.('pointermove', handle_move);
				pointer_host.removeEventListener?.('pointerup', handle_up);
				pointer_host.removeEventListener?.('pointercancel', handle_cancel);
			};
			listeners_ref.current = cleanup;
			pointer_host.addEventListener?.('pointermove', handle_move);
			pointer_host.addEventListener?.('pointerup', handle_up);
			pointer_host.addEventListener?.('pointercancel', handle_cancel);
		},
		[client_to_world, finish_connection, update_connection_preview],
	);
	const handle_port_pointer_down = useCallback(
		(node: Node<T>, port: Port, geometry: Port_geometry<T>, event: React_pointer_event<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}
			start_connection(node, port, geometry, event);
		},
		[start_connection],
	);
	const handle_port_pointer_enter = useCallback(
		(node: Node<T>, port: Port, geometry: Port_geometry<T>) => {
			if (!connection_ref.current) {
				return;
			}
			if (port.kind !== 'in') {
				const current_preview = preview_ref.current;
				if (current_preview?.target) {
					update_connection_preview({ ...current_preview, target: undefined });
				}
				hover_port_ref.current = null;
				return;
			}
			const runtime = connection_ref.current;
			if (runtime.from.node.id === node.id && runtime.from.port.id === port.id) {
				return;
			}
			const next_target: Graph_connection_endpoint<T> = { node, port, position: geometry.position };
			hover_port_ref.current = next_target;
			const current_preview = preview_ref.current;
			if (current_preview) {
				update_connection_preview({ ...current_preview, target: next_target });
			}
		},
		[update_connection_preview],
	);
	const handle_port_pointer_leave = useCallback(
		(node: Node<T>, port: Port) => {
			if (!connection_ref.current) {
				return;
			}
			const target = hover_port_ref.current;
			if (!target) {
				return;
			}
			if (target.node.id !== node.id || target.port.id !== port.id) {
				return;
			}
			hover_port_ref.current = null;
			const current_preview = preview_ref.current;
			if (current_preview?.target) {
				update_connection_preview({ ...current_preview, target: undefined });
			}
		},
		[update_connection_preview],
	);
	useEffect(() => {
		return () => {
			listeners_ref.current?.();
			listeners_ref.current = null;
			connection_ref.current = null;
			hover_port_ref.current = null;
			preview_ref.current = null;
		};
	}, []);

	const emit_drag_event = useCallback(
		(phase: 'start' | 'move' | 'end', event: React_pointer_event<HTMLDivElement>) => {
			const drag = drag_ref.current;
			if (!drag) {
				return;
			}
			const delta: Point = {
				x: (event.clientX - drag.origin.x) / drag.scale,
				y: (event.clientY - drag.origin.y) / drag.scale,
			};
			const positions = compute_drag_positions(drag.initial_positions, delta);
			const nodes_snapshot = new Map<Node_id, Node<T>>();
			for (const id of drag.target_ids) {
				const current = node_lookup.get(id);
				if (current) {
					nodes_snapshot.set(id, current);
				}
			}
			const payload: Graph_node_drag_event<T> = {
				node_ids: [...positions.keys()],
				positions,
				delta,
				nodes: nodes_snapshot,
			};
			if (phase === 'start') {
				on_drag_start?.(payload);
			} else if (phase === 'move') {
				on_drag?.(payload);
			} else {
				on_drag_end?.(payload);
			}
		},
		[node_lookup, on_drag_start, on_drag, on_drag_end],
	);

	const end_drag = useCallback(() => {
		drag_ref.current = null;
		set_dragging_ids(new Set<Node_id>());
	}, []);

	const handle_pointer_down = useCallback(
		(node: Node<T>, event: React_pointer_event<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}
			if (drag_ref.current) {
				return;
			}
			event.preventDefault();
			const selection = selected_ids;
			let target_ids: Node_id[] = [];
			if (selection?.has(node.id)) {
				for (const id of selection) {
					if (node_lookup.has(id)) {
						target_ids.push(id);
					}
				}
			}
			if (!target_ids.length) {
				if (node_lookup.has(node.id)) {
					target_ids = [node.id];
				}
			}
			const initial_positions = new Map<Node_id, Point>();
			for (const id of target_ids) {
				const current = node_lookup.get(id);
				if (current) {
					initial_positions.set(id, { x: current.x, y: current.y });
				}
			}
			if (!initial_positions.size) {
				return;
			}
			on_node_pointer_down?.({ node, pointer_event: event });
			const capture_target = event.currentTarget as HTMLDivElement;
			if (typeof capture_target.setPointerCapture === 'function') {
				try {
					capture_target.setPointerCapture(event.pointerId);
				} catch {
					// jsdom does not implement pointer capture
				}
			}
			drag_ref.current = {
				pointer_id: event.pointerId,
				origin: { x: event.clientX, y: event.clientY },
				initial_positions,
				target_ids,
				scale: camera.scale,
			};
			set_dragging_ids(new Set(initial_positions.keys()));
			emit_drag_event('start', event);
		},
		[camera.scale, emit_drag_event, node_lookup, on_node_pointer_down, selected_ids],
	);

	const handle_pointer_move = useCallback(
		(event: React_pointer_event<HTMLDivElement>) => {
			const drag = drag_ref.current;
			if (!drag || drag.pointer_id !== event.pointerId) {
				return;
			}
			event.preventDefault();
			emit_drag_event('move', event);
		},
		[emit_drag_event],
	);

	const handle_pointer_up = useCallback(
		(event: React_pointer_event<HTMLDivElement>) => {
			const drag = drag_ref.current;
			if (!drag || drag.pointer_id !== event.pointerId) {
				return;
			}
			if (
				typeof event.currentTarget.releasePointerCapture === 'function' &&
				event.currentTarget.hasPointerCapture?.(event.pointerId)
			) {
				try {
					event.currentTarget.releasePointerCapture(event.pointerId);
				} catch {
					// ignore missing pointer capture in non-DOM environments
				}
			}
			emit_drag_event('end', event);
			end_drag();
		},
		[emit_drag_event, end_drag],
	);

	const handle_pointer_cancel = useCallback(
		(event: React_pointer_event<HTMLDivElement>) => {
			const drag = drag_ref.current;
			if (!drag || drag.pointer_id !== event.pointerId) {
				return;
			}
			emit_drag_event('end', event);
			end_drag();
		},
		[emit_drag_event, end_drag],
	);

	const layer_style: CSSProperties = {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		pointerEvents: 'none',
		...style,
	};

	return (
		<div className={className} style={layer_style}>
			{nodes.map((node) => {
				const width = node.w ?? resolved_width;
				const height = node.h ?? resolved_height;
				const is_selected = selected_ids?.has(node.id) ?? false;
				const is_dragging = dragging_ids.has(node.id);
				const node_style: CSSProperties = {
					position: 'absolute',
					left: node.x,
					top: node.y,
					width,
					height,
					cursor: is_dragging ? 'grabbing' : 'grab',
					userSelect: 'none',
					transform: 'translateZ(0)',
					pointerEvents: 'auto',
				};
				const port_geometries = geometry_map.get(node.id);
				return (
					<div
						key={node.id}
						data-node-id={node.id}
						style={node_style}
						onPointerDown={(event) => handle_pointer_down(node, event)}
						onPointerMove={handle_pointer_move}
						onPointerUp={handle_pointer_up}
						onPointerCancel={handle_pointer_cancel}
					>
						{resolved_render(node, { selected: is_selected, dragging: is_dragging })}
						{port_geometries &&
							node.ports.map((port) => {
								const geometry = port_geometries.get(port.id);
								if (!geometry) {
									return null;
								}
								const is_source =
									connection_preview?.from.node.id === node.id &&
									connection_preview?.from.port.id === port.id;
								const is_target =
									connection_preview?.target?.node.id === node.id &&
									connection_preview?.target?.port.id === port.id;
								const is_candidate =
									!!connection_preview &&
									port.kind === 'in' &&
									!(connection_preview.from.node.id === node.id &&
										connection_preview.from.port.id === port.id);
								const port_state: Graph_port_render_state = {
									kind: port.kind,
									side: port.side,
									index: geometry.index,
									total: geometry.total,
									connecting: !!connection_preview,
									is_source,
									is_target,
									is_candidate,
								};
								const port_style: CSSProperties = {
									position: 'absolute',
									left: geometry.offset.x,
									top: geometry.offset.y,
									transform: 'translate(-50%, -50%)',
									pointerEvents: 'auto',
									cursor: port.kind === 'out' ? 'crosshair' : 'pointer',
									touchAction: 'none',
								};
								return (
									<div
										key={port.id}
										data-port-id={port.id}
										data-port-kind={port.kind}
										style={port_style}
										onPointerDown={(event) => handle_port_pointer_down(node, port, geometry, event)}
										onPointerEnter={() => handle_port_pointer_enter(node, port, geometry)}
										onPointerLeave={() => handle_port_pointer_leave(node, port)}
									>
										{resolved_render_port({ node, port, geometry, state: port_state })}
									</div>
								);
							})}
					</div>
				);
			})}
		</div>
	);
}

