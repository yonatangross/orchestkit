# CLAUDE.md

Essential context for Claude Code when working on OrchestKit.

## Language

Always respond in English. Never Hebrew. No exceptions.

## Project Overview

**OrchestKit** — Claude Code plugin: **<!--ork:skills-->103<!--/ork--> skills**, **<!--ork:agents-->36<!--/ork--> agents**, **<!--ork:hooks-->173<!--/ork--> hooks** (<!--ork:hooks-global-->106<!--/ork--> global + <!--ork:hooks-agent-->45<!--/ork--> agent-scoped + <!--ork:hooks-skill-->22<!--/ork--> skill-scoped).

**Purpose**: AI-assisted development with built-in best practices, security patterns, and quality gates.

## Directory Structure

```
src/                    ← SOURCE (edit here!)
├── skills/<name>/SKILL.md    # 103 skills (YAML frontmatter + Markdown)
├── agents/<name>.md          # 36 agents (CC 2.1.78 format)
├── settings/<plugin>.settings.json  # Plugin settings (permissions, keybindings)
└── hooks/                    # TypeScript hooks (hooks.json + src/ + dist/)
manifests/                    # Plugin definitions (JSON)
plugins/                      # GENERATED (never edit!)
scripts/build-plugins.sh      # Assembles plugins/ from src/
```

**Key rule**: Edit `src/` and `manifests/`, NEVER edit `plugins/`.

**Build note**: `plugins/` diffs after `npm run build` are expected — always stage them alongside `src/` changes. If `plugins/` is empty, the build was interrupted — run `npm run build` again.

## Commands

```bash
npm run build              # Build plugins from source (required after editing src/)
npm test                   # Run all tests (lint + unit + security + integration + e2e)
npm test --quick           # Fast: skip integration/e2e/performance
npm run test:skills        # Skill structure validation
npm run test:agents        # Agent frontmatter validation
npm run test:security      # Security tests (MUST pass)
npm run test:manifests     # Manifest consistency (counts, deps, ordering)
npm run typecheck          # TypeScript type checking for hooks
cd src/hooks && npm run build    # Compile TypeScript hooks
```

## Adding Components

**Skill**: See `src/skills/CONTRIBUTING-SKILLS.md` for full authoring standards. Create `src/skills/my-skill/SKILL.md` with YAML frontmatter (`name`, `description`, `tags`, `user-invocable`, `complexity`). SKILL.md body must stay under 500 lines. Add to `manifests/ork.json`, run `npm run build`.

**Agent**: Create `src/agents/my-agent.md` with frontmatter (`name`, `description`, `model`, `tools`, `skills`). Add `background: true` for agents that never need interactive results. Add to manifest, rebuild.

**Hook**: Create `src/hooks/src/<category>/my-hook.ts`, register in `src/hooks/hooks.json`, rebuild with `cd src/hooks && npm run build`. After adding/removing hooks, update the count in `hooks.json` description field and in the Version section below — these must stay in sync.

## Critical Rules

**DO**: Edit `src/`, run `npm run build`, commit to feature branches, use TaskCreate for 3+ step work.

**DON'T**: Edit `plugins/`, commit to `main`/`dev` directly, skip security tests, bypass hooks with `--no-verify`, commit secrets.

**Before committing**:
1. `npm test` — all suites must pass
2. `npm run test:security` — MUST pass (blocks push)
3. `npm run typecheck` — if hooks were changed
4. `git diff` — verify changes are real, not no-ops or stale from a previous session

## Session Resilience

Commit after each logical unit of work — never batch all commits to end of session. Rate limits can kill a session at any time. If build/test fails mid-session, commit the passing work first, then fix the failure separately.

## Long Chains on Max + Opus 4.7 (CC 2.1.111+)

- **Auto mode**: no `--enable-auto-mode` flag required on Max + Opus 4.7. Useful for `ork:implement` and long `/loop` chains where you don't want to approve every tool call. Off by default; enable via `/config` when you've reviewed the impact.
- **Scheduled task resurrection (CC 2.1.110+)**: `--resume` / `--continue` now resurrects unexpired `ScheduleWakeup` / `CronCreate` tasks alongside session history. `/loop` runs survive idle periods without manual re-scheduling.
- **Task budgets (public beta)**: Opus 4.7 exposes per-task token budgets to guide long-horizon spending. OrchestKit skills don't wire to the CC API yet; `ork:implement` and `/loop` emit advisory `budget_remaining_pct` in `.claude/chain/state.json` handoffs instead. Use it to self-throttle when the model is working for hours unattended.
- **Filesystem memory**: Opus 4.7 reads `memory/*.md` and `.claude/chain/*.json` more reliably than 4.6. Prefer fs-backed handoff state for long chains; the model will read it on resume.

## GitHub CLI

- Use `gh api` for milestone assignment — the `--milestone` flag is unreliable with milestone numbers.
- NEVER `gh issue close` — issues close only when a PR merges to main via CI (`Closes #N` in PR body).
- Use `gh issue comment` for progress updates, not close/reopen.

## Plugin Architecture

Single plugin `ork`: <!--ork:skills-->103<!--/ork--> skills, <!--ork:agents-->36<!--/ork--> agents, <!--ork:hooks-->173<!--/ork--> hooks (<!--ork:hooks-global-->106<!--/ork--> global + <!--ork:hooks-agent-->45<!--/ork--> agent-scoped + <!--ork:hooks-skill-->22<!--/ork--> skill-scoped). <!--ork:invocable-->23<!--/ork--> user-invocable via `/ork:skillname`.

## Version

- **Current**: 7.49.0 · **Claude Code**: >= 2.1.111 <!-- x-release-please-version -->

See `CHANGELOG.md` for history. See `src/hooks/README.md` for hook architecture.
