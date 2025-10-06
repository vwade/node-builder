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
declare function prime_ids(seed: Record<string, number>): void;

interface Connect_input {
    from: {
        node_id: Node_id;
        port_id: Port_id;
    };
    to: {
        node_id: Node_id;
        port_id: Port_id;
    };
    id?: Edge_id;
    data?: Edge['data'];
}
declare function create_graph(): Graph;
declare function clone_graph(graph: Graph): Graph;
declare function add_node(graph: Graph, node: Node): Graph;
declare function update_node(graph: Graph, node: Node): Graph;
declare function remove_node(graph: Graph, node_id: Node_id): Graph;
declare function move_nodes(graph: Graph, node_ids: Node_id[], dx: number, dy: number): Graph;
declare function set_node_position(graph: Graph, node_id: Node_id, x: number, y: number): Graph;
declare function connect(graph: Graph, input: Connect_input): Graph;
declare function remove_edge(graph: Graph, edge_id: Edge_id): Graph;
declare function disconnect(graph: Graph, edge_id: Edge_id): Graph;

interface History {
    past: Graph[];
    present: Graph;
    future: Graph[];
    limit: number;
}
declare function create_history(initial: Graph, limit?: number): History;
declare function push(history: History, graph: Graph): History;
declare function undo(history: History): History;
declare function redo(history: History): History;
declare function can_undo(history: History): boolean;
declare function can_redo(history: History): boolean;

interface Command_state {
    history: History;
}
declare function create_command_state(initial: Graph, limit?: number): Command_state;
declare function get_present_graph(state: Command_state): Graph;
declare function execute_command<R>(state: Command_state, command: Command<R>): {
    state: Command_state;
    result?: R;
};
declare function undo_command(state: Command_state): Command_state;
declare function redo_command(state: Command_state): Command_state;
declare function can_undo_command(state: Command_state): boolean;
declare function can_redo_command(state: Command_state): boolean;
declare function create_add_node_command(node: Node): Command<Node>;
declare function create_move_nodes_command(node_ids: Node_id[], dx: number, dy: number): Command<void>;
declare function create_connect_command(input: Connect_input): Command<Edge_id>;
declare function create_disconnect_command(edge_id: Edge_id): Command<void>;

interface Serialized_graph {
    nodes: Node[];
    edges: Edge[];
}
declare function serialize_graph(graph: Graph): Serialized_graph;
declare function deserialize_graph(serialized: Serialized_graph): Graph;

export { type Command, type Command_state, type Connect_input, type Edge, type Edge_id, type Graph, type History, type Node, type Node_id, type Port, type Port_id, type Port_kind, type Port_side, type Serialized_graph, add_node, can_redo, can_redo_command, can_undo, can_undo_command, clone_graph, connect, create_add_node_command, create_command_state, create_connect_command, create_disconnect_command, create_graph, create_history, create_move_nodes_command, deserialize_graph, disconnect, execute_command, gen_id, get_present_graph, move_nodes, peek_id, prime_ids, push, redo, redo_command, remove_edge, remove_node, reset_ids, serialize_graph, set_node_position, undo, undo_command, update_node };
