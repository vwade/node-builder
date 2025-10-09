# NovaNode

NovaNode is an embeddable node-graph editor built with a headless core and pluggable view adapters. The project aims to provide a deterministic command-driven graph engine alongside a React reference implementation.

## Status

### Recent focus

* Added a selection state module with single and multi-select helpers for nodes and edges, rounding out the core interaction primitives.
* Implemented the core graph state operations and JSON serialization helpers, enabling pure add/remove/move/connect workflows with round-trip persistence.
* Completed the project scaffold and build pipeline, including TypeScript, tsup bundling, and ESLint flat config.
* Added a GitHub Actions workflow that runs linting, build, and tests on every push or pull request against `codex-*` branches.
* Landed the React canvas adapter with draggable node surfaces and default rendering, unlocking the upcoming edge creation work.
* Introduced camera fitting utilities so the React viewport can center graph bounds with configurable padding ahead of the routing pass.
* Added an edge routing helper that blends straight runs into quadratic curves so canvas edges can gradually adopt richer paths.
* Tuned the routing helper with curvature heuristics, metadata, and React layer hooks so custom renderers can share consistent path data.

### Upcoming work

* Benchmark the routing heuristics against sample graphs and document how contributors can extend the interaction model.
* Prototype obstacle-aware routing cues and visual affordances ahead of the keyboard and theming passes.

The repository currently contains the build and linting scaffold for the TypeScript codebase. Bundles are produced through `tsup`, with linting handled by ESLint's flat config. The public API surface will be expanded incrementally as core features land.

## Getting started

```bash
npm install
npm run build
npm run lint
```

These commands generate the library bundles under `dist/` and run the lint checks. Additional scripts (tests, demo) will be introduced as the implementation progresses.

## Embedding in a custom UX

The React adapter ships with everything needed to wire NovaNode into a bespoke interface. To try the current canvas in a fresh UX shell:

1. Scaffold a React workspace (for example with `npm create vite@latest my-graph -- --template react-ts`) and install NovaNode with `npm install nova-node` or a local file reference while developing.
2. Model your graph state with `useState` (or a preferred store) using the exported `Node`, `Edge`, and helper utilities from `src/core`. Start with a handful of sample nodes and edges so you can iterate on visuals quickly.
3. Wrap your canvas region with `<Graph_canvas>` to provide camera context, then render `<Graph_node_layer>` and `<Graph_edge_layer>` as siblings inside it. Pass the live node and edge arrays plus any callbacks for drag, selection, or connection preview handling.
4. Forward connection previews from `Graph_node_layer` into `Graph_edge_layer` so in-progress edges reuse the same routing helper that finished edges do. The preview payload can also drive custom HUD or inspector UIs.
5. Customize the render callbacks to blend NovaNode's logic into your house style—swap the default node surface, ports, and edges for your branded components while retaining the underlying interaction model.

```tsx
import { useState } from 'react';
import {
	Graph_canvas,
	Graph_node_layer,
	Graph_edge_layer,
	type Edge,
	type Node,
} from 'nova-node';

export function My_graph(): JSX.Element {
	const [nodes, set_nodes] = useState<Node[]>([
		{ id: 'a', type: 'Input', position: { x: 120, y: 160 }, ports: [] },
		{ id: 'b', type: 'Output', position: { x: 420, y: 260 }, ports: [] },
	]);
	const [edges, set_edges] = useState<Edge[]>([]);
	const [preview, set_preview] = useState(null);

	return (
		<Graph_canvas className="graph-surface">
			<Graph_edge_layer
				nodes={nodes}
				edges={edges}
				preview={preview}
			/>
			<Graph_node_layer
				nodes={nodes}
				on_connection_preview={set_preview}
				on_connection_complete={({ from, to }) => {
					set_edges((current) => [
						...current,
						{
							id: `edge-${current.length + 1}`,
							from: { node_id: from.node.id, port_id: from.port.id },
							to: { node_id: to.node.id, port_id: to.port.id },
						},
					]);
				}}
			/>
		</Graph_canvas>
	);
}
```

With this scaffold in place you can iterate on layout, theming, and command surfaces while leaning on the existing routing and camera helpers. Drop the component into your preferred shell (Next.js route, design system story, or internal playground) to see the current feature set in motion.

## Continuous integration

NovaNode now ships with a GitHub Actions workflow that executes `npm run lint`, `npm run build`, and `npm test` whenever changes are pushed to or proposed against `codex-*` branches. This ensures the library remains in a healthy state before merging feature work.

## Project layout

```
├── src/
│   └── index.ts          # library entry point exporting core surface
├── tsconfig.json         # strict TypeScript configuration
├── tsup.config.ts        # bundler output settings (esm/cjs/types)
├── eslint.config.js      # flat-config ESLint baseline
├── package.json          # project metadata and scripts
└── README.md
```

## Roadmap

The roadmap follows the zero-shot sequence outlined for NovaNode. Completed work is marked with a check, the current focus is hi
ghlighted, and future milestones remain unchecked so contributors can anticipate the progression.

1. [x] Project scaffold & build
2. [x] Core types & id generator
3. [x] Graph state & operations
4. [x] Command stack & history
5. [x] Selection model
6. [x] React adapter bootstrap
7. [x] Node view & dragging
8. [x] Ports & edge creation
9. [ ] **Edge routing (straight → quad curve)** *(in progress — camera utilities landed to prep the canvas)*
10. [ ] Keyboard layer
11. [ ] Theme tokens & CSS
12. [ ] Import/Export API
13. [ ] Minimap plugin
14. [ ] Auto-layout plugin (DAG)
15. [ ] Group nodes & comments
16. [ ] Clipboard & duplicate
17. [ ] Accessibility & ARIA pass
18. [ ] Performance pass
19. [ ] Docs & Storybook
20. [ ] Norminette
21. [ ] Release & SemVer

Each task will be tackled sequentially to maintain a stable, testable feature set. With draggable nodes in place, the next tangible deliverable is the ports and edge-creation workflow, which opens the door for routing, keyboard, and collaboration layers. At the end, *Norminette* to ensure proper `\t` and formatting is used - style and structure can be confirmed after all of the heavy lifting is finished.

## Next steps

With interactive ports and connection flows shipped, the focus stays on **Edge routing**. The routing helper now blends straight connectors into quadratic curves, reports curvature metrics, and feeds the React layer so previews and custom renderers can share the same path data. Next up: obstacle-aware experiments before the keyboard and theming layers land.

## Automation roadmap

Agent automation lives alongside the product roadmap. The next three initiatives keep the internal bots aligned with repository needs:

* [x] Promote `docs-bot` from suggestion-only comments to gated pull requests for documentation updates (now ships gated PRs).
* [x] Extend `perf-profiler` with WebGL frame-time capture so large graph scenarios stay within targets (ships `/perf snap`).
* Expand `layout-lab` to benchmark orthogonal versus force-directed routing strategies.

These milestones are tracked in `AGENTS.md` and ensure our tooling evolves in lockstep with the editor experience.

### Perf snapshots

The new **perf-profiler** agent captures a headless Chromium run of the large graph scenario and records frame-time metrics. It runs automatically on pushes to `main` and can be invoked on pull requests by commenting `/perf snap`. The workflow uploads a JSON payload and Markdown summary under `agents/artifacts/perf/<timestamp>/`, making it easy to track regressions over time.

For local validation run:

```bash
npm run agents:perf
```

This executes `agents/scripts/run_perf_profiler.mjs`, which bundles the configured scenario, launches Playwright, and enforces the average and 95th percentile frame budgets declared by the scenario fixture.

## Contributing

The project enforces tabs for indentation and snake_case naming, following the conventions described in the roadmap. Contributions should include tests and adhere to the linting configuration.

