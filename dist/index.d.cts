import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { ReactNode, CSSProperties } from 'react';

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

interface Canvas_point {
    x: number;
    y: number;
}
interface Canvas_transform {
    x: number;
    y: number;
    scale: number;
}
interface Zoom_options {
    min_scale: number;
    max_scale: number;
    zoom_sensitivity: number;
}
declare const DEFAULT_TRANSFORM: Canvas_transform;
declare const DEFAULT_ZOOM_OPTIONS: Zoom_options;
declare function pan_by(transform: Canvas_transform, dx: number, dy: number): Canvas_transform;
declare function zoom_at(transform: Canvas_transform, point: Canvas_point, delta: number, options?: Zoom_options): Canvas_transform;
declare function to_screen(transform: Canvas_transform, point: Canvas_point): Canvas_point;
declare function to_world(transform: Canvas_transform, point: Canvas_point): Canvas_point;

interface Node_render_input {
    node: Node;
    transform: Canvas_transform;
    world: Canvas_point;
    screen: Canvas_point;
}
interface Edge_endpoint_render_input {
    node?: Node;
    port?: Port;
    world: Canvas_point | null;
    screen: Canvas_point | null;
}
interface Edge_render_input {
    edge: Edge;
    from: Edge_endpoint_render_input;
    to: Edge_endpoint_render_input;
    transform: Canvas_transform;
}
interface Graph_canvas_props {
    graph: Graph;
    render_node: (input: Node_render_input) => ReactNode;
    render_edge?: (input: Edge_render_input) => ReactNode;
    class_name?: string;
    style?: CSSProperties;
    background?: ReactNode;
    show_grid?: boolean;
    initial_transform?: Canvas_transform;
    min_scale?: number;
    max_scale?: number;
    zoom_sensitivity?: number;
    on_transform_change?: (transform: Canvas_transform) => void;
}
interface Canvas_context_value {
    transform: Canvas_transform;
    to_screen: (point: Canvas_point) => Canvas_point;
    to_world: (point: Canvas_point) => Canvas_point;
}
declare const Canvas_context: react.Context<Canvas_context_value | null>;
declare function use_canvas(): Canvas_context_value;
declare function Graph_canvas(props: Graph_canvas_props): react_jsx_runtime.JSX.Element;
interface Canvas_grid_props {
    transform: Canvas_transform;
    size?: number;
    major_every?: number;
    minor_color?: string;
    major_color?: string;
    style?: CSSProperties;
}
declare function Canvas_grid(props: Canvas_grid_props): react_jsx_runtime.JSX.Element;

export { Canvas_context, Canvas_grid, type Canvas_grid_props, type Canvas_point, type Canvas_transform, type Command, type Command_entry, type Connect_input, DEFAULT_TRANSFORM, DEFAULT_ZOOM_OPTIONS, type Edge, type Edge_endpoint_render_input, type Edge_id, type Edge_render_input, type Execute_result, type Graph, Graph_canvas, type Graph_canvas_props, type History_state, type Node, type Node_id, type Node_render_input, type Port, type Port_id, type Port_kind, type Port_side, type Select_options, type Selection_kind, type Selection_state, type Serialized_graph, type Zoom_options, add_node, can_redo, can_undo, clear_history, clear_selection, clone_graph, connect, create_graph, create_history, create_selection, deselect_edge, deselect_node, deserialize_graph, disconnect, execute_command, gen_id, is_edge_selected, is_node_selected, move_nodes, pan_by, peek_id, prime_ids, redo, remove_edge, remove_node, reset_ids, select_edge, select_node, serialize_graph, set_node_position, to_screen, to_selection_arrays, to_world, toggle_edge, toggle_node, undo, update_node, use_canvas, zoom_at };
