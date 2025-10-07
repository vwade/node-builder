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

export { add_node, can_redo, can_undo, clear_history, clear_selection, clone_graph, connect, create_graph, create_history, create_selection, deselect_edge, deselect_node, deserialize_graph, disconnect, execute_command, gen_id, is_edge_selected, is_node_selected, move_nodes, peek_id, prime_ids, redo, remove_edge, remove_node, reset_ids, select_edge, select_node, serialize_graph, set_node_position, to_selection_arrays, toggle_edge, toggle_node, undo, update_node };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map