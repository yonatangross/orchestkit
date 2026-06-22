# Storage Patterns: Rolling Logbook vs Index-Per-Entry

When a skill (or a project's `.claude/rules/*.md` files) needs to accumulate state across sessions — decisions, observations, patterns, knowledge — there are two storage patterns. Pick wrong and Claude Code's 40k-char auto-load threshold ambushes you 3-6 months later.

> **Critical: `.claude/rules/**` is auto-loaded RECURSIVELY.** CC globs the rules directory recursively — every `*.md` at any depth (`.claude/rules/decisions/2026-04-15-postgres.md` included) loads into every `<system-reminder>`. Splitting a rolling file into per-entry files *inside* `.claude/rules/` therefore **multiplies** the loaded surface instead of cutting it. Per-entry files must live **outside** `.claude/rules/` (e.g. `docs/decisions/`); keep only a slim index in `.claude/rules/`. This is the #1 mistake — see #2589.

## TL;DR

| Need | Use |
|---|---|
| Append-only, < 30k chars total expected lifetime | **Rolling logbook** |
| Append-forever, no natural upper bound | **Index-per-entry** |
| Reads are chronological narrative | **Rolling logbook** |
| Reads are by-key or by-date lookup | **Index-per-entry** |
| Each entry independently meaningful | **Index-per-entry** |

If unsure, default to **index-per-entry** — bounded by construction (with entries stored **outside** `.claude/rules/`).

## Pattern 1 — Rolling Logbook

Single Markdown file appended forever.

```
.claude/rules/recent-decisions.md
  # Recent Project Decisions
  ## 2026-04-15 — Use Postgres not MongoDB
  ## 2026-04-22 — Brainstorm: dual-write
  ## ... (one entry every week, no upper bound)
```

**Strengths**
- Trivial to write: `>> file.md` and you're done
- Operator-readable as chronological narrative
- One file means one place to check in / out of cache
- Diffs cleanly in PRs (additions only)

**Weaknesses**
- **Grows unbounded.** No mechanism stops you at any size.
- **CC auto-loads everything** under `.claude/rules/**` into every `<system-reminder>`. At 40,000 chars CC emits a yellow warning, but by then you've burned that context on every prompt for weeks.
- Stale entries pollute the loaded context (Q1 2024 decisions for a Q4 2026 session — irrelevant but billed).
- Recursive search/replace breaks (one wrong-line edit corrupts a 30k file).

**Concrete failure case**: `yonatan-hq/platform/.claude/rules/recent-decisions.md` ballooned to 53.8k chars in seven months. CC flagged it as "Large file will impact performance" — every session paid ~14k extra context tokens before the operator noticed.

## Pattern 2 — Index-Per-Entry

One small index file *inside* `.claude/rules/` (one bullet per entry); individual entries live **outside** the auto-load zone (e.g. `docs/decisions/`) and are loaded on-demand via `Read`.

```
.claude/rules/                            ←  auto-loaded RECURSIVELY by CC
└── decisions-index.md                    ←  ≤ 200 lines, the ONLY decisions file that loads
    - [Use Postgres not MongoDB](../../docs/decisions/2026-04-15-postgres.md) — chose Postgres for jsonb
    - [Dual-write analytics](../../docs/decisions/2026-04-22-dual-write.md) — HTTP sink alongside JSONL
    ...

docs/decisions/                           ←  OUTSIDE .claude/rules/ → never auto-loaded
├── 2026-04-15-postgres.md                ←  loaded only when relevant via Read
├── 2026-04-22-dual-write.md
└── ...
```

> **Do NOT put the per-entry files under `.claude/rules/decisions/`.** That directory is *inside* the recursive auto-load zone, so all N entries would load every session — the exact bloat this pattern exists to prevent. Keep entries in `docs/decisions/` (the same not-auto-loaded zone as `docs/archives/`).

**Strengths**
- **Bounded.** Index grows by one line per entry — even 500 entries is ~50 lines, and it's the only thing that loads.
- **On-demand load.** Operator (or Claude) reads the specific entry that matters; the other 499 stay on disk, out of context.
- **Entries live outside the auto-load zone** (`docs/decisions/`), so CC never globs them into a `<system-reminder>`.
- Each entry is independently meaningful, addressable, and editable.
- Old entries don't pollute current context.

**Weaknesses**
- **Two-step writes**: append to index + write new file under `docs/decisions/`. Five extra seconds per entry. Bash function or skill can hide this.
- **Two-step reads**: scan index, then Read the relevant file. Costs one extra tool call.
- More PR-diff noise (one new file per entry vs append to one).
- Filenames must be unique and well-chosen — bad naming kills the on-demand pattern.

## Migration Path

When a rolling logbook crosses the 30k-char mark, migrate proactively. The entries move **out** of `.claude/rules/`; only a slim index stays behind.

1. Create the out-of-zone entry directory: `mkdir -p docs/decisions`
2. Split entries one-per-file into it. A small script can split on `## ` headers:
   ```bash
   cd docs/decisions && csplit -k ../../.claude/rules/recent-decisions.md '/^## /' '{*}'
   ```
3. Create `.claude/rules/decisions-index.md` with one bullet per file, each linking to `../../docs/decisions/<file>.md`.
4. Remove the old rolling file from `.claude/rules/` (archive it: `git mv .claude/rules/recent-decisions.md docs/decisions/_legacy-rolling.md`).
5. Update any skill/hook references to point at the index.

`docs/decisions/_legacy-rolling.md` stays accessible via Read but won't auto-load (it's outside `.claude/rules/`).

> **Anti-pattern (causes #2589):** `git mv recent-decisions.md decisions/` while staying *inside* `.claude/rules/`. That keeps every split file in the recursive auto-load zone — `yonatan-hq/platform` did this and grew to 95 files / 656 KB + a 132 KB index ≈ 200k tokens/session before the relocation to `docs/decisions/` (platform#5468) fixed it.

## Pattern selection by skill

| Skill | Pattern | Why |
|---|---|---|
| `memory` | index-per-entry | Per-fact files keyed by topic; index in MEMORY.md, entries outside `.claude/rules/` |
| `remember` | index-per-entry | Same as memory — entries grow forever, lookups are by-key |
| `recent-decisions` (rules-level) | **rolling index in `.claude/rules/` + entries in `docs/decisions/`** | Entries MUST sit outside the recursive auto-load zone (#2589) |
| `goal-history.jsonl` | rolling (JSONL) | Not auto-loaded by CC; consumed by monitor on-demand. Different mechanism. |
| Skill-internal `references/*.md` | one file per concept | Loaded explicitly via Read in SKILL.md, not auto-globbed |

## Detection

The `lifecycle/rules-size-check` hook (#1815, hardened in #2589) runs on SessionStart and emits an operator-facing stderr warning on two independent signals:

- **Per-file** — any single auto-loaded file ≥ 35k chars (WARN) / 38k (CRITICAL), just under CC's 40k cliff. The scan is **recursive**, so a large file nested under `.claude/rules/decisions/` is caught too, not just top-level files.
- **Aggregate** — the SUM of every `*.md` under `.claude/rules/**` ≥ 50k chars (WARN) / 64k (CRITICAL, matching `yonatan-hq/platform#5468`'s budget). This catches the #2589 failure mode that per-file checks miss: 95 per-entry files of ~7k each individually pass the per-file gate, but their ~200k aggregate loads into every prompt.

If the aggregate warning ever fires, the fix is exactly this doc's prescription: move the per-entry files to `docs/decisions/` and keep only the slim index in `.claude/rules/`.

## When the rolling pattern is still right

Don't blanket-reject rolling logbooks. They're correct when:
- The file has a natural upper bound (e.g., "this lists the 12 active milestones — milestones don't accumulate, they close")
- Total bytes are known to stay under 20k chars even at 5× growth
- Readability as a single narrative is the primary read mode

The 40k-char cliff isn't a hard rule — it's a heuristic for "auto-loaded into every prompt." If your file isn't under `.claude/rules/**` at all (e.g. it's in `docs/`), it isn't auto-loaded and the trade-off shifts.

## Related

- `lifecycle/rules-size-check` (hook, #1815) — pre-flight warning when `.claude/rules/**` approaches the cliff
- `src/skills/CONTRIBUTING-SKILLS.md#storage-patterns` — short pointer to this reference
- `src/skills/memory/` — index-per-entry pattern done well (canonical reference implementation)
- #2589 / `yonatan-hq/platform#5468` — the recursive-autoload bug this guidance now warns against
