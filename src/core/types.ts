export type Node_id = string;
export type Port_id = string;
export type Edge_id = string;

export type Port_side = 'top' | 'right' | 'bottom' | 'left';
export type Port_kind = 'in' | 'out';

export interface Port<T = unknown> {
	id: Port_id;
	node_id: Node_id;
	side: Port_side;
	kind: Port_kind;
	index: number;
	data?: T;
}

export interface Node<T = unknown> {
	id: Node_id;
	type: string;
	x: number;
	y: number;
	w?: number;
	h?: number;
	data?: T;
	ports: Port[];
}

export interface Edge<T = unknown> {
	id: Edge_id;
	from: {
		node_id: Node_id;
		port_id: Port_id;
	};
	to: {
		node_id: Node_id;
		port_id: Port_id;
	};
	data?: T;
}

export interface Graph {
	nodes: Map<Node_id, Node>;
	edges: Map<Edge_id, Edge>;
}

export interface Command<R = void> {
	type: string;
	payload?: unknown;
	do(graph: Graph): { graph: Graph; result?: R };
	undo?(graph: Graph): Graph;
}
