# NovaNode

NovaNode is an embeddable node-graph editor built with a headless core and pluggable view adapters. The project aims to provide a deterministic command-driven graph engine alongside a React reference implementation.

## Status

### Recent focus

* Completed the project scaffold and build pipeline, including TypeScript, tsup bundling, and ESLint flat config.
* Added a GitHub Actions workflow that runs linting, build, and tests on every push or pull request against `codex-*` branches.

### Upcoming work

* Implement graph state operations in `src/core/graph.ts`, building on the new core types and id generator.

### Upcoming work

* Implement `src/core/types.ts` and `src/core/id.ts` to define the core graph schema and deterministic id generator.
* Follow up with graph state operations (`src/core/graph.ts`) once the foundational types are in place.

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

The roadmap follows the zero-shot sequence outlined for NovaNode:

1. Project scaffold & build (complete)
2. Core types & id generator
3. Graph state & operations
4. Command stack & history
5. Selection model
6. React adapter bootstrap
7. Node view & dragging
8. Ports & edge creation
9. Edge routing (straight → quad curve)
10. Keyboard layer
11. Theme tokens & CSS
12. Import/Export API
13. Minimap plugin
14. Auto-layout plugin (DAG)
15. Group nodes & comments
16. Clipboard & duplicate
17. Accessibility & ARIA pass
18. Performance pass
19. Docs & Storybook
20. Release & SemVer

Each task will be tackled sequentially to maintain a stable, testable feature set.

## Next steps

The immediate focus is implementing **Graph state & operations** in `src/core/graph.ts`, building on the newly landed schema and id generator. Once the core mutation helpers are in place, the roadmap proceeds to **Command stack & history** followed by **Selection model**, enabling richer interaction layers for the React adapter.
The immediate focus is implementing **Core types & id generator**, delivering `src/core/types.ts` and `src/core/id.ts` with accompanying unit tests. Subsequent work will build on these primitives to power the graph operations and command stack. After those land, the roadmap continues with **Graph state & operations**, expanding the core mutation surface needed by the React adapter.

## Contributing

The project enforces tabs for indentation and snake_case naming, following the conventions described in the roadmap. Contributions should include tests and adhere to the linting configuration.

