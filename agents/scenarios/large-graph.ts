import type { Node } from '../../src/core/types.js';

export interface Perf_sampling_window {
	warmup_ms: number;
	duration_ms: number;
}

export interface Perf_frame_budget {
	average_ms: number;
	percentile_95_ms: number;
}

export interface Perf_scenario {
	id: string;
	label: string;
	description: string;
	viewport: { width: number; height: number };
	sampling: Perf_sampling_window;
	frame_budget: Perf_frame_budget;
	node_dimensions: { width: number; height: number };
	generate_nodes: () => Node[];
}

function generate_layered_grid(rows: number, columns: number, spacing_x: number, spacing_y: number): Node[] {
	const nodes: Node[] = [];
	let index = 0;
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const id = `lg-${index}`;
			const layer = Math.floor(index / columns);
			const x = column * spacing_x;
			const y = row * spacing_y + layer * 12;
			nodes.push({
				id,
				type: `Op ${index % 15}`,
				x,
				y,
				data: { layer },
				ports: [],
			});
			index += 1;
		}
	}
	return nodes;
}

const large_graph: Perf_scenario = {
	id: 'large-graph-baseline',
	label: 'Large layered operator graph',
	description: 'Stress test rendering of a 40x25 operator grid with lightweight node shells.',
	viewport: { width: 1600, height: 900 },
	sampling: {
		warmup_ms: 1500,
		duration_ms: 5000,
	},
	frame_budget: {
		average_ms: 16.7,
		percentile_95_ms: 22,
	},
	node_dimensions: { width: 180, height: 104 },
	generate_nodes: () => generate_layered_grid(25, 40, 220, 160),
};

export default large_graph;
