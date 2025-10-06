type Node_id = string;
type Port_id = string;
type Edge_id = string;
type Port_side = 'top' | 'right' | 'bottom' | 'left';
type Port_kind = 'in' | 'out';
interface Port<T = unknown> {
    id: Port_id;
    node_id: Node_id;
    side: Port_side;
    kind: Port_kind;
    index: number;
    data?: T;
}
interface Node<T = unknown> {
    id: Node_id;
    type: string;
    x: number;
    y: number;
    w?: number;
    h?: number;
    data?: T;
    ports: Port[];
}
interface Edge<T = unknown> {
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
interface Graph {
    nodes: Map<Node_id, Node>;
    edges: Map<Edge_id, Edge>;
}
interface Command<R = void> {
    type: string;
    payload?: unknown;
    do(graph: Graph): {
        graph: Graph;
        result?: R;
    };
    undo?(graph: Graph): Graph;
}

declare function gen_id(prefix?: string): string;
declare function peek_id(prefix?: string): string;
declare function reset_ids(seed?: Record<string, number>): void;

export { type Command, type Edge, type Edge_id, type Graph, type Node, type Node_id, type Port, type Port_id, type Port_kind, type Port_side, gen_id, peek_id, reset_ids };
