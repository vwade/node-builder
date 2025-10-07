# NovaNode

NovaNode is an embeddable node-graph editor built with a headless core and pluggable view adapters. The project aims to provide a deterministic command-driven graph engine alongside a React reference implementation.

## Status

### Recent focus

* Bootstrapped the React canvas adapter with pan/zoom, a transform context, and a grid background to visualize graph state.
* Added a selection state module with single and multi-select helpers for nodes and edges, rounding out the core interaction primitives.
* Implemented the core graph state operations and JSON serialization helpers, enabling pure add/remove/move/connect workflows with round-trip persistence.
* Completed the project scaffold and build pipeline, including TypeScript, tsup bundling, and ESLint flat config.
* Added a GitHub Actions workflow that runs linting, build, and tests on every push or pull request against `codex-*` branches.

### Upcoming work

* Implement Node view & dragging interactions on top of the new adapter scaffolding.
* Introduce port targeting and edge creation flows to complete the initial interaction loop.

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
7. [ ] **Node view & dragging** *(in progress — next up)*
8. [ ] Ports & edge creation
9. [ ] Edge routing (straight → quad curve)
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
20. [ ] Release & SemVer

Each task will be tackled sequentially to maintain a stable, testable feature set. The next tangible deliverable is the Node view & dragging milestone, unlocking the subsequent UI-facing work on port interactions.

## Next steps

With the React adapter scaffolded, the next milestone moves to **Node view & dragging** so that nodes can be positioned directly on the canvas. Once dragging is reliable, effort will shift to **Ports & edge creation**, completing the interaction loop outlined in the roadmap.

## Automation roadmap

Agent automation lives alongside the product roadmap. The next three initiatives keep the internal bots aligned with repository needs:

* Promote `docs-bot` from suggestion-only comments to gated pull requests for documentation updates.
* Extend `perf-profiler` with WebGL frame-time capture so large graph scenarios stay within targets.
* Expand `layout-lab` to benchmark orthogonal versus force-directed routing strategies.

These milestones are tracked in `AGENTS.md` and ensure our tooling evolves in lockstep with the editor experience.

## Contributing

The project enforces tabs for indentation and snake_case naming, following the conventions described in the roadmap. Contributions should include tests and adhere to the linting configuration.

