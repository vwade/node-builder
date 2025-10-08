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

### Upcoming work

* Benchmark the new routing helper against sample graphs and document how contributors can extend the interaction model.
* Prototype curvature heuristics and visual affordances ahead of the keyboard and theming passes.

The repository currently contains the build and linting scaffold for the TypeScript codebase. Bundles are produced through `tsup`, with linting handled by ESLint's flat config. The public API surface will be expanded incrementally as core features land.

## Getting started

```bash
npm install
npm run build
npm run lint
```

These commands generate the library bundles under `dist/` and run the lint checks. Additional scripts (tests, demo) will be introduced as the implementation progresses.

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

With interactive ports and connection flows shipped, the focus stays on **Edge routing**. The new routing helper blends straight connectors into quadratic curves, while the camera fitting helper ensures the canvas can frame arbitrary graph bounds, clearing the way for curvature heuristics and obstacle-aware experiments before the keyboard and theming layers land.

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

