import type { Node } from '../core/types.js';
import type { Edge_obstacle } from './edge-routing.js';

interface Node_obstacle_options {
	default_width: number;
	default_height: number;
	padding?: number;
}

export function build_node_obstacles<T = unknown>(
	nodes: Node<T>[],
	options: Node_obstacle_options,
): Edge_obstacle[] {
	const padding = options.padding ?? 0;
	const result: Edge_obstacle[] = [];
	for (const node of nodes) {
		const width = (node.w ?? options.default_width) + padding * 2;
		const height = (node.h ?? options.default_height) + padding * 2;
		result.push({
			id: node.id,
			x: node.x - padding,
			y: node.y - padding,
			width,
			height,
		});
	}
	return result;
}
