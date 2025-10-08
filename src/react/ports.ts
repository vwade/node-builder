import type { Node, Node_id, Port, Port_id, Port_side } from '../core/types.js';
import type { Point } from './camera.js';

export interface Port_geometry<T = unknown> {
	node: Node<T>;
	port: Port;
	index: number;
	total: number;
	offset: Point;
	position: Point;
	normal: Point;
}

export type Port_geometry_map<T = unknown> = Map<Node_id, Map<Port_id, Port_geometry<T>>>;

interface Geometry_options {
	default_width: number;
	default_height: number;
}

export function build_port_geometry_map<T = unknown>(
	nodes: Node<T>[],
	options: Geometry_options,
): Port_geometry_map<T> {
	const lookup: Port_geometry_map<T> = new Map();
	for (const node of nodes) {
		const geometries = compute_node_port_geometries(node, options);
		if (geometries.size) {
			lookup.set(node.id, geometries);
		}
	}
	return lookup;
}

export function compute_node_port_geometries<T = unknown>(
	node: Node<T>,
	options: Geometry_options,
): Map<Port_id, Port_geometry<T>> {
	const width = node.w ?? options.default_width;
	const height = node.h ?? options.default_height;
	const groups = group_ports_by_side(node.ports);
	const result = new Map<Port_id, Port_geometry<T>>();
	for (const [side, ports] of groups) {
		const sorted = [...ports].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
		sorted.forEach((port, index) => {
			const geometry = resolve_port_geometry(node, port, side, index, sorted.length, width, height);
			result.set(port.id, geometry);
		});
	}
	return result;
}

function group_ports_by_side(ports: Port[]): Map<Port_side, Port[]> {
	const groups = new Map<Port_side, Port[]>();
	for (const port of ports) {
		if (!port.id) {
			continue;
		}
		const bucket = groups.get(port.side) ?? [];
		bucket.push(port);
		groups.set(port.side, bucket);
	}
	return groups;
}

function resolve_port_geometry<T>(
	node: Node<T>,
	port: Port,
	side: Port_side,
	index: number,
	total: number,
	width: number,
	height: number,
): Port_geometry<T> {
	const ratio = total > 0 ? (index + 1) / (total + 1) : 0.5;
	let offset: Point;
	let normal: Point;
	switch (side) {
	case 'top':
		offset = { x: width * ratio, y: 0 };
		normal = { x: 0, y: -1 };
		break;
	case 'bottom':
		offset = { x: width * ratio, y: height };
		normal = { x: 0, y: 1 };
		break;
	case 'left':
		offset = { x: 0, y: height * ratio };
		normal = { x: -1, y: 0 };
		break;
	case 'right':
	default:
		offset = { x: width, y: height * ratio };
		normal = { x: 1, y: 0 };
		break;
	}
	return {
		node,
		port,
		index,
		total,
		offset,
		position: { x: node.x + offset.x, y: node.y + offset.y },
		normal,
	};
}
