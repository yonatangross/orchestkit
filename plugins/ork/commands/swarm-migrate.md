---
description: "Cross-repo migration swarm — one coordinator + N parallel subagents (one per target repo) that apply the same transformation, open PRs, wait for CI, and report back to a shared JSON ledger. Coordinator handles topology, conflict auto-rebase, and stop-on-novel-failure. Use when bumping a shared dependency, rolling out a workflow change, or applying a codemod across the org. Do NOT use for single-repo work — that's /ork:implement."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Agent, Task, TaskCreate, TaskUpdate, TaskStop, ToolSearch, Monitor]
---

# Auto-generated from skills/swarm-migrate/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# /ork:swarm-migrate — Cross-Repo Migration Swarm

One command, N repos, one coordinator, one ledger.

## When to use

Use when the same transformation needs to land in **3 or more repos** with the same shape (workflow bump, dependency upgrade, codemod, lint-rule introduction, secret rotation, runbook header). Don't use for one-repo work — that's `/ork:implement`. Don't use for novel exploration — that's `/ork:brainstorm`.

This skill exists because the 275-session insights showed **25 sessions burned coordinating PR cascades manually** (M164 deploy-migration, M17 yg-mcp-core extraction, @v1 reusable workflow rollout across 14 repos). The pattern was always: pick a repo, branch, apply, push, watch CI, repeat. This automates the repeat.

> **vs CC `/workflows` (2.1.154):** CC's dynamic workflows orchestrate tens-to-hundreds of agents in the *background* and report via `/workflows`. `swarm-migrate` is different on purpose: it's a **coordinator-led, foreground DAG** with CI gates, conflict auto-rebase, and stop-on-novel-failure — you watch it and it stops on the first unexpected failure. Reach for CC `/workflows` when you want large-scale fire-and-forget background fan-out; reach for `swarm-migrate` when each step needs a CI gate and a human-visible ledger.

## Inputs

A YAML spec at `swarm-specs/<name>.yaml`:

```yaml
name: bump-actions-checkout-v4
description: "Pin @actions/checkout to v4 across all repos"

# Topology — repos in dependency order. Coordinator only proceeds
# to a downstream repo after every upstream parent has merged green.
repos:
  - path: ~/coding/yonatan-hq/platform
    upstream: []
  - path: ~/coding/yonatan-hq/ventures/jobscraper
    upstream: [platform]   # waits for platform to merge first

# Transformation — applied identically per repo. The agent runs this
# inside the isolated worktree, then verifies with the next field.
transform:
  type: codemod              # codemod | regex | command
  command: |
    grep -rl 'actions/checkout@v3' .github/workflows | \
      xargs sed -i '' 's|actions/checkout@v3|actions/checkout@v4|g'

# Verification — must pass before PR opens. Coordinator skips the repo
# if it fails locally (records skip-reason in ledger).
verify:
  - command: "git diff --quiet"
    expect: nonzero            # must have changes
  - command: "grep -r 'actions/checkout@v3' .github/workflows"
    expect: nonzero            # zero matches = clean

# PR shape — title, body, base branch
pr:
  branch_prefix: chore/bump-checkout-v4
  title: "chore(ci): pin @actions/checkout to v4"
  body_file: swarm-specs/bump-actions-checkout-v4.pr.md
  base: main
  labels: [chore, ci]

# CI gate — coordinator waits for required checks to pass before
# moving downstream. Set to false for dry-run, or in repos without CI.
ci_gate:
  required_checks: ["build", "test"]
  timeout_minutes: 20
  on_failure: pause            # pause | skip | abort

# Limits
max_parallel: 4
abort_on_novel_failure: true
```

## How it works

```
                    ┌──────────────────────────────────┐
                    │      COORDINATOR (you)           │
                    │  reads spec → builds DAG →       │
                    │  writes .swarm-state.json        │
                    └────────────┬─────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌──────────┐       ┌──────────┐       ┌──────────┐
        │ WORKER A │       │ WORKER B │       │ WORKER C │
        │ (repo 1) │       │ (repo 2) │       │ (repo 3) │
        └────┬─────┘       └────┬─────┘       └────┬─────┘
             │                  │                  │
             └─────────── isolated worktrees ──────┘
             │ each: clone branch, transform,
             │       verify, push, open PR,
             │       wait for CI, report
             ▼
        ┌─────────────────────────────────────────────┐
        │            .swarm-state.json                │
        │  rolling ledger of {repo, status,           │
        │  pr_url, ci_state, last_action_at}          │
        └─────────────────────────────────────────────┘
```

Each worker is a `Agent` tool invocation (subagent type `git-operations-engineer` for plumbing or `backend-system-architect` for schema-flavored migrations). The coordinator (you, this skill) reads the ledger between waves and decides whether to release downstream waves or pause.

## Phase 1 — Spec validation

Load `<spec-file.yaml>`. Verify:

- Every `repos[].path` exists and is a git repo (use `git -C <path> rev-parse` checks).
- The `transform.command` returns 0 in a dry-run mode (or `transform.type: codemod` resolves to a known codemod registered in `swarm-specs/codemods/`).
- Every `upstream` reference points to a declared repo (no dangling deps).
- `pr.body_file` exists and is non-empty.

If any check fails, abort and print the table of failures. Do NOT proceed.

## Phase 2 — Topology sort

Build a DAG from `upstream` edges. Detect cycles → abort. Group nodes by topological wave (wave 0 = no deps, wave 1 = depends only on wave 0, …). Coordinator releases one wave at a time.

Write `.swarm-state.json` at the repo root running the skill:

```json
{
  "spec": "swarm-specs/bump-actions-checkout-v4.yaml",
  "started_at": "2026-05-16T17:00:00Z",
  "waves": [
    { "id": 0, "repos": ["platform"] },
    { "id": 1, "repos": ["jobscraper"] }
  ],
  "repos": {
    "platform": { "status": "pending", "pr_url": null, "ci_state": null, "last_action_at": null },
    "jobscraper": { "status": "blocked", "blocked_on": ["platform"], "pr_url": null }
  }
}
```

## Phase 3 — Dispatch wave

For each repo in the current wave, in parallel (bounded by `max_parallel`):

1. **Worktree** — create an isolated worktree at `<repo>/../<repo>-swarm-<spec-name>` off `origin/<base>`. Never mutate the live working tree.
2. **Branch** — `git checkout -b <branch_prefix>-<short-sha>`.
3. **Transform** — run `transform.command` (or apply codemod). Capture stdout to `.swarm-logs/<repo>-transform.log`.
4. **Verify** — run each `verify[].command`, assert exit matches `expect`. On mismatch, mark repo `skipped` in ledger with reason, do not push.
5. **Push + PR** — push branch, open PR via `gh pr create`. Update ledger with PR URL.
6. **Watch CI** — poll `gh pr checks <n>` every 45s up to `ci_gate.timeout_minutes`. Update `ci_state` in ledger on every state transition.

Use the `Agent` tool with `subagent_type: ork:git-operations-engineer` for steps 1–5 to keep main context lean. The coordinator only reads the ledger.

## Phase 4 — Wave gate

After every wave, check the ledger:

- All `green` → release the next wave.
- Any `pending CI` → keep polling.
- Any `red CI` → consult `ci_gate.on_failure`:
  - `pause` → halt the swarm, write a summary to `.swarm-state.json`, surface the failing logs, ask the user.
  - `skip` → mark repo `failed-ci`, continue with siblings (but **block downstream** unless they explicitly don't depend on this repo).
  - `abort` → terminate the swarm, leave open PRs as-is, never merge.

## Phase 5 — Auto-rebase on conflicts

If a downstream repo's worker hits a merge conflict on rebase (because an upstream merged), the worker:

1. Re-fetches the upstream's merge commit SHA.
2. Attempts `git rebase origin/<base>`. If clean → push, ledger update.
3. If conflicts → mark the conflict files in the ledger, do NOT auto-resolve, surface to the coordinator. Conflicts are the most common place auto-fixers ship broken code.

## Phase 6 — Final report

When all waves complete (or the swarm pauses/aborts), emit a single markdown report under `.swarm-logs/<spec-name>-report.md`:

```markdown
# Swarm report: bump-actions-checkout-v4

Completed: 12/14 repos · paused: 2 · duration: 47 min

| repo            | status  | PR    | CI     | duration |
|-----------------|---------|-------|--------|----------|
| platform        | merged  | #3456 | green  | 8 min    |
| jobscraper      | merged  | #281  | green  | 6 min    |
| ...                                                       |
| dormant-repo-1  | skipped | —     | —      | (no CI runner configured) |
| trading-ai      | paused  | #99   | red    | (novel failure — see logs) |

## Novel failures (escalated)
- trading-ai #99: pyproject lockfile mismatch — see .swarm-logs/trading-ai-ci.log
```

## Hard rules

- **Never** merge a PR. The swarm opens PRs; humans merge them. Auto-merge can be armed by the user with `gh pr merge --auto` post-swarm if they want.
- **Never** force-push. If a worker can't fast-forward, it pauses.
- **Never** roam outside the spec's declared `repos[]`. Even if a transformation seems like it'd help elsewhere.
- **Always** quarantine credentials. Workers run with the user's gh auth; the coordinator never logs tokens, just the URLs.
- **Always** respect existing branch protections. If `gh pr create` fails because of required reviewers or other rules, that's a feature, not a bug to work around.

## Failure modes you'll actually hit

| Mode | What it looks like | Mitigation |
|------|--------------------|------------|
| Stale lockfile | CI red on `npm ci` after dependency bump | Spec includes a `post_transform.command: npm install` step |
| Branch protection blocks PR creation | `gh pr create` exits non-zero | Coordinator marks repo `blocked-by-protection`, surfaces to user |
| Topology cycle | Phase 2 abort | Re-spec the upstream edges |
| Coordinator crash mid-flight | `.swarm-state.json` half-written | Skill is resumable: re-run with same spec, it reads the ledger and skips `merged`/`green` repos |
| Worker subagent hangs | No ledger update for >5 min | Coordinator times out the agent, marks repo `worker-timeout`, surfaces logs |

## Related Skills

- **Upstream** — `/ork:brainstorm` to design the spec, `/ork:visualize-plan` to ASCII-preview the DAG before dispatch.
- **Downstream** — `/ork:verify` per repo after merge, `/status` for org-wide sweep, `/ci-debug` if a worker hits a CI red.
- **Composes with** — `/ork:create-pr` (each worker calls into it), `/ork:github-operations` (bulk-update labels/milestones post-swarm).

## What this skill does NOT do

- Does not invent the spec. You write the spec; the skill executes it.
- Does not perform schema migrations across DBs (use a single-repo skill plus `/ork:database-patterns`).
- Does not orchestrate **production deploys** — open PRs only; deploy is a separate gate (the platform's deploy-operator).
- Does not bypass `/ork:create-pr`'s playground-gate rule — each PR body must include a playground reference if the repo enforces it.

## Example invocation

```bash
# Dry-run: build the DAG, verify spec, do NOT push or open PRs
/ork:swarm-migrate swarm-specs/bump-actions-checkout-v4.yaml --dry-run

# Live: dispatch up to 4 workers in parallel
/ork:swarm-migrate swarm-specs/bump-actions-checkout-v4.yaml --max-parallel=4

# Resume after pause: same command, the ledger remembers
/ork:swarm-migrate swarm-specs/bump-actions-checkout-v4.yaml
```

## Why this exists (one paragraph)

You ran 25 sessions in a single month coordinating cross-repo PRs by hand. The 14-repo @v1 workflow rollout, the M17 yg-mcp-core extraction, the M164 deploy-migration. Every one of those sessions had the same shape: a coordinator (you) holding the DAG in your head, dispatching workers (you, sequentially) in different terminal tabs, hand-rolling a status table in your notes. This skill makes the coordinator a YAML file and the workers parallel subagents. The DAG, the ledger, the auto-rebase, the wave gating — all the bookkeeping you were doing manually — get codified once. You write the spec, you walk away, you come back to a report.
