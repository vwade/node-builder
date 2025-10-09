import { useMemo } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import type { Edge, Node } from '../core/types.js';
import type { Graph_connection_preview } from './nodes.js';
import type { Point } from './camera.js';
import { route_edge } from './edge-routing.js';
import type { Edge_anchor, Edge_obstacle, Edge_route_options, Edge_route_result } from './edge-routing.js';
import type { Port_geometry } from './ports.js';
import { build_port_geometry_map } from './ports.js';
import { build_node_obstacles } from './obstacles.js';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 104;
const DEFAULT_STROKE = '#38bdf8';
const DEFAULT_STROKE_WIDTH = 2;
const PREVIEW_STROKE = '#f97316';
const DEFAULT_OBSTACLE_PADDING = 16;

export interface Graph_edge_render_state {
	preview?: boolean;
}

export interface Graph_edge_render_args<T = unknown> {
	edge: Edge<T>;
	from: Edge_anchor;
	to: Edge_anchor;
	route: Edge_route_result;
	state: Graph_edge_render_state;
}

export interface Graph_edge_route_context<T = unknown> {
	edge?: Edge<T> | null;
	from: Edge_anchor;
	to: Edge_anchor;
	preview: boolean;
	ignore_obstacle_ids?: string[];
}

export type Graph_edge_router<T = unknown> = (
	context: Graph_edge_route_context<T>,
) => Edge_route_result;

export interface Graph_edge_layer_props<T = unknown> {
	nodes: Node<T>[];
	edges: Edge<T>[];
	default_width?: number;
	default_height?: number;
	className?: string;
	style?: CSSProperties;
	render_edge?: (args: Graph_edge_render_args<T>) => ReactNode;
	router?: Graph_edge_router<T>;
	route_options?:
		| Edge_route_options
		| ((context: Graph_edge_route_context<T>) => Edge_route_options | undefined);
	preview?: Graph_connection_preview<T> | null;
	preview_stroke?: string;
	preview_stroke_width?: number;
	obstacles?: Edge_obstacle[];
	obstacle_padding?: number;
}

interface Edge_segment<T = unknown> {
	edge: Edge<T>;
	from: Edge_anchor;
	to: Edge_anchor;
}

function offset_anchor(geometry: Port_geometry, distance = 12): Edge_anchor {
	return {
		position: {
			x: geometry.position.x + geometry.normal.x * distance,
			y: geometry.position.y + geometry.normal.y * distance,
		},
		normal: geometry.normal,
	};
}

export function Graph_edge_layer<T>(props: Graph_edge_layer_props<T>): JSX.Element {
	const {
		nodes,
		edges,
		default_width,
		default_height,
		className,
		style,
		render_edge,
		router,
		route_options,
		preview,
		preview_stroke = PREVIEW_STROKE,
		preview_stroke_width = DEFAULT_STROKE_WIDTH,
		obstacles: custom_obstacles,
		obstacle_padding,
	} = props;
	const resolved_width = default_width ?? DEFAULT_NODE_WIDTH;
	const resolved_height = default_height ?? DEFAULT_NODE_HEIGHT;
	const resolved_obstacle_padding = obstacle_padding ?? DEFAULT_OBSTACLE_PADDING;
	const geometry_map = useMemo(
		() => build_port_geometry_map(nodes, { default_width: resolved_width, default_height: resolved_height }),
		[nodes, resolved_width, resolved_height],
	);
	const resolved_obstacles = useMemo(
		() => {
			if (custom_obstacles) {
				return custom_obstacles;
			}
			return build_node_obstacles(nodes, {
				default_width: resolved_width,
				default_height: resolved_height,
				padding: resolved_obstacle_padding,
			});
		},
		[custom_obstacles, nodes, resolved_height, resolved_obstacle_padding, resolved_width],
	);
	const segments = useMemo(() => {
		const result: Edge_segment<T>[] = [];
		for (const edge of edges) {
			const from_node = geometry_map.get(edge.from.node_id);
			const to_node = geometry_map.get(edge.to.node_id);
			if (!from_node || !to_node) {
				continue;
			}
			const from_geometry = from_node.get(edge.from.port_id);
			const to_geometry = to_node.get(edge.to.port_id);
			if (!from_geometry || !to_geometry) {
				continue;
			}
			result.push({
				edge,
				from: offset_anchor(from_geometry),
				to: offset_anchor(to_geometry),
			});
		}
		return result;
	}, [edges, geometry_map]);

	const svg_style: CSSProperties = {
		position: 'absolute',
		left: 0,
		top: 0,
		width: 0,
		height: 0,
		overflow: 'visible',
		pointerEvents: 'none',
		...style,
	};

	return (
		<svg className={className} style={svg_style} aria-hidden="true">
			{segments.map((segment) => {
				const ignore_ids = Array.from(
					new Set([segment.edge.from.node_id, segment.edge.to.node_id].filter(Boolean)),
				);
				const context: Graph_edge_route_context<T> = {
					edge: segment.edge,
					from: segment.from,
					to: segment.to,
					preview: false,
					ignore_obstacle_ids: ignore_ids,
				};
				const route = resolve_route(context, router, route_options, resolved_obstacles, resolved_obstacle_padding);
				if (render_edge) {
					return (
						<g key={segment.edge.id}>
							{render_edge({
								edge: segment.edge,
								from: segment.from,
								to: segment.to,
								route,
								state: { preview: false },
							})}
						</g>
					);
				}
				return (
					<path
						key={segment.edge.id}
						d={route.path}
						fill="none"
						stroke={DEFAULT_STROKE}
						strokeWidth={DEFAULT_STROKE_WIDTH}
						strokeLinecap="round"
					/>
				);
			})}
			{preview && (() => {
				const from_node = geometry_map.get(preview.from.node.id);
				const from_geometry = from_node?.get(preview.from.port.id);
				const from_anchor = from_geometry ? offset_anchor(from_geometry) : { position: preview.from.position, normal: { x: 1, y: 0 } };
				let target_position: Point = preview.pointer;
				let target_normal: Point = { x: 0, y: 0 };
				if (preview.target) {
					const target_node = geometry_map.get(preview.target.node.id);
					const target_geometry = target_node?.get(preview.target.port.id);
					if (target_geometry) {
						const anchor = offset_anchor(target_geometry);
						target_position = anchor.position;
						target_normal = anchor.normal;
					}
				}
				const preview_ignore_ids = [preview.from.node.id];
				if (preview.target) {
					preview_ignore_ids.push(preview.target.node.id);
				}
				const preview_context: Graph_edge_route_context<T> = {
					edge: null,
					from: from_anchor,
					to: { position: target_position, normal: target_normal },
					preview: true,
					ignore_obstacle_ids: Array.from(new Set(preview_ignore_ids)),
				};
				const preview_route = resolve_route(
					preview_context,
					router,
					route_options,
					resolved_obstacles,
					resolved_obstacle_padding,
				);
				return (
					<path
						d={preview_route.path}
						fill="none"
						stroke={preview_stroke}
						strokeWidth={preview_stroke_width}
						strokeLinecap="round"
						strokeDasharray="8 6"
					/>
				);
			})()}
		</svg>
	);
}

function resolve_route<T>(
	context: Graph_edge_route_context<T>,
	router: Graph_edge_router<T> | undefined,
	route_options:
		| Edge_route_options
		| ((context: Graph_edge_route_context<T>) => Edge_route_options | undefined)
		| undefined,
	obstacles: Edge_obstacle[] | undefined,
	obstacle_padding: number,
): Edge_route_result {
	if (router) {
		return router(context);
	}
	const options = resolve_route_options(context, route_options);
	const resolved_options = merge_obstacle_options(
		options,
		obstacles,
		obstacle_padding,
		context.ignore_obstacle_ids,
	);
	return route_edge(context.from, context.to, resolved_options);
}

function resolve_route_options<T>(
	context: Graph_edge_route_context<T>,
	route_options:
		| Edge_route_options
		| ((context: Graph_edge_route_context<T>) => Edge_route_options | undefined)
		| undefined,
): Edge_route_options | undefined {
	if (!route_options) {
		return undefined;
	}
	if (typeof route_options === 'function') {
		return route_options(context) ?? undefined;
	}
	return route_options;
}

function merge_obstacle_options(
	options: Edge_route_options | undefined,
	obstacles: Edge_obstacle[] | undefined,
	obstacle_padding: number,
	ignore_ids: string[] | undefined,
): Edge_route_options | undefined {
	const ignore = ignore_ids && ignore_ids.length ? Array.from(new Set(ignore_ids)) : undefined;
	if (!obstacles?.length && !ignore) {
		return options;
	}
	if (!options) {
		const resolved: Edge_route_options = {};
		if (obstacles?.length) {
			resolved.obstacles = obstacles;
			resolved.obstacle_padding = obstacle_padding;
		}
		if (ignore) {
			resolved.ignore_obstacle_ids = ignore;
		}
		return resolved;
	}
	let resolved = options;
	if ((!options.obstacles || !options.obstacles.length) && obstacles?.length) {
		resolved = options.obstacle_padding === undefined
			? { ...resolved, obstacles, obstacle_padding }
			: { ...resolved, obstacles };
	}
	if (!resolved.ignore_obstacle_ids && ignore) {
		resolved = { ...resolved, ignore_obstacle_ids: ignore };
	}
	return resolved;
}
