'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/core/id.ts
var counters = /* @__PURE__ */ new Map();
function gen_id(prefix = "id") {
  const counter = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, counter);
  return `${prefix}_${counter.toString(36)}`;
}
function peek_id(prefix = "id") {
  const counter = (counters.get(prefix) ?? 0) + 1;
  return `${prefix}_${counter.toString(36)}`;
}
function reset_ids(seed) {
  counters.clear();
  if (!seed) {
    return;
  }
  for (const [prefix, value] of Object.entries(seed)) {
    counters.set(prefix, value);
  }
}
function prime_ids(seed) {
  for (const [prefix, value] of Object.entries(seed)) {
    const current = counters.get(prefix) ?? 0;
    if (value > current) {
      counters.set(prefix, value);
    }
  }
}

// src/core/graph.ts
function create_graph() {
  return {
    nodes: /* @__PURE__ */ new Map(),
    edges: /* @__PURE__ */ new Map()
  };
}
function clone_graph(graph) {
  return {
    nodes: new Map(graph.nodes),
    edges: new Map(graph.edges)
  };
}
function add_node(graph, node) {
  if (graph.nodes.has(node.id)) {
    throw new Error(`Node with id "${node.id}" already exists`);
  }
  const normalized = normalize_node(node);
  const next = clone_graph(graph);
  next.nodes.set(normalized.id, normalized);
  return next;
}
function update_node(graph, node) {
  if (!graph.nodes.has(node.id)) {
    throw new Error(`Node with id "${node.id}" does not exist`);
  }
  const normalized = normalize_node(node);
  const next = clone_graph(graph);
  next.nodes.set(normalized.id, normalized);
  return next;
}
function remove_node(graph, node_id) {
  if (!graph.nodes.has(node_id)) {
    return graph;
  }
  const next = clone_graph(graph);
  next.nodes.delete(node_id);
  for (const [edge_id, edge] of next.edges) {
    if (edge.from.node_id === node_id || edge.to.node_id === node_id) {
      next.edges.delete(edge_id);
    }
  }
  return next;
}
function move_nodes(graph, node_ids, dx, dy) {
  if (!dx && !dy) {
    return graph;
  }
  let mutated = false;
  const next = clone_graph(graph);
  for (const node_id of node_ids) {
    const existing = next.nodes.get(node_id);
    if (!existing) {
      continue;
    }
    mutated = true;
    next.nodes.set(node_id, {
      ...existing,
      x: existing.x + dx,
      y: existing.y + dy
    });
  }
  return mutated ? next : graph;
}
function set_node_position(graph, node_id, x, y) {
  const existing = graph.nodes.get(node_id);
  if (!existing) {
    throw new Error(`Node with id "${node_id}" does not exist`);
  }
  if (existing.x === x && existing.y === y) {
    return graph;
  }
  const next = clone_graph(graph);
  next.nodes.set(node_id, {
    ...existing,
    x,
    y
  });
  return next;
}
function connect(graph, input) {
  const { from, to } = input;
  const from_node = graph.nodes.get(from.node_id);
  const to_node = graph.nodes.get(to.node_id);
  if (!from_node) {
    throw new Error(`Cannot connect from missing node "${from.node_id}"`);
  }
  if (!to_node) {
    throw new Error(`Cannot connect to missing node "${to.node_id}"`);
  }
  const from_port = find_port(from_node, from.port_id);
  const to_port = find_port(to_node, to.port_id);
  if (!from_port) {
    throw new Error(`Port "${from.port_id}" not found on node "${from.node_id}"`);
  }
  if (!to_port) {
    throw new Error(`Port "${to.port_id}" not found on node "${to.node_id}"`);
  }
  if (from_port.kind === "in") {
    throw new Error(`Cannot connect from an input port "${from.port_id}"`);
  }
  if (to_port.kind === "out") {
    throw new Error(`Cannot connect to an output port "${to.port_id}"`);
  }
  const edge_id = input.id ?? gen_id("e");
  if (graph.edges.has(edge_id)) {
    throw new Error(`Edge with id "${edge_id}" already exists`);
  }
  const next = clone_graph(graph);
  const edge = {
    id: edge_id,
    from: { node_id: from.node_id, port_id: from.port_id },
    to: { node_id: to.node_id, port_id: to.port_id },
    data: input.data
  };
  next.edges.set(edge.id, edge);
  return next;
}
function remove_edge(graph, edge_id) {
  if (!graph.edges.has(edge_id)) {
    return graph;
  }
  const next = clone_graph(graph);
  next.edges.delete(edge_id);
  return next;
}
function disconnect(graph, edge_id) {
  return remove_edge(graph, edge_id);
}
function normalize_node(node) {
  const seen = /* @__PURE__ */ new Set();
  const ports = node.ports.map((port, index) => {
    const id = port.id ?? `${node.id}_port_${index}`;
    if (seen.has(id)) {
      throw new Error(`Duplicate port id "${id}" on node "${node.id}"`);
    }
    seen.add(id);
    return {
      ...port,
      id,
      node_id: node.id,
      index: port.index ?? index
    };
  });
  return {
    ...node,
    ports
  };
}
function find_port(node, port_id) {
  return node.ports.find((port) => port.id === port_id);
}

// src/core/serialize.ts
function serialize_graph(graph) {
  return {
    nodes: [...graph.nodes.values()].map(clone_node),
    edges: [...graph.edges.values()].map(clone_edge)
  };
}
function deserialize_graph(serialized) {
  const seeds = collect_id_seeds(serialized);
  if (Object.keys(seeds).length > 0) {
    prime_ids(seeds);
  }
  let graph = create_graph();
  for (const node of serialized.nodes) {
    graph = add_node(graph, clone_node(node));
  }
  for (const edge of serialized.edges) {
    graph = connect(graph, {
      from: { ...edge.from },
      to: { ...edge.to },
      id: edge.id,
      data: edge.data
    });
  }
  return graph;
}
function clone_node(node) {
  return {
    ...node,
    ports: node.ports.map((port) => ({ ...port }))
  };
}
function clone_edge(edge) {
  return {
    ...edge,
    from: { ...edge.from },
    to: { ...edge.to }
  };
}
function collect_id_seeds(serialized) {
  const maxima = /* @__PURE__ */ new Map();
  for (const node of serialized.nodes) {
    record_max_suffix(maxima, node.id);
  }
  for (const edge of serialized.edges) {
    record_max_suffix(maxima, edge.id);
  }
  return Object.fromEntries(maxima);
}
function record_max_suffix(target, id) {
  if (!id) {
    return;
  }
  const separator = id.lastIndexOf("_");
  if (separator === -1 || separator === id.length - 1) {
    return;
  }
  const prefix = id.slice(0, separator);
  const suffix = id.slice(separator + 1);
  if (!/^[0-9a-z]+$/i.test(suffix)) {
    return;
  }
  const value = parseInt(suffix, 36);
  if (Number.isNaN(value)) {
    return;
  }
  const current = target.get(prefix) ?? 0;
  if (value > current) {
    target.set(prefix, value);
  }
}

// src/core/history.ts
function create_history(initial_graph) {
  return {
    graph: initial_graph,
    undo_stack: [],
    redo_stack: []
  };
}
function execute_command(history, command) {
  const { graph: graph_before } = history;
  const { graph: graph_after, result } = command.do(graph_before);
  const mutated = graph_after !== graph_before;
  if (!mutated) {
    return {
      history: {
        graph: graph_after,
        undo_stack: history.undo_stack,
        redo_stack: history.redo_stack
      },
      result
    };
  }
  const entry = {
    command,
    graph_before,
    graph_after,
    result
  };
  return {
    history: {
      graph: graph_after,
      undo_stack: [...history.undo_stack, entry],
      redo_stack: []
    },
    result
  };
}
function undo(history) {
  if (!history.undo_stack.length) {
    return history;
  }
  const next_undo_stack = history.undo_stack.slice(0, -1);
  const entry = history.undo_stack[history.undo_stack.length - 1];
  const previous_graph = entry.command.undo ? entry.command.undo(history.graph) : entry.graph_before;
  return {
    graph: previous_graph,
    undo_stack: next_undo_stack,
    redo_stack: [...history.redo_stack, entry]
  };
}
function redo(history) {
  if (!history.redo_stack.length) {
    return history;
  }
  const next_redo_stack = history.redo_stack.slice(0, -1);
  const entry = history.redo_stack[history.redo_stack.length - 1];
  return {
    graph: entry.graph_after,
    undo_stack: [...history.undo_stack, entry],
    redo_stack: next_redo_stack
  };
}
function clear_history(history, graph) {
  return {
    graph,
    undo_stack: [],
    redo_stack: []
  };
}
function can_undo(history) {
  return history.undo_stack.length > 0;
}
function can_redo(history) {
  return history.redo_stack.length > 0;
}

// src/core/selection.ts
function create_selection() {
  return {
    nodes: /* @__PURE__ */ new Set(),
    edges: /* @__PURE__ */ new Set()
  };
}
function clear_selection(selection) {
  if (!selection.nodes.size && !selection.edges.size) {
    return selection;
  }
  return create_selection();
}
function is_node_selected(selection, node_id) {
  return selection.nodes.has(node_id);
}
function is_edge_selected(selection, edge_id) {
  return selection.edges.has(edge_id);
}
function select_node(selection, node_id, options = {}) {
  const append = options.append ?? false;
  if (append) {
    if (selection.nodes.has(node_id)) {
      return selection;
    }
    const nodes2 = new Set(selection.nodes);
    nodes2.add(node_id);
    return {
      nodes: nodes2,
      edges: new Set(selection.edges)
    };
  }
  const already_only_node = selection.nodes.size === 1 && selection.nodes.has(node_id);
  if (already_only_node && !selection.edges.size) {
    return selection;
  }
  const nodes = /* @__PURE__ */ new Set();
  nodes.add(node_id);
  return {
    nodes,
    edges: /* @__PURE__ */ new Set()
  };
}
function select_edge(selection, edge_id, options = {}) {
  const append = options.append ?? false;
  if (append) {
    if (selection.edges.has(edge_id)) {
      return selection;
    }
    const edges2 = new Set(selection.edges);
    edges2.add(edge_id);
    return {
      nodes: new Set(selection.nodes),
      edges: edges2
    };
  }
  const already_only_edge = selection.edges.size === 1 && selection.edges.has(edge_id);
  if (already_only_edge && !selection.nodes.size) {
    return selection;
  }
  const edges = /* @__PURE__ */ new Set();
  edges.add(edge_id);
  return {
    nodes: /* @__PURE__ */ new Set(),
    edges
  };
}
function deselect_node(selection, node_id) {
  if (!selection.nodes.has(node_id)) {
    return selection;
  }
  const nodes = new Set(selection.nodes);
  nodes.delete(node_id);
  if (!nodes.size && !selection.edges.size) {
    return create_selection();
  }
  return {
    nodes,
    edges: new Set(selection.edges)
  };
}
function deselect_edge(selection, edge_id) {
  if (!selection.edges.has(edge_id)) {
    return selection;
  }
  const edges = new Set(selection.edges);
  edges.delete(edge_id);
  if (!edges.size && !selection.nodes.size) {
    return create_selection();
  }
  return {
    nodes: new Set(selection.nodes),
    edges
  };
}
function toggle_node(selection, node_id) {
  return selection.nodes.has(node_id) ? deselect_node(selection, node_id) : select_node(selection, node_id, { append: true });
}
function toggle_edge(selection, edge_id) {
  return selection.edges.has(edge_id) ? deselect_edge(selection, edge_id) : select_edge(selection, edge_id, { append: true });
}
function to_selection_arrays(selection) {
  return {
    nodes: [...selection.nodes],
    edges: [...selection.edges]
  };
}

// src/react/transform.ts
var DEFAULT_TRANSFORM = {
  x: 0,
  y: 0,
  scale: 1
};
var DEFAULT_ZOOM_OPTIONS = {
  min_scale: 0.25,
  max_scale: 4,
  zoom_sensitivity: 15e-4
};
function pan_by(transform, dx, dy) {
  if (!dx && !dy) {
    return transform;
  }
  return {
    ...transform,
    x: transform.x + dx,
    y: transform.y + dy
  };
}
function zoom_at(transform, point, delta, options = DEFAULT_ZOOM_OPTIONS) {
  if (!delta) {
    return transform;
  }
  const target_scale = clamp_scale(
    transform.scale * Math.exp(-delta * options.zoom_sensitivity),
    options.min_scale,
    options.max_scale
  );
  if (target_scale === transform.scale) {
    return transform;
  }
  const world = to_world(transform, point);
  return {
    scale: target_scale,
    x: point.x - world.x * target_scale,
    y: point.y - world.y * target_scale
  };
}
function to_screen(transform, point) {
  return {
    x: point.x * transform.scale + transform.x,
    y: point.y * transform.scale + transform.y
  };
}
function to_world(transform, point) {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale
  };
}
function clamp_scale(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
var Canvas_context = react.createContext(null);
function use_canvas() {
  const value = react.useContext(Canvas_context);
  if (!value) {
    throw new Error("use_canvas must be used within a Graph_canvas");
  }
  return value;
}
function Graph_canvas(props) {
  const {
    graph,
    render_node,
    render_edge,
    class_name,
    style,
    background,
    show_grid = true,
    initial_transform,
    min_scale = DEFAULT_ZOOM_OPTIONS.min_scale,
    max_scale = DEFAULT_ZOOM_OPTIONS.max_scale,
    zoom_sensitivity = DEFAULT_ZOOM_OPTIONS.zoom_sensitivity,
    on_transform_change
  } = props;
  const container_ref = react.useRef(null);
  const pan_state_ref = react.useRef(null);
  const zoom_options = react.useMemo(() => ({
    min_scale,
    max_scale,
    zoom_sensitivity
  }), [min_scale, max_scale, zoom_sensitivity]);
  const [transform, set_transform] = react.useState(
    initial_transform ?? DEFAULT_TRANSFORM
  );
  react.useEffect(() => {
    if (!initial_transform) {
      return;
    }
    set_transform(initial_transform);
  }, [initial_transform]);
  const set_transform_with_callback = react.useCallback(
    (update) => {
      set_transform((previous) => {
        const next = typeof update === "function" ? update(previous) : update;
        if (on_transform_change && (next.x !== previous.x || next.y !== previous.y || next.scale !== previous.scale)) {
          on_transform_change(next);
        }
        return next;
      });
    },
    [on_transform_change]
  );
  const handle_pointer_down = react.useCallback(
    (event) => {
      if (event.button !== 0 && event.button !== 1) {
        return;
      }
      event.preventDefault();
      const pointer_state = {
        pointer_id: event.pointerId,
        origin_client: { x: event.clientX, y: event.clientY },
        start_transform: transform
      };
      pan_state_ref.current = pointer_state;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [transform]
  );
  const handle_pointer_move = react.useCallback(
    (event) => {
      const pointer_state = pan_state_ref.current;
      if (!pointer_state || pointer_state.pointer_id !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const dx = event.clientX - pointer_state.origin_client.x;
      const dy = event.clientY - pointer_state.origin_client.y;
      const next_transform = pan_by(pointer_state.start_transform, dx, dy);
      set_transform_with_callback(next_transform);
    },
    [set_transform_with_callback]
  );
  const clear_pan_state = react.useCallback(() => {
    pan_state_ref.current = null;
  }, []);
  const handle_pointer_up = react.useCallback(
    (event) => {
      const pointer_state = pan_state_ref.current;
      if (!pointer_state || pointer_state.pointer_id !== event.pointerId) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      clear_pan_state();
    },
    [clear_pan_state]
  );
  const handle_pointer_cancel = react.useCallback(
    (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      clear_pan_state();
    },
    [clear_pan_state]
  );
  const handle_wheel = react.useCallback(
    (event) => {
      event.preventDefault();
      const container = container_ref.current;
      if (!container) {
        return;
      }
      const bounds = container.getBoundingClientRect();
      const point = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      };
      set_transform_with_callback((previous) => zoom_at(previous, point, event.deltaY, zoom_options));
    },
    [zoom_options, set_transform_with_callback]
  );
  const nodes = react.useMemo(() => Array.from(graph.nodes.values()), [graph]);
  const edges = react.useMemo(() => Array.from(graph.edges.values()), [graph]);
  const node_elements = nodes.map((node) => {
    const world = { x: node.x, y: node.y };
    const screen = to_screen(transform, world);
    return /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        "data-node-id": node.id,
        style: {
          position: "absolute",
          left: node.x,
          top: node.y
        },
        children: render_node({ node, transform, world, screen })
      },
      node.id
    );
  });
  const edge_elements = render_edge ? /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      className: "nova-node-edge-layer",
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible"
      },
      children: edges.map((edge) => {
        const from_node = graph.nodes.get(edge.from.node_id);
        const to_node = graph.nodes.get(edge.to.node_id);
        const from_port = from_node?.ports.find((port) => port.id === edge.from.port_id) ?? null;
        const to_port = to_node?.ports.find((port) => port.id === edge.to.port_id) ?? null;
        const from_world = from_node ? { x: from_node.x, y: from_node.y } : null;
        const to_world2 = to_node ? { x: to_node.x, y: to_node.y } : null;
        const from_screen = from_world ? to_screen(transform, from_world) : null;
        const to_screen_point = to_world2 ? to_screen(transform, to_world2) : null;
        return /* @__PURE__ */ jsxRuntime.jsx("g", { "data-edge-id": edge.id, children: render_edge({
          edge,
          from: {
            node: from_node ?? void 0,
            port: from_port ?? void 0,
            world: from_world,
            screen: from_screen
          },
          to: {
            node: to_node ?? void 0,
            port: to_port ?? void 0,
            world: to_world2,
            screen: to_screen_point
          },
          transform
        }) }, edge.id);
      })
    }
  ) : null;
  const context_value = react.useMemo(
    () => ({
      transform,
      to_screen: (point) => to_screen(transform, point),
      to_world: (point) => to_world(transform, point)
    }),
    [transform]
  );
  return /* @__PURE__ */ jsxRuntime.jsx(Canvas_context.Provider, { value: context_value, children: /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref: container_ref,
      className: class_name,
      onPointerDown: handle_pointer_down,
      onPointerMove: handle_pointer_move,
      onPointerUp: handle_pointer_up,
      onPointerCancel: handle_pointer_cancel,
      onWheel: handle_wheel,
      style: {
        position: "relative",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        ...style
      },
      children: [
        background,
        show_grid ? /* @__PURE__ */ jsxRuntime.jsx(Canvas_grid, { transform }) : null,
        /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: "nova-node-canvas",
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
              transformOrigin: "0 0"
            },
            children: [
              edge_elements,
              /* @__PURE__ */ jsxRuntime.jsx(
                "div",
                {
                  className: "nova-node-canvas-nodes",
                  style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
                  children: node_elements
                }
              )
            ]
          }
        )
      ]
    }
  ) });
}
function Canvas_grid(props) {
  const {
    transform,
    size = 24,
    major_every = 4,
    minor_color = "rgba(255, 255, 255, 0.06)",
    major_color = "rgba(255, 255, 255, 0.12)",
    style
  } = props;
  const safe_scale = Math.max(transform.scale, Number.EPSILON);
  const minor_step = size * safe_scale;
  const major_step = minor_step * major_every;
  const minor_position = compute_background_position(transform, size);
  const major_position = compute_background_position(transform, size * major_every);
  const background_position = [minor_position, minor_position, major_position, major_position].join(", ");
  const background_size = [
    `${minor_step}px ${minor_step}px`,
    `${minor_step}px ${minor_step}px`,
    `${major_step}px ${major_step}px`,
    `${major_step}px ${major_step}px`
  ].join(", ");
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      "aria-hidden": "true",
      className: "nova-node-canvas-grid",
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `linear-gradient(${minor_color} 1px, transparent 1px), linear-gradient(90deg, ${minor_color} 1px, transparent 1px), linear-gradient(${major_color} 1px, transparent 1px), linear-gradient(90deg, ${major_color} 1px, transparent 1px)`,
        backgroundSize: background_size,
        backgroundPosition: background_position,
        pointerEvents: "none",
        ...style
      }
    }
  );
}
function compute_background_position(transform, world_step) {
  const world_origin = to_world(transform, { x: 0, y: 0 });
  const offset_x = wrap_modulo(world_origin.x, world_step);
  const offset_y = wrap_modulo(world_origin.y, world_step);
  const screen_offset_x = -offset_x * transform.scale;
  const screen_offset_y = -offset_y * transform.scale;
  return `${screen_offset_x}px ${screen_offset_y}px`;
}
function wrap_modulo(value, step) {
  const remainder = value % step;
  return remainder < 0 ? remainder + step : remainder;
}

exports.Canvas_context = Canvas_context;
exports.Canvas_grid = Canvas_grid;
exports.DEFAULT_TRANSFORM = DEFAULT_TRANSFORM;
exports.DEFAULT_ZOOM_OPTIONS = DEFAULT_ZOOM_OPTIONS;
exports.Graph_canvas = Graph_canvas;
exports.add_node = add_node;
exports.can_redo = can_redo;
exports.can_undo = can_undo;
exports.clear_history = clear_history;
exports.clear_selection = clear_selection;
exports.clone_graph = clone_graph;
exports.connect = connect;
exports.create_graph = create_graph;
exports.create_history = create_history;
exports.create_selection = create_selection;
exports.deselect_edge = deselect_edge;
exports.deselect_node = deselect_node;
exports.deserialize_graph = deserialize_graph;
exports.disconnect = disconnect;
exports.execute_command = execute_command;
exports.gen_id = gen_id;
exports.is_edge_selected = is_edge_selected;
exports.is_node_selected = is_node_selected;
exports.move_nodes = move_nodes;
exports.pan_by = pan_by;
exports.peek_id = peek_id;
exports.prime_ids = prime_ids;
exports.redo = redo;
exports.remove_edge = remove_edge;
exports.remove_node = remove_node;
exports.reset_ids = reset_ids;
exports.select_edge = select_edge;
exports.select_node = select_node;
exports.serialize_graph = serialize_graph;
exports.set_node_position = set_node_position;
exports.to_screen = to_screen;
exports.to_selection_arrays = to_selection_arrays;
exports.to_world = to_world;
exports.toggle_edge = toggle_edge;
exports.toggle_node = toggle_node;
exports.undo = undo;
exports.update_node = update_node;
exports.use_canvas = use_canvas;
exports.zoom_at = zoom_at;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map