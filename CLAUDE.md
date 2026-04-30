# CLAUDE.md

Essential context for Claude Code when working on OrchestKit.

## Language

Always respond in English. Never Hebrew. No exceptions.

## Tone

No sugarcoat. Failed = failed; blocked = blocked. Rule: `shared/rules/anti-sycophancy.md`.

## Project Overview

**OrchestKit** — Claude Code plugin: **<!--ork:skills-->107<!--/ork--> skills**, **<!--ork:agents-->37<!--/ork--> agents**, **<!--ork:hooks-->186<!--/ork--> hooks** (<!--ork:hooks-global-->118<!--/ork--> global + <!--ork:hooks-agent-->46<!--/ork--> agent-scoped + <!--ork:hooks-skill-->22<!--/ork--> skill-scoped).

**Purpose**: AI-assisted development with built-in best practices, security patterns, and quality gates.

## Directory Structure

```
src/                    ← SOURCE (edit here!)
├── skills/<name>/SKILL.md    # 105 skills (YAML frontmatter + Markdown)
├── agents/<name>.md          # 39 agents (CC 2.1.78 format)
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

## GitHub CLI

- Use `gh api` for milestone assignment — the `--milestone` flag is unreliable with milestone numbers.
- NEVER `gh issue close` — issues close only when a PR merges to main via CI (`Closes #N` in PR body).
- Use `gh issue comment` for progress updates, not close/reopen.

## Plugin Architecture

Single plugin `ork`: <!--ork:skills-->107<!--/ork--> skills, <!--ork:agents-->37<!--/ork--> agents, <!--ork:hooks-->186<!--/ork--> hooks (<!--ork:hooks-global-->118<!--/ork--> global + <!--ork:hooks-agent-->46<!--/ork--> agent-scoped + <!--ork:hooks-skill-->22<!--/ork--> skill-scoped). <!--ork:invocable-->27<!--/ork--> user-invocable via `/ork:skillname`.

## Background Monitors (CC 2.1.105+)

Background monitors live in `src/monitors/monitors.json` and are auto-armed on session start for every install. Each entry runs as a long-lived shell process on the user's machine — handle with care.

**Authoring rules:**
- **Lower bound**: each polling loop must `sleep` ≥ 60s (preferably 300s+). No tight loops.
- **Idempotent**: emit only when state actually changed since the previous poll (debounce). Don't nag-spam.
- **Quick polls**: each iteration must complete in < 100ms of CPU. No heavy I/O, no network calls.
- **Bounded output**: 1-2 lines max per emit. Long output floods the conversation context.
- **No secrets**: never echo env vars, file contents, or git output that may contain tokens.
- **No state mutation**: read-only. A monitor that writes files is a hook, not a monitor — move it.

After editing `src/monitors/monitors.json`, run `npm run build` — the build script copies it to `plugins/ork/monitors/` and synthesizes the `monitors` key into `plugins/ork/.claude-plugin/plugin.json`. The source-of-truth `monitors` key is also declared in `manifests/ork.json`.

## Version

- **Current**: 7.77.0 · **Claude Code**: >= 2.1.118 <!-- x-release-please-version -->

See `CHANGELOG.md` for history. See `src/hooks/README.md` for hook architecture.
