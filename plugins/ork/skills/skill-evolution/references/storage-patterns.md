# Storage Patterns: Rolling Logbook vs Index-Per-Entry

When a skill (or a project's `.claude/rules/*.md` files) needs to accumulate state across sessions — decisions, observations, patterns, knowledge — there are two storage patterns. Pick wrong and Claude Code's 40k-char auto-load threshold ambushes you 3-6 months later.

## TL;DR

| Need | Use |
|---|---|
| Append-only, < 30k chars total expected lifetime | **Rolling logbook** |
| Append-forever, no natural upper bound | **Index-per-entry** |
| Reads are chronological narrative | **Rolling logbook** |
| Reads are by-key or by-date lookup | **Index-per-entry** |
| Each entry independently meaningful | **Index-per-entry** |

If unsure, default to **index-per-entry** — bounded by construction.

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
- **CC auto-loads everything** in `.claude/rules/*.md` into every `<system-reminder>`. At 40,000 chars CC emits a yellow warning, but by then you've burned that context on every prompt for weeks.
- Stale entries pollute the loaded context (Q1 2024 decisions for a Q4 2026 session — irrelevant but billed).
- Recursive search/replace breaks (one wrong-line edit corrupts a 30k file).

**Concrete failure case**: `yonatan-hq/platform/.claude/rules/recent-decisions.md` ballooned to 53.8k chars in seven months. CC flagged it as "Large file will impact performance" — every session paid ~14k extra context tokens before the operator noticed.

## Pattern 2 — Index-Per-Entry

One small index file with one bullet per entry; individual entries live in sibling files loaded on-demand via `Read`.

```
.claude/rules/                            ←  scanned by CC's auto-loader
├── index.md                              ←  ≤ 200 lines, only file auto-loaded
│   - [Use Postgres not MongoDB](decisions/2026-04-15-postgres.md) — chose Postgres for jsonb support
│   - [Dual-write analytics](decisions/2026-04-22-dual-write.md) — HTTP sink alongside local JSONL
│   ...
└── decisions/                            ←  NOT auto-loaded (subdirectory)
    ├── 2026-04-15-postgres.md            ←  loaded only when relevant via Read
    ├── 2026-04-22-dual-write.md
    └── ...
```

**Strengths**
- **Bounded.** Index grows by one line per entry — even 500 entries is ~50 lines.
- **On-demand load.** Operator (or Claude) reads the specific entry that matters; the other 499 stay on disk.
- **CC's auto-loader stops at the subdirectory boundary** — by convention CC globs `*.md` at the rules root, not recursive.
- Each entry is independently meaningful, addressable, and editable.
- Old entries don't pollute current context.

**Weaknesses**
- **Two-step writes**: append to index + write new file. Five extra seconds per entry. Bash function or skill can hide this.
- **Two-step reads**: scan index, then Read the relevant file. Costs one extra tool call.
- More PR-diff noise (one new file per entry vs append to one).
- Filenames must be unique and well-chosen — bad naming kills the on-demand pattern.

## Migration Path

When a rolling logbook crosses the 30k-char mark, migrate proactively:

1. Move the rolling file aside: `git mv recent-decisions.md decisions/_legacy-rolling.md`
2. Create `decisions/` subdirectory.
3. Split entries one-per-file. A small script can split on `## ` headers:
   ```bash
   csplit -k recent-decisions.md '/^## /' '{*}'
   ```
4. Create `index.md` with one bullet per file.
5. Update any skill/hook references to point at the index.

The `_legacy-rolling.md` stays accessible via Read but won't auto-load (not at `.claude/rules/*.md` root).

## Pattern selection by skill

| Skill | Pattern | Why |
|---|---|---|
| `memory` | index-per-entry | Per-fact files keyed by topic; index in MEMORY.md |
| `remember` | index-per-entry | Same as memory — entries grow forever, lookups are by-key |
| `recent-decisions` (rules-level) | **migrating from rolling → index-per-entry** | Burned 53k chars before the auto-loader warning fired |
| `goal-history.jsonl` | rolling (JSONL) | Not auto-loaded by CC; consumed by monitor on-demand. Different mechanism. |
| Skill-internal `references/*.md` | one file per concept | Loaded explicitly via Read in SKILL.md, not auto-globbed |

## Detection

The `lifecycle/rules-size-check` hook (#1815) warns at 35k chars (WARN) and 38k chars (CRITICAL) when a `.claude/rules/*.md` file would auto-load above CC's 40k threshold. Operator-facing stderr signal on every SessionStart — gives you ~5k chars of runway before CC starts complaining.

## When the rolling pattern is still right

Don't blanket-reject rolling logbooks. They're correct when:
- The file has a natural upper bound (e.g., "this lists the 12 active milestones — milestones don't accumulate, they close")
- Total bytes are known to stay under 20k chars even at 5× growth
- Readability as a single narrative is the primary read mode

The 40k-char cliff isn't a hard rule — it's a heuristic for "auto-loaded into every prompt." If your file isn't at `.claude/rules/*.md` root, it isn't auto-loaded and the trade-off shifts.

## Related

- `lifecycle/rules-size-check` (hook, #1815) — pre-flight warning when a file approaches the cliff
- `src/skills/CONTRIBUTING-SKILLS.md#storage-patterns` — short pointer to this reference
- `src/skills/memory/` — index-per-entry pattern done well (canonical reference implementation)
