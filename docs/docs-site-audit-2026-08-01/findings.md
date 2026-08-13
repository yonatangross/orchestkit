# Docs-site staleness audit — 2026-08-01

Scope: all 270 MDX under `docs/site/content/docs/` plus the handwritten
`/about` page. Read-only; nothing edited.

## Ground truth

`bin/validate-counts.sh` **PASSES**: **105 skills · 36 agents · 218 hooks**,
versions synced at 9.4.0 across all six files.

Of the 105 skills, **35** carry `user-invocable: true`.

Note: `src/agents/` holds 37 `.md` files, but one is `README.md`. The agent
count is 36, not 37.

## 1. Dead `/ork:` references — 11 names, 15 occurrences

Skills referenced in docs that do not exist in `src/skills/`. Intentional
placeholders (`ork:foo`, `ork:my-skill`, `ork:skill-name`, `ork:x`, `ork:xxx`)
are excluded — those are teaching examples, not drift.

| Reference | Occurrences | Location |
|---|---|---|
| `ork:dogfood` | 3 | `reference/skills/design-import.mdx:235,240,257` |
| `ork:design-iterate` | 2 | `cookbook/claude-design-handoff.mdx:196`, `reference/skills/design-ship.mdx:230` |
| `ork:experiment` | 2 | `reference/skills/auto.mdx:134,214` |
| `ork:agents-view` | 1 | `reference/skills/doctor.mdx:1918` |
| `ork:build-optimizer` | 1 | `reference/skills/demo-producer.mdx:1713` |
| `ork:code-walkthrough` | 1 | `reference/skills/demo-producer.mdx:1562` |
| `ork:design-system` | 1 | `reference/skills/ai-ui-generation.mdx:162` |
| `ork:elicit` | 1 | `reference/skills/configure.mdx:1327` |
| `ork:metrics-instrumentation` | 1 | `reference/skills/product-analytics.mdx:138` |
| `ork:scaffold` | 1 | `reference/skills/help.mdx:328` |
| `ork:upgrade-assessment` | 1 | `troubleshooting/faq.mdx:58` |

`ork:dogfood` is the interesting one: a `dogfood` skill **does** exist, but as a
standalone skill, not under the `ork` plugin — so `/ork:dogfood` is wrong while
`/dogfood` is right. Same shape for `ork:elicit`: `ork-elicit` exists as an MCP
server, not as a skill.

## 2. Count drift — 12 lines across 8 files

Only lines claiming a **plugin-wide total** are listed. Subset counts
("12 hooks with `type: http`", "40 skills set `effort:`", "spawns up to
14 agents") are correct by design and excluded.

| File:line | Says | Actual |
|---|---|---|
| `reference/skills/doctor.mdx:735` | `113 skills, 37 agents, 212 hook entries` | 105 / 36 / 218 |
| `reference/skills/doctor.mdx:1809` | `113 skills` validated | 105 |
| `reference/skills/doctor.mdx:2306` | `15/38 agents` declare `background: true` | /36 |
| `reference/skills/auto.mdx:21` | `OrchestKit has 112 skills` | 105 |
| `reference/skills/help.mdx:360` | `OrchestKit: 89 skills available` | 105 |
| `skills/writing-skills.mdx:160` | `113 skills` | 105 |
| `skills/command-skills.mdx:8` | `the 18 skills with user-invocable: true` | **35** |
| `multi-agent-patterns.mdx:358` | `all 37 agents` | 36 |
| `getting-started/configuration.mdx:54` | `all 37 agents` | 36 |
| `guides/cc-adoption.mdx:10` | `100+ skills, 37 agents` | 36 |

`doctor.mdx` is the worst single file: 4 wrong totals, and it is the page whose
whole job is reporting component health.

`command-skills.mdx:8` is the highest-impact error — it undercounts the
user-invocable surface by half (18 vs 35). That page is how a reader learns
which commands exist.

## 3. Pages that are correct — do not "fix"

- `foundations/overview.mdx:3` — "105 skills, 36 agents, 218 hooks" ✅ exact
- `reference/index.mdx:3,14` — "105 skills, 36 agents, 218 hooks" ✅ exact
- `agents/overview.mdx:163` — "The 36 Agents by Category" ✅
- All `skills/by-category/*.mdx` per-category counts ✅ (subset counts)

The front-door pages are accurate. The drift is concentrated in deep reference
pages that were hand-edited after the front door was regenerated.

## 4. `/about` page — clean

`docs/site/app/(home)/about/page.tsx`, 79 lines, handwritten TSX. Zero numeric
claims, zero `/ork:` references. Nothing to correct.

## 5. Coverage — no gaps

All **35** user-invocable skills appear somewhere in the docs. There is no
"shipped but undocumented" case.

## Recommended fix order

1. `reference/skills/doctor.mdx` — 4 wrong totals in the component-health page.
2. `skills/command-skills.mdx:8` — 18 → 35 user-invocable.
3. The three `37 agents` → `36 agents` lines.
4. The remaining skill totals (112, 89, 113 ×2) → 105.
5. The 11 dead `/ork:` references — decide per case whether the doc should point
   at a real skill, drop the reference, or fix the prefix (`ork:dogfood` →
   `dogfood`).

Items 1–4 are mechanical. Item 5 needs a judgment call per reference.

## Durability

Every count in this report was hand-verified against `bin/validate-counts.sh`,
which already gates the repo's own files. It does **not** cover
`docs/site/content/**`, which is why these drifted. A gate extending the same
check to the docs site would stop this class recurring.
