import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX, PointerEvent as React_pointer_event, ReactNode } from 'react';
import type { Node, Node_id } from '../core/types.js';
import { use_graph_camera } from './canvas.js';
import type { Point } from './camera.js';

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

export interface Graph_node_layer_props<T = unknown> {
	nodes: Node<T>[];
	selected_ids?: ReadonlySet<Node_id>;
	className?: string;
	style?: CSSProperties;
	default_width?: number;
	default_height?: number;
	render_node?: (node: Node<T>, state: Graph_node_render_state) => ReactNode;
	on_node_pointer_down?: (event: Graph_node_pointer_event<T>) => void;
	on_drag_start?: (event: Graph_node_drag_event<T>) => void;
	on_drag?: (event: Graph_node_drag_event<T>) => void;
	on_drag_end?: (event: Graph_node_drag_event<T>) => void;
}

interface Node_drag_state {
	pointer_id: number;
	origin: Point;
	initial_positions: Map<Node_id, Point>;
	target_ids: Node_id[];
	scale: number;
}

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

export function Graph_node_layer<T>(props: Graph_node_layer_props<T>): JSX.Element {
	const {
		nodes,
		selected_ids,
		className,
		style,
		default_width,
		default_height,
		render_node,
		on_node_pointer_down,
		on_drag_start,
		on_drag,
		on_drag_end,
	} = props;
	const { camera } = use_graph_camera();
	const node_lookup = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes]);
	const drag_ref = useRef<Node_drag_state | null>(null);
	const [dragging_ids, set_dragging_ids] = useState<Set<Node_id>>(() => new Set());
	const resolved_render = render_node ?? default_render_node;
	const resolved_width = default_width ?? DEFAULT_NODE_WIDTH;
	const resolved_height = default_height ?? DEFAULT_NODE_HEIGHT;

	const emit_drag_event = useCallback((phase: 'start' | 'move' | 'end', event: React_pointer_event<HTMLDivElement>) => {
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
	}, [node_lookup, on_drag_start, on_drag, on_drag_end]);

	const end_drag = useCallback(() => {
		drag_ref.current = null;
		set_dragging_ids(new Set<Node_id>());
	}, []);

	const handle_pointer_down = useCallback((node: Node<T>, event: React_pointer_event<HTMLDivElement>) => {
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
	}, [camera.scale, emit_drag_event, node_lookup, on_node_pointer_down, selected_ids]);

	const handle_pointer_move = useCallback((event: React_pointer_event<HTMLDivElement>) => {
		const drag = drag_ref.current;
		if (!drag || drag.pointer_id !== event.pointerId) {
			return;
		}
		event.preventDefault();
		emit_drag_event('move', event);
	}, [emit_drag_event]);

	const handle_pointer_up = useCallback((event: React_pointer_event<HTMLDivElement>) => {
		const drag = drag_ref.current;
		if (!drag || drag.pointer_id !== event.pointerId) {
			return;
		}
		if (typeof event.currentTarget.releasePointerCapture === 'function' && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
			try {
				event.currentTarget.releasePointerCapture(event.pointerId);
			} catch {
				// ignore missing pointer capture in non-DOM environments
			}
		}
		emit_drag_event('end', event);
		end_drag();
	}, [emit_drag_event, end_drag]);

	const handle_pointer_cancel = useCallback((event: React_pointer_event<HTMLDivElement>) => {
		const drag = drag_ref.current;
		if (!drag || drag.pointer_id !== event.pointerId) {
			return;
		}
		emit_drag_event('end', event);
		end_drag();
	}, [emit_drag_event, end_drag]);

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
					</div>
				);
			})}
		</div>
	);
}
