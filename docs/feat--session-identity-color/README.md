# Session Identity — why auto-rename & color don't land

**Date:** 2026-06-22 · **CC:** 2.1.185 · **Data:** 687 real sessions since 2026-06-12
**Playground:** [`session-identity-playground.html`](./session-identity-playground.html) — interactive: replay a real session, toggle *Today* vs *Fix*.

## TL;DR

The haiku titler **works** — it produces a valid name 81% of the time. The feature fails on
**delivery timing**, not generation. Only **7.3%** of sessions ever wear their AI title, and color
was never live-settable from a hook at all.

## The funnel (real, global)

| stage | count | % |
|---|---:|---:|
| generator spawned | 687 | 100% |
| haiku returned a valid `{title}` | 556 | 81% |
| hard-failed "Prompt is too long" | 86 | 13% |
| **title adopted into the session** | **50** | **7.3%** |
| color record persisted (resume only) | 70 / 1835 transcripts | 3.8% |

## Root causes

### RC1 — Harvest-miss (dominant; 506 good titles thrown away)
Architecture is *spawn on turn 1, **pull** the result on the **next** UserPromptSubmit*. The detached
haiku child finishes ~1–2s later, async. Most sessions never submit another prompt in that window
(single-turn or the session ends), so the title sits in `session-identity.raw` and is never adopted.
**Verified:** 556 `.raw` files hold a valid title, only 50 reached `.json`. The 50 wins were
multi-turn-lucky.

### RC2 — Context blowout (86 hard-fails)
The child `claude -p --model haiku` inherits the **project cwd**, so it loads `.mcp.json` (8 MCP
servers) + 111 skills + 37 agents into its *own* system prompt → ~213K tokens > the 200K limit.
Real error, verbatim, in 86 raw files:
> Prompt is too long · the request is ~213742 tokens (limit 200000) but this conversation is only
> ~18254 tokens — the rest is system prompt, tool definitions, and attachment content.

`--settings '{"disableAllHooks":true}'` disables **hooks**, not MCP/skills/agents.

### RC3 — Color is live-impossible (structural, not a bug)
CC hooks accept only `additionalContext` / `sessionTitle` / `suppressOriginalPrompt`. There is **no
hook field for color** (confirmed against docs + the 2.1.175 schema, still true on 2.1.185). The
`agent-color` jsonl append only shows in `/resume` + `claude agents`, never the live bar. Persistence
also only hit 3.8% (transcript-path resolution + early-ending sessions).

## Fix options

| RC | fix | cost | effect |
|---|---|---|---|
| RC2 | spawn child in `os.tmpdir()` + `--strict-mcp-config --mcp-config '{}'` | low | kills the 13% hard-fail; child → <2K tokens, ~1–2s |
| RC1 | **A:** bounded inline wait (≤2s, fail-open) on turn 1 → emit `sessionTitle` same turn. **B:** harvest in the `Stop` hook to pre-stage. Keep lazy pull as fallback. | A adds ≤2s to 1st prompt | 7% → ~80% adoption |
| RC3 | prefix a semantic emoji (🔴 fix · 🟢 feat · 🔵 docs · 🟣 infra) onto the title for a **live** color signal; keep `agent-color` append for the picker; fix path resolution | low | honest — live accent stays CC-owned |

**Recommended:** RC2 + RC1-A + RC3 together. RC2 is the prerequisite (makes the child cheap enough
that the inline wait is viable).

## Implemented (2026-06-22)

All three root causes fixed in `src/hooks/src/lib/session-identity{,-state}.ts` + the
prompt dispatcher, plus the color-fidelity follow-ups:

- **RC2** — child spawned in `tmpdir()` with `--strict-mcp-config --mcp-config
  '{"mcpServers":{}}' --disable-slash-commands --settings '{...,"enabledPlugins":{}}'`.
  Verified: child returns clean JSON in ~6-7s vs the old `"Prompt is too long"`.
- **RC1** — opt-in inline wait `ORK_SESSION_IDENTITY_WAIT_MS` (default 0/off; 6-7s is too
  slow to block every first prompt). With the cheap child, the lazy next-turn pull now
  succeeds reliably for multi-turn sessions.
- **RC3** — color carried as a semantic emoji prefix on the title (the one live channel
  hooks own). Glyphs read clearly as their color: 🔴🔵🟢🟡🟣🟠 + 💗 (pink) / 💠 (cyan),
  all Unicode 6.0 for max terminal support.
- **Accuracy** — the generator now classifies the work into a **category**
  (bugfix/feature/docs/refactor/infra/perf/design/testing) and code maps category → color
  deterministically, so colors are meaningful instead of an arbitrary model pick.
- **Bug fix** — `'unknown'` (git's branch-detection fallback) no longer leaks into the
  title as a `· unknown` suffix (you spotted this in the wild).

### Live status-bar color (`ork-session-color.sh`)

Hooks can't paint the live bar, **but** the statusline can: CC's statusline JSON has no
color field, yet it provides `transcript_path` — so [`ork-session-color.sh`](./ork-session-color.sh)
reads the last `agent-color` record we write and emits an ANSI color dot. It tracks the
session color from the first prompt (hash color) and upgrades to the category color once
haiku lands. Wire it in `~/.claude/settings.json`:

```jsonc
// Wrap your existing statusline (keep claude-hud, just prepend the dot):
"statusLine": { "type": "command",
  "command": "/ABS/PATH/ork-session-color.sh -- claude-hud" }
```

Tested: standalone + wrap modes, fail-open when no record, shellcheck-clean.

## Source

- `src/hooks/src/lib/session-identity.ts` — palette, haiku spawn, parse, title merge
- `src/hooks/src/lib/session-identity-state.ts` — per-session lifecycle, color append
- `src/hooks/src/prompt/unified-dispatcher.ts:408–411` — wires `manageSessionIdentity → sessionTitle`
- data: `~/.claude/plugins/data/ork-orchestkit/sessions/*/session-identity.{raw,json,failed,color}`
