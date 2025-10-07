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

interface Serialized_graph {
    nodes: Node[];
    edges: Edge[];
}
declare function serialize_graph(graph: Graph): Serialized_graph;
declare function deserialize_graph(serialized: Serialized_graph): Graph;

interface Command_entry<R = unknown> {
    command: Command<R>;
    graph_before: Graph;
    graph_after: Graph;
    result?: R;
}
interface History_state {
    graph: Graph;
    undo_stack: Command_entry[];
    redo_stack: Command_entry[];
}
interface Execute_result<R = unknown> {
    history: History_state;
    result?: R;
}
declare function create_history(initial_graph: Graph): History_state;
declare function execute_command<R>(history: History_state, command: Command<R>): Execute_result<R>;
declare function undo(history: History_state): History_state;
declare function redo(history: History_state): History_state;
declare function clear_history(history: History_state, graph: Graph): History_state;
declare function can_undo(history: History_state): boolean;
declare function can_redo(history: History_state): boolean;

type Selection_kind = 'node' | 'edge';
interface Selection_state {
    nodes: Set<Node_id>;
    edges: Set<Edge_id>;
}
interface Select_options {
    append?: boolean;
}
declare function create_selection(): Selection_state;
declare function clear_selection(selection: Selection_state): Selection_state;
declare function is_node_selected(selection: Selection_state, node_id: Node_id): boolean;
declare function is_edge_selected(selection: Selection_state, edge_id: Edge_id): boolean;
declare function select_node(selection: Selection_state, node_id: Node_id, options?: Select_options): Selection_state;
declare function select_edge(selection: Selection_state, edge_id: Edge_id, options?: Select_options): Selection_state;
declare function deselect_node(selection: Selection_state, node_id: Node_id): Selection_state;
declare function deselect_edge(selection: Selection_state, edge_id: Edge_id): Selection_state;
declare function toggle_node(selection: Selection_state, node_id: Node_id): Selection_state;
declare function toggle_edge(selection: Selection_state, edge_id: Edge_id): Selection_state;
declare function to_selection_arrays(selection: Selection_state): {
    nodes: Node_id[];
    edges: Edge_id[];
};

export { type Command, type Command_entry, type Connect_input, type Edge, type Edge_id, type Execute_result, type Graph, type History_state, type Node, type Node_id, type Port, type Port_id, type Port_kind, type Port_side, type Select_options, type Selection_kind, type Selection_state, type Serialized_graph, add_node, can_redo, can_undo, clear_history, clear_selection, clone_graph, connect, create_graph, create_history, create_selection, deselect_edge, deselect_node, deserialize_graph, disconnect, execute_command, gen_id, is_edge_selected, is_node_selected, move_nodes, peek_id, prime_ids, redo, remove_edge, remove_node, reset_ids, select_edge, select_node, serialize_graph, set_node_position, to_selection_arrays, toggle_edge, toggle_node, undo, update_node };
