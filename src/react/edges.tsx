import { useMemo } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import type { Edge, Node } from '../core/types.js';
import type { Graph_connection_preview } from './nodes.js';
import type { Point } from './camera.js';
import { route_edge } from './edge-routing.js';
import type { Edge_anchor } from './edge-routing.js';
import type { Port_geometry } from './ports.js';
import { build_port_geometry_map } from './ports.js';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 104;
const DEFAULT_STROKE = '#38bdf8';
const DEFAULT_STROKE_WIDTH = 2;
const PREVIEW_STROKE = '#f97316';

export interface Graph_edge_render_state {
	preview?: boolean;
}

export interface Graph_edge_render_args<T = unknown> {
	edge: Edge<T>;
	from: Edge_anchor;
	to: Edge_anchor;
	state: Graph_edge_render_state;
}

export interface Graph_edge_layer_props<T = unknown> {
	nodes: Node<T>[];
	edges: Edge<T>[];
	default_width?: number;
	default_height?: number;
	className?: string;
	style?: CSSProperties;
	render_edge?: (args: Graph_edge_render_args<T>) => ReactNode;
	preview?: Graph_connection_preview<T> | null;
	preview_stroke?: string;
	preview_stroke_width?: number;
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
		preview,
		preview_stroke = PREVIEW_STROKE,
		preview_stroke_width = DEFAULT_STROKE_WIDTH,
	} = props;
	const resolved_width = default_width ?? DEFAULT_NODE_WIDTH;
	const resolved_height = default_height ?? DEFAULT_NODE_HEIGHT;
	const geometry_map = useMemo(
		() => build_port_geometry_map(nodes, { default_width: resolved_width, default_height: resolved_height }),
		[nodes, resolved_width, resolved_height],
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
				const route = route_edge(segment.from, segment.to);
				if (render_edge) {
					return (
						<g key={segment.edge.id}>
							{render_edge({ edge: segment.edge, from: segment.from, to: segment.to, state: { preview: false } })}
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
				const preview_route = route_edge(
					from_anchor,
					{ position: target_position, normal: target_normal },
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
