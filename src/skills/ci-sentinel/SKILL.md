---
name: ci-sentinel
license: MIT
compatibility: "Claude Code 2.1.81+ (uses --bare mode for budget-predictable headless runs)."
description: "Hourly autonomous classifier for failing PRs across your repos. Runs /ci-debug headless against every open PR with red required checks, posts the verdict as a collapsed PR comment, and appends to a per-repo .sentinel/ledger.jsonl. v1 is propose-don't-apply — NEVER auto-pushes a fix. Use when you're tired of /status sweeps catching the same 10 CI failure patterns over and over."
argument-hint: "[install|status|enable|disable]"
context: fork
version: 0.1.0
disable-model-invocation: true
author: OrchestKit
tags: [ci, sentinel, automation, github-actions, propose-dont-apply, autonomous]
user-invocable: true
allowed-tools: [Bash, Read, Write, Edit, Grep, Glob]
skills: [github-operations, ci-debug, memory]
complexity: medium
persuasion-type: guidance
model: sonnet
metadata:
  category: workflow-automation
triggers:
  keywords: [sentinel, "self-healing ci", "auto-classify failures", "watch open PRs"]
  examples:
    - "install the CI sentinel in this repo"
    - "show me sentinel status for the platform repo"
    - "disable the sentinel — it's commenting too much"
  anti-triggers: [fix this CI, debug this run]
paths:
  - ".github/workflows/ci-sentinel.yml"
  - ".sentinel/**"
---

# /ork:ci-sentinel — Hourly autonomous CI classifier

Direct response to the 275-session insights audit (2026-05-16): 14 ci-debugging + 7 fix-ci-failures sessions in one month, most of them re-running the same 10-pattern classification you already encoded in `/ci-debug`. This skill makes the classifier autonomous.

## What it does

```
   ⏰ hourly cron (:17)
        │
        ▼
   📥 gh pr list → PRs with FAILURE checks (yours, max 10)
        │
        ▼
   🤖 for each PR (skipping those already commented at this SHA):
       claude -p --bare → run /ci-debug → capture verdict markdown
        │
        ▼
   💬 post collapsed PR comment with marker so future runs dedupe
        │
        ▼
   📜 append { ts, pr, sha, tokens } to .sentinel/ledger.jsonl
        │
        ▼
   💰 if daily token spend > ORK_SENTINEL_DAILY_TOKEN_BUDGET → pause
```

## What it does NOT do (v1)

- **NEVER pushes a fix.** Even for a 100%-confidence lockfile-drift match, v1 only **proposes** in a PR comment. Auto-push is a v2 question, gated on a quarter of false-positive-free operation.
- **Does not page.** Novel failures get a `🆕` flag in the comment; you find them on your normal status sweep, not via a notification storm.
- **Does not analyze closed/merged PRs.**
- **Does not roam outside the repo it's installed in.** This is per-repo by design. Org-wide sweep is a different shape — that's what `/status` is for.

## Why it's safe to run hourly

| Risk | Mitigation |
|---|---|
| Token cost runaway | `ORK_SENTINEL_DAILY_TOKEN_BUDGET=500000` ceiling, enforced by the workflow's first step. Resets daily. |
| Duplicate comments on the same SHA | Marker `<!-- ork:ci-sentinel sha=<short> -->` on every comment; workflow scans existing comments before posting. |
| Wrong-classification spam | Propose-don't-apply means the worst outcome is a noisy but accurate-looking comment. You can collapse them; you can't unmerge a bad auto-fix. |
| Stuck PR keeps re-classifying | Idempotent on SHA — only re-runs if you push new commits. |
| Sentinel itself breaking CI | Runs on `ubuntu-latest`, no `pull_request` trigger, no `push` trigger. Cannot block any other workflow. |

## Install on a new repo

1. Copy `.github/workflows/ci-sentinel.yml` from the OrchestKit repo into the target repo (this skill ships it).
2. Add the `ANTHROPIC_API_KEY` secret to the repo (Settings → Secrets and variables → Actions).
3. (Optional) Adjust `ORK_SENTINEL_DAILY_TOKEN_BUDGET` env in the workflow.
4. Trigger a manual run with `inputs.dry_run = true` to validate the wiring.
5. Once a dry-run posts no comments and looks healthy in the job summary, let the hourly cron take over.

## Configuration

The workflow is intentionally configured via in-file env vars (not workflow inputs) so a fork stays self-contained:

| Var | Default | Meaning |
|---|---|---|
| `ORK_SENTINEL_DAILY_TOKEN_BUDGET` | `500000` | Hard daily ceiling. Hour-of-day not enforced; calendar day in UTC. |
| `ORK_SENTINEL_PER_PR_TIMEOUT_S` | `300` | Per-PR wall-clock cap on the `claude -p --bare` invocation. |
| `max_prs` (workflow_dispatch input) | `10` | Cap on PRs analyzed in one sweep. |
| `dry_run` (workflow_dispatch input) | `false` | Skip comment posting (for spec validation). |

## Comment shape

Every verdict comment looks like:

```
<!-- ork:ci-sentinel sha=abc123def -->

<details><summary>🛰️ <b>CI Sentinel verdict</b> (sha abc123def)</summary>

## CI Debug: <repo> · #<n>

**Failing job:** ...
**Classification:** Pattern #N — <name>
**Reference:** memory <file.md>
**Proposed fix:** ...

</details>
```

Collapsed by default — no inbox noise unless you click. Always carries the SHA so you know whether the verdict is still current.

## Mutation journal (deferred to v1.1)

The insights audit's horizon-#1 design called for a CI_PLAYBOOK.md the sentinel mutates after each human-driven novel-failure fix. v1 doesn't write to the playbook — it just appends classification rows to `.sentinel/ledger.jsonl`. The playbook lives in `/ci-debug`'s SKILL.md and stays human-curated for v1.

When v1.1 lands the journal:
1. After a fix-PR merges, the sentinel diff-checks the PR title against existing patterns.
2. If novel, it opens a follow-up issue suggesting the pattern be added to `/ci-debug` SKILL.md.
3. Human approves the pattern in a PR; sentinel picks it up next sweep.

## Cost model (back-of-envelope)

Per-PR analysis: ~3-5k tokens (gh CLI output + classification turn).
Hourly sweep with avg 3 failing PRs: ~12k tokens/hour = ~290k/day.
Daily budget 500k tokens = safe headroom for spikes.

At ~$15/MTok (Sonnet input/output blended), that's roughly **$4-5/month per repo** before any auto-fix saves a session. Compared to 21 manual ci-debug sessions/month — each costing 10-20 minutes of your time — payback is immediate.

## Related Skills

- **Upstream** — `/ci-debug` does the classification (sentinel is the trigger).
- **Composes with** — `/ork:swarm-migrate` (after sentinel diagnoses, you might fix-and-swarm across repos), `/status` (sentinel doesn't replace org-wide sweeps).
- **Anti-pattern** — `/loop /ci-debug` in your own session is the manual analog; ship the sentinel and unplug from that.

## When to invoke this skill (not the cron)

- **`/ork:ci-sentinel install`** — copy the workflow into a new repo + check secrets.
- **`/ork:ci-sentinel status`** — read `.sentinel/ledger.jsonl` and summarize the last 24h.
- **`/ork:ci-sentinel enable`** / **`disable`** — toggle the workflow's `on.schedule` block.

The hourly run itself does **not** invoke this skill — the workflow calls `claude -p --bare` against `/ci-debug` directly. This skill is for the human admin actions around the sentinel.

## Why this design wins (one paragraph)

You already have 10 encoded CI failure patterns in `/ci-debug` and 632 ScheduleWakeup invocations in your history — you trust async, and you trust pattern-matched classifications when they cite the memory entry. The CI sentinel is composition, not invention: a GitHub Actions cron triggers headless `/ci-debug` against every open red PR, posts a collapsed verdict, and respects propose-don't-apply. Worst case is a noisy comment. Best case is 21 sessions/month of recurring CI archaeology reclaimed. Build effort: hours. Payback: immediate.
