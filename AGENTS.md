# AGENTS.md — NovaNode

> **Purpose**
> Define how software agents (automation, bots, LLM‑assisted tools) are designed, named, permissioned, tested, and governed in this repository. This file is the single source of truth for agent behavior and contracts.

> **Conventions**
> tabs for indentation; `snake_case` for config keys and variables; `kebab-case` for file names; explicit SemVer; fail‑closed defaults.

---

## 0) Scope & Goals

* Standardize **agent contracts** (what an agent may do, with which inputs/outputs, and under what guardrails).
* Provide **drop‑in templates** for CI agents (GitHub Actions) and offline tools.
* Ensure **reproducibility, provenance, and security** across all automated changes.
* Keep humans in the loop; agents are assistants, not owners.

---

## 1) Glossary

* **Agent**: an automated process (script, Action workflow, or LLM‑assisted tool) with a clearly defined contract.
* **Capability**: a bounded action an agent can perform (e.g., label issues, run layout, open PRs).
* **Guardrail**: a constraint that prevents unsafe or undesired outcomes (e.g., no writes to `src/core/*`).
* **Evidence**: logs, artifacts, or metrics justifying an agent decision (stored under `./agents/artifacts/`).

---

## 2) Architecture Overview

```
(human) ── creates issue/PR ──▶ triage-bot ──▶ labels/assigns
           ▲                                   │
           │                                   ▼
        review ◀──────── docs-bot ── opens PR with doc changes
           │                                   │
           ▼                                   ▼
       release captain ──▶ release-bot ── tags, builds, publishes
           │
           └──▶ layout-lab / perf-profiler (bench, suggest)
```

Agents are **stateless at runtime**; state is stored as artifacts, comments, and PRs. Long‑lived memory (if any) is explicit in `./agents/state/`.

---

## 3) Agent Registry

Registry lives in `./agents/registry.yaml`. Each entry must conform to the **Agent Contract** schema below.

| id              | intent                             | triggers                  | writes                                  | reviewers         |
| --------------- | ---------------------------------- | ------------------------- | --------------------------------------- | ----------------- |
| `triage-bot`    | label & route issues               | issue opened / edited     | labels only                             | `@maintainers`    |
| `docs-bot`      | lint & improve docs                | comment command / nightly | `docs/**`, `*.md`                       | `@docs-owners`    |
| `layout-lab`    | run DAG layout experiments         | `/layout bench` comment   | artifacts, PRs under `examples/**` only | `@graph-owners`   |
| `perf-profiler` | snapshot perf & detect regressions | push to `main`            | artifacts in `agents/artifacts/perf`    | `@perf-owners`    |
| `release-bot`   | tag, build, publish                | manual dispatch           | Git tags, GitHub Releases, npm          | `@release-owners` |

> Add new agents by submitting a PR that updates `registry.yaml` + a new contract file under `agents/contracts/<id>.yaml`.

---

## 4) Agent Contract Schema

Place contracts at `agents/contracts/<agent_id>.yaml`:

```yaml
# agents/contracts/triage-bot.yaml
agent_id: triage-bot
version: 1.0.0
summary: "Labels, deduplicates, and routes new issues via rules."
owners: ["@maintainers"]
triggers:
  - type: github_event
    event: issues
    actions: [opened, edited]
capabilities:
  - label_issue
  - close_as_duplicate
  - comment_with_template
inputs:
  - type: github_issue
  - type: repository_config
outputs:
  - type: github_labels
  - type: github_comment
writes_allowed:
  - path: "(labels-only)"
  - path: "(comments-only)"
forbidden_paths:
  - "src/core/**"
  - "packages/**"
review_policy:
  mode: none   # no PR writes, so no human review required
  rationale: labels/comments are non-destructive
observability:
  metrics: ["issues_labeled_total"]
  logs: "agents/artifacts/triage/logs/%Y-%m-%d.jsonl"
security:
  permissions:
    contents: read
    issues: write
    pull-requests: read
  secrets: []
change_management:
  semver_bump_requires: [owners_approval]
```

**Validation**: Contracts are validated by `pnpm run agents:validate` (see §11).

---

## 5) Rules of Engagement (ROE)

1. **Fail‑closed**: if config is missing or permissions are insufficient, an agent must no‑op.
2. **Least privilege**: request only the GitHub permissions required per contract.
3. **Dry‑run first** for write‑capable agents; attach diffs as artifacts.
4. **Provenance required**: every automated decision includes evidence links.
5. **Human supersedes**: a maintainer can cancel or override any agent via `/agent cancel <id>`.

---

## 6) Naming & Files

* Agents live under `./agents/`:

  * `contracts/` — YAML contracts
  * `workflows/` — GitHub Actions
  * `scripts/` — local tools and runners
  * `artifacts/` — logs, benchmarks, dry‑run patches
  * `state/` — optional long‑lived JSON state (discouraged; prefer derivation)
* File names use `kebab-case`; YAML keys use `snake_case`.

---

## 7) Permissions Map (GitHub Actions)

Grant the least necessary scopes per workflow using the `permissions:` block. Example for a docs PR agent:

```yaml
# .github/workflows/docs-bot.yaml
name: docs-bot
on:
  issue_comment:
    types: [created]
permissions:
  contents: read
  pull-requests: write
  actions: read
jobs:
  run:
    if: contains(github.event.comment.body, '/docs update')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm i
      - run: pnpm run docs:lint
      - name: open PR
        run: node agents/scripts/open_pr_from_changes.mjs "docs-bot" "chore(docs): automated fixes"
```

---

## 8) Communication Protocols

* **Comment Commands** (any maintainer):

  * `/agent help` — list commands
  * `/layout bench` — run layout-lab and attach report
  * `/perf snap` — run perf snapshot on current branch
* **Commit Prefixes** (by agents):

  * `chore(docs-bot): …`
  * `perf(perf-profiler): …`
  * `ci(release-bot): …`
* **PR Title Convention**: `[agent:<id>] <summary>`

---

## 9) LLM‑Assisted Agents (Policy)

* **Model pinning**: record provider/model/hash in artifacts (`model_info.json`).
* **Prompt provenance**: store the exact prompt & input contexts used.
* **No secret exfiltration**: prompts must never include secrets or tokens.
* **License hygiene**: generated code must pass license scanning (e.g., `scancode`).
* **Test gates**: generated/modified code must pass `pnpm test` + typecheck.

Example artifact layout:

```
agents/artifacts/docs-bot/2025-10-06T12-04-31Z/
  patch.diff
  prompt.txt
  model_info.json
  test_results.json
  summary.md
```

---

## 10) Example: layout-lab (NovaNode specific)

Runs DAG layout experiments on sample graphs without touching core logic.

**Contract (excerpt)**

```yaml
agent_id: layout-lab
summary: "Benchmark and visualize DAG layouts for node graphs."
triggers:
  - type: issue_comment
    command: "/layout bench"
writes_allowed:
  - path: "agents/artifacts/layout/**"
  - path: "examples/**"   # via PR only
review_policy:
  mode: pr_required
  reviewers: ["@graph-owners"]
```

**Workflow**

```yaml
# .github/workflows/layout-lab.yaml
name: layout-lab
on:
  issue_comment:
    types: [created]
permissions:
  contents: read
  pull-requests: write
jobs:
  bench:
    if: contains(github.event.comment.body, '/layout bench')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm i
      - run: pnpm run bench:layout --report agents/artifacts/layout/report.html
      - name: upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: layout-report
          path: agents/artifacts/layout
```

---

## 11) Local Dev & Validation

Scripts live in `agents/scripts/`.

```json
// package.json (scripts snippet)
{
	"scripts": {
		"agents:validate": "node agents/scripts/validate_contracts.mjs",
		"agents:dryrun": "node agents/scripts/dry_run.mjs",
		"agents:list": "node agents/scripts/list_registry.mjs"
	}
}
```

**Contract validator (stub)**

```js
// agents/scripts/validate_contracts.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve('agents/contracts');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml'));
for (const f of files) {
	const raw = fs.readFileSync(path.join(dir, f), 'utf8');
	assert(raw.includes('agent_id:'), `missing agent_id in ${f}`);
	assert(raw.includes('triggers:'), `missing triggers in ${f}`);
	assert(raw.includes('writes_allowed:'), `missing writes_allowed in ${f}`);
	console.log('ok', f);
}
```

---

## 12) Security & Secrets

* Store secrets in GitHub **Actions secrets**; never in repo.
* Rotate tokens every 90 days for write‑capable agents.
* For external calls, pin domains; deny wildcards.
* All networked agents must respect our **Outbound Allowlist** in `agents/security/outbound-allowlist.txt`.

---

## 13) Observability

* **Metrics**: expose counters/gauges via workflow summary and artifacts.
* **Logs**: newline‑delimited JSON (`.jsonl`) with timestamps and `agent_id`.
* **Dashboards**: optional—publish metrics to a gist or GH pages.

---

## 14) Change Management

* Update contract `version` on any behavioral change.
* Changelog entry under `CHANGELOG.md` with `### Agents` section.
* Deprecate agents by moving their contract to `agents/deprecated/` with an EOL note.

---

## 15) Adding a New Agent (Checklist)

1. Copy `agents/contracts/_TEMPLATE.yaml` → `<id>.yaml`; fill fields.
2. Create workflow under `.github/workflows/<id>.yaml`; set `permissions` minimally.
3. Add entry to `agents/registry.yaml`.
4. Implement scripts and tests in `agents/scripts/`.
5. Run `pnpm run agents:validate` + dry‑run.
6. Open PR titled `[agent:<id>] initial contract`.

---

## 16) Contract Template

```yaml
# agents/contracts/_TEMPLATE.yaml
agent_id: <kebab-case-id>
version: 0.1.0
summary: "<short description>"
owners: ["@team"]
triggers: []            # github_event / schedule / manual / issue_comment
capabilities: []        # bounded verbs
inputs: []              # declare every input type
outputs: []             # declare every output type
writes_allowed: []      # list of repo paths or resources
forbidden_paths: []
review_policy:
  mode: pr_required | none
  reviewers: []
observability:
  metrics: []
  logs: "agents/artifacts/<id>/logs/%Y-%m-%d.jsonl"
security:
  permissions: {}       # GitHub permission map
  secrets: []           # names of required secrets
change_management:
  semver_bump_requires: []
```

---

## 17) Roadmap

* `docs-bot` suggest mode → PR mode (with gated writes)
* `perf-profiler` WebGL frame‑time capture for large graphs
* `layout-lab` adds orthogonal + force‑directed router comparisons
* `release-bot` integrates Changesets

---

## 18) Human Controls

* `/agent cancel <id>` — cancel a running job
* `/agent escalate <id>` — request owner review
* `/agent dryrun <id>` — force dry‑run output only

> Agents are here to accelerate the work while **staying within their lanes**. If in doubt, they stop and ask.
