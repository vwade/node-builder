'use strict';

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

exports.gen_id = gen_id;
exports.peek_id = peek_id;
exports.reset_ids = reset_ids;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map