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

// src/core/history.ts
function create_history(initial, limit = 100) {
  if (limit <= 0) {
    throw new Error("History limit must be greater than zero");
  }
  return {
    past: [],
    present: initial,
    future: [],
    limit
  };
}
function push(history, graph) {
  if (history.present === graph) {
    return history;
  }
  const trimmed = history.past.length >= history.limit ? [...history.past.slice(1), history.present] : [...history.past, history.present];
  return {
    past: trimmed,
    present: graph,
    future: [],
    limit: history.limit
  };
}
function undo(history) {
  if (!history.past.length) {
    return history;
  }
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    limit: history.limit
  };
}
function redo(history) {
  if (!history.future.length) {
    return history;
  }
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    limit: history.limit
  };
}
function can_undo(history) {
  return history.past.length > 0;
}
function can_redo(history) {
  return history.future.length > 0;
}

// src/core/commands.ts
function create_command_state(initial, limit = 100) {
  return {
    history: create_history(initial, limit)
  };
}
function get_present_graph(state) {
  return state.history.present;
}
function execute_command(state, command) {
  const { graph, result } = command.do(state.history.present);
  const history = push(state.history, graph);
  if (history === state.history) {
    return { state, result };
  }
  return {
    state: { history },
    result
  };
}
function undo_command(state) {
  const history = undo(state.history);
  return history === state.history ? state : { history };
}
function redo_command(state) {
  const history = redo(state.history);
  return history === state.history ? state : { history };
}
function can_undo_command(state) {
  return can_undo(state.history);
}
function can_redo_command(state) {
  return can_redo(state.history);
}
function create_add_node_command(node) {
  return {
    type: "add_node",
    payload: node,
    do(graph) {
      return { graph: add_node(graph, node), result: node };
    },
    undo(graph) {
      return remove_node(graph, node.id);
    }
  };
}
function create_move_nodes_command(node_ids, dx, dy) {
  return {
    type: "move_nodes",
    payload: { node_ids, dx, dy },
    do(graph) {
      return { graph: move_nodes(graph, node_ids, dx, dy) };
    },
    undo(graph) {
      return move_nodes(graph, node_ids, -dx, -dy);
    }
  };
}
function create_connect_command(input) {
  let created_edge_id = input.id ?? null;
  return {
    type: "connect",
    payload: input,
    do(graph) {
      const before = created_edge_id ? null : new Set(graph.edges.keys());
      const next = connect(graph, input);
      if (!created_edge_id) {
        for (const candidate of next.edges.keys()) {
          if (!before?.has(candidate)) {
            created_edge_id = candidate;
            break;
          }
        }
      }
      if (!created_edge_id) {
        throw new Error("Failed to determine edge id for connect command");
      }
      return { graph: next, result: created_edge_id };
    },
    undo(graph) {
      if (!created_edge_id) {
        return graph;
      }
      return remove_edge(graph, created_edge_id);
    }
  };
}
function create_disconnect_command(edge_id) {
  return {
    type: "disconnect",
    payload: edge_id,
    do(graph) {
      return { graph: remove_edge(graph, edge_id) };
    }
  };
}

// src/core/serialize.ts
function serialize_graph(graph) {
  return {
    nodes: [...graph.nodes.values()].map(clone_node),
    edges: [...graph.edges.values()].map(clone_edge)
  };
}
function deserialize_graph(serialized) {
  const seed = {};
  for (const node of serialized.nodes) {
    track_id(seed, node.id);
  }
  for (const edge of serialized.edges) {
    track_id(seed, edge.id);
  }
  if (Object.keys(seed).length) {
    prime_ids(seed);
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
function track_id(seed, id) {
  const separator = id.lastIndexOf("_");
  if (separator <= 0 || separator === id.length - 1) {
    return;
  }
  const prefix = id.slice(0, separator);
  const raw = id.slice(separator + 1);
  const value = parseInt(raw, 36);
  if (Number.isNaN(value)) {
    return;
  }
  const current = seed[prefix];
  if (!current || value > current) {
    seed[prefix] = value;
  }
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

export { add_node, can_redo, can_redo_command, can_undo, can_undo_command, clone_graph, connect, create_add_node_command, create_command_state, create_connect_command, create_disconnect_command, create_graph, create_history, create_move_nodes_command, deserialize_graph, disconnect, execute_command, gen_id, get_present_graph, move_nodes, peek_id, prime_ids, push, redo, redo_command, remove_edge, remove_node, reset_ids, serialize_graph, set_node_position, undo, undo_command, update_node };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map