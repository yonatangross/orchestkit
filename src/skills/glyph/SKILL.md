---
name: glyph
license: MIT
compatibility: "Claude Code 2.1.277+."
description: "Render an answer as ASCII art plus semantic emojis inline, right now, with no setup questions: one render per reply, up to about 50 lines, verdict first. Use for any answer with shape: status, inventories, audits, budgets, comparisons, rankings, pipelines, 'what is using X', or any ad-hoc 'show me X visually' ask. Not for definitions, conceptual explanations, or one-sentence and one-paragraph asks; those have no shape to draw. For a full multi-artifact plan playground, use visualize-plan instead."
tags: [ascii, diagrams, visualization, box-drawing, terminal, quick]
version: 3.0.0
author: OrchestKit
user-invocable: true
disable-model-invocation: false
context: inherit
allowed-tools: [Read, Grep, Glob]
argument-hint: "[topic-to-render]"
complexity: low
persuasion-type: reference
effort: low
metadata:
  category: document-asset-creation
---

# Glyph

Render the answer as ASCII art plus semantic emojis, inline, immediately. All output renders in a monospace terminal with no external tools.

**Core principle:** Encode information into structure, not decoration. Every diagram element should communicate something meaningful.

## Execution (run this, do not ask first)

**A human asking "how do I use this" gets a URL, not a paraphrase:**
https://orchestkit.yonyon.ai/docs/reference/skills/glyph#examples (what it draws,
the two picks, three real renders, the exact invocation; generated from this
skill's `examples/_featured.md`, so it cannot drift from the skill).

The whole point is speed, so there is no setup phase.

**Already loaded means render, not hand off.** `glyph` and `ork:glyph` are one skill: this file. If the host already invoked either name, draw the answer here. Do not call the Skill tool for `glyph`, `/glyph`, or `/ork:glyph`. A second invocation loads this file again and re-runs the planning step. The 2026-09-15 Devin transcript showed "Invoked skill glyph" then "Invoked skill ork:glyph", one render stacked on another. Whether that re-entry is also why the Thoughts text repeated is not verified here; do not re-enter either way. The front door does not delegate.

**With no argument, the topic is the current conversation.** Measured over a real 13-prompt session: zero asks supplied a self-contained topic, and the one direct invocation passed nothing at all. `glyph` on its own means "render where we are right now": the open work, the decision just reached, the state of the thing being discussed. Render that; do not ask what to draw.

Given a topic (or the conversation, when none is given):

1. **Render immediately.** Do NOT call `AskUserQuestion` to pick a format, do NOT call `TaskCreate`, do NOT spawn an `Agent`. Choose the form yourself from the topic shape and draw it. Asking first defeats the skill.
2. **Pick the form from the shape of the data**, using the pattern library below:

   | Topic shape | Form |
   |---|---|
   | inventory, audit, budget, "what is using X" | **inventory render** (`templates/inventory.md`): header meter, traffic-light sections, icon / label / bar / value / action rows, totals, arithmetic summary, caveats |
   | state / progress / health | status box + bar meters |
   | A vs B, options, trade-offs | comparison table or side-by-side boxes (one narrow table in a non-TTY surface) |
   | steps, pipeline, hand-offs | left-to-right flow with `──▶` |
   | containment, layers, layout | nested boxes / tree |
   | ranked list, scores, counts | table + bar meters |
   | over time | sparkline or milestone track |
   | triage open issues, what is left, categorize the backlog | **triage page** (`templates/triage.html`). Not an inline render. |

3. **Emit inline in the reply, except the triage page.** Never write a file unless the user asked for one. The triage row above is the exception: that answer is `templates/triage.html`, not an inline render. Every other answer stays in the reply.
4. **Use the closed status set, the domain-icon legend and the box-drawing vocabulary** defined in `rules/visual-style.md` (shipped with this skill) and `tokens.json` (`icons.*`). Status icons pair with a word (✅ done, ❌ failed, ⚠️ warning, 🔴 high risk, ℹ️ caveat). Domain icons (🐳 docker, 📦 package, 🧪 test, ...) go one per row in the leading column so they scan as a legend; never inside a prose sentence, never in chains.
5. **Stay inside the budget: ONE render per reply, up to about 50 lines, every line 76 cells or fewer.** Two competing renders in one reply is flooding. Above 50 lines it is a page, not a chat answer. The 2026-08-09 budget (12 lines, 40 percent) over-corrected and was reset by operator word on 2026-09-17; the history is in `rules/visual-style.md`.
6. **Verdict first, then the render, then what the numbers told me.** One prose line states the point before the render. After the render, two or three bold-led bullets say what is not obvious from the chart. If the reader has to parse the render to find out what happened, the reply failed.
7. **Stay honest.** If a number is unknown, print `?` rather than inventing one. A confident-looking chart built on guesses is worse than prose.
8. **Match the width to the host.** A render that fits a terminal wraps into a wall in a host that reflows text: CI logs, chat widgets, VS Code chat, web transcripts, agent desktops. Read the surface from the environment the same way you already infer audience and surface: with a terminal (TTY), render as below; without one, cap every diagram line at 72 columns, and render key/value or comparison data as one narrow table or a vertical list, never side-by-side columns. The line budget does not change. Measured failure the rule prevents: a side-by-side key/value board for 5 rows lands at 113 columns, and `scripts/render-ascii.sh key-value` renders the narrow form of the same data (GH-4159).

**When NOT to use this skill:** if the deliverable is a multi-section HTML playground, a persisted plan artifact, or any file output other than the triage page, use `visualize-plan` instead. Glyph is the cheap inline path; visualize-plan is the full pipeline. The triage page stays here.


**Triage is a page, every time.** Asks shaped like "triage open issues", "what is left", or "categorize this for me" use `templates/triage.html` and no other layout. This overrides the inline-only rule and the visualize-plan handoff: the page is glyph's, then `/page-serve PATH`. Fill issues from one snapshot, `gh issue list --state open --json number,title,labels,milestone`. Put every gh-sourced string in the hidden snapshot textarea as one base64 blob of the JSON, not as raw JSON and not in the lane markup or the raw dump. A title that contains `</textarea` must never appear as raw markup inside that textarea, or it breaks out before escapeHtml runs. The page decodes the blob, then calls escapeHtml when it inserts each lane item and the raw dump, so a title stays literal text. The open-PRs tile is not in that snapshot. Fill it from `gh pr list --state open --json number`, and if that command was not run print `?`, never a guessed count. Keep the six parts in order: KPI strip, lanes, a route tag on every issue (`devin`, `ork:NAME`, `hq-ext`, `21st-dev`, `human`, `external`), capability map, DECIDE block, collapsed raw snapshot. Hand the file over with `/page-serve PATH`. Never paste a bare path. The copy button must emit `wave=LANE followups=CSV`. When no follow-up is checked, that is `followups=` with nothing after the equals, never `followups=0`.

**Over budget is the same signal.** If the honest rendering needs more than ~50 lines, that is not a bigger chat answer, it is a different deliverable: write the playground or file, then hand the human a URL with `/page-serve PATH` (a port-free `https://<name>.localhost/` route, with a stop) instead of a bare file path or a hand-started `python3 -m http.server`. Keep a 10-line excerpt in chat next to the URL. The old escape hatch fired on artifact TYPE only, so an over-budget inline reply never tripped it.


## Render anatomy (the v3 reference shape)

The shape below is the default for anything inventory-like (disk, spend,
backlog, dependencies, hooks, "what is using X"). Draw it top to bottom; drop a
part only when the data has nothing for it. The full template with the
column widths is `templates/inventory.md`; the worked example is in
`examples/_featured.md`.

<!-- ascii-lint-disable: density-min -->
```
🖥️  MACINTOSH HD  ·  /System/Volumes/Data              header: icon, subject
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░]                                 headline meter
 used 355 G    free 73 G    83 % full · 460 G total     numbers under it
────────────────────────────────────────────────        light rule
🟢 SAFE, pure caches; nothing lost, tools refill them   traffic-light word
────────────────────────────────────────────────
🐳 Docker dangling images+build cache  ▓▓▓▓░░░  14.5 G  docker prune
🌐 Chrome caches (Google + Island)     ▓▓░░░░░   8.9 G  browsers refill
📦 npm cache  ~/.npm                   ▓▓░░░░░   6.2 G  npm cache clean
                                       ── 45.3 G        per-section total
🟢 safe 45 G + 🟡 regenerable 41 G ≈ 87 G  →  free 73 G → ~159 G
ℹ️  Docker.raw shows 432 G but is sparse: 37 G real.    caveat line
```

Parts, in order:

1. **Header line**: one domain icon, the subject, `·`, the path or scope.
2. **Headline meter**: `[▓▓▓░░]` with the numbers printed on the line under it.
3. **Sections**: opened by a light rule `────` and a traffic-light word
   (🟢 SAFE, 🟡 REGENERABLE, 🔴 ASK FIRST, or the domain's own words).
4. **Rows**: icon, label, bar `▓▓▓░░`, value, one-word action, aligned in
   columns. One domain icon per row, leading column.
5. **`── total`** line per section, right-aligned under the values.
6. **Summary line** that shows the arithmetic, so the reader can check it.
7. **`ℹ️` caveat lines** for the numbers that lie (sparse files, shared
   caches, double counts). `?` for a number you do not have.
8. Then prose: two or three bold-led bullets, "what the numbers told me".

The vocabulary is closed. Status icons come from `tokens.json` `icons.status`
(plus `risk` and `ranking`); row icons from `icons.domain`. Add there, not ad
hoc. No emoji chains, no emoji in prose sentences, no full-width rules, no
"★ Insight" blocks, no mermaid in chat, no em or en dashes.

## Box-Drawing Character Reference

This block intentionally shows multiple sets together as a key. Authors
should use ONE set per real diagram; the `single-set` lint rule enforces
this on production diagrams.

<!-- ascii-lint-disable: single-set,single-arrow-style,density-min -->
```
default:   ┌─┐ │ └─┘  ├─┤ ┬ ┴ ┼
emphasis:  ┏━┓ ┃ ┗━┛  ┣━┫ ┳ ┻ ╋
title:     ╔═╗ ║ ╚═╝  ╠═╣ ╦ ╩ ╬
soft:      ╭─╮ │ ╰─╯
portable:  +-+ | +-+  +-+ + + +
Arrows:    → ← ↑ ↓ ─> <─ ──> <──
Blocks:    █ ▓ ░ ▏▎▍▌▋▊▉
Status:    ● ○ ✓ ✗ ⚠ ◆ ◇ ▶ ▷  ↑↓→ ▓▒░  (closed-set vocab, see rules)
```

### Set Conventions (D8: intent-driven naming)

Tokens live in `tokens.json`. Names describe USE not APPEARANCE.

| Set | Characters | Use For |
|-----|-----------|---------|
| `default` `─│` | Normal boxes and connectors | Most diagrams |
| `emphasis` `━┃` | Headers, focus, draw the eye | Key components, outer frames |
| `title` `═║` | Document titles | §0-style banners only |
| `soft` `╭╮╰╯ ─│` | Status cards, ambient UI | Diff blocks |
| `portable` `+-\|` | NO_COLOR / CI / bare TTY | Fallback |

Rename codemod (D8): old `light/heavy/double/rounded/ascii-fallback` → new names above. Old names accepted with warning for one minor release.

### Status Glyph Vocabulary

Closed-set v1 of 11 semantic glyphs (`●○✓✗⚠◆◇▶▷ ↑↓→ ▓▒░`). Single source of truth: see `rules/status-glyph-vocabulary.md`. Add-a-glyph process in `CONTRIBUTING.md`.


## Diagram Patterns

### Architecture Diagrams

```
┌────────┐ ┌────────┐
│Frontend│─>│Backend │
│React 19│ │FastAPI │
└────────┘ └───┬────┘
           ┌───┴──────┐
           │PostgreSQL│
           └──────────┘
```

### File Trees with Annotations

```
src/
├── api/
│   ├── routes.py          [M] +45 -12    !! high-traffic path
│   └── schemas.py         [M] +20 -5
├── services/
│   └── billing.py         [A] +180       ** new file
└── tests/
    └── test_billing.py    [A] +120       ** new file

Legend: [A]dd [M]odify [D]elete  !! Risk  ** New
```

### Progress Bars

```
[████████░░] 80% Complete
+ Design    (2 days)
+ Backend   (5 days)
~ Frontend  (3 days)
- Testing   (pending)
```

### Swimlane / Timeline Diagrams

```
Backend  ===[Schema]======[API]===========================[Deploy]====>
                |            |                                ^
                |            +------blocks------+             |
                |                               |             |
Frontend ------[Wait]--------[Components]=======[Integration]=+

=== Active work   --- Blocked/waiting   | Dependency
```

### Blast Radius (Concentric Rings)

```
            Ring 3: Tests (8 files)
       +-------------------------------+
       |    Ring 2: Transitive (5)      |
       |   +------------------------+   |
       |   |  Ring 1: Direct (3)     |   |
       |   |   +--------------+      |   |
       |   |   | CHANGED FILE |      |   |
       |   |   +--------------+      |   |
       |   +------------------------+   |
       +-------------------------------+
```

### Comparison Tables

```
BEFORE        AFTER
┌──────────┐  ┌─────────┐
│Monolith  │  │Service A│──┐
│(all-in-1)│  └─────────┘  │ ┌───────┐
└──────────┘  ┌─────────┐  ├─>│Shared │
              │Service B│──┘ │Queue  │
              └─────────┘    └───────┘
```

### Reversibility Timeline

```
Phase 1  [================]  FULLY REVERSIBLE    (add column)
Phase 2  [================]  FULLY REVERSIBLE    (new endpoint)
Phase 3  [============....]  PARTIALLY           (backfill)
              --- POINT OF NO RETURN ---
Phase 4  [........????????]  IRREVERSIBLE        (drop column)
```


## Key Rules

| Rule | Description |
|------|-------------|
| Font | Always monospace; box-drawing requires fixed-width |
| Weight | Standard for normal, Heavy for emphasis, Double for titles |
| Arrows | `─>`, `──>`, or `│` with `v`/`^` for direction |
| Alignment | Right-pad labels to match column widths |
| Annotations | `!!` for risk, `**` for new, `[A/M/D]` for change type |
| Width | 76 cells or fewer in a terminal; at most 72 per line in a non-TTY surface, as one narrow table or vertical list (GH-4159) |
| Nesting | Max 3 levels of box nesting before readability degrades |


## When to Use Each Pattern

| Pattern | Use Case |
|---------|----------|
| Layered boxes | System architecture, deployment topology |
| Concentric rings | Blast radius, impact analysis |
| Timeline bars | Reversibility, migration phases |
| Swimlanes | Execution order, parallel work streams |
| Annotated trees | File change manifests, directory structures |
| Comparison tables | Cross-layer consistency, before/after |
| Progress bars | Status tracking, completion metrics |
| Inventory render | Disk, spend, backlog, dependency audits; anything with sections and totals |

## Related Skills

- `brainstorm`: Design exploration where diagrams communicate ideas
- `architecture-patterns`: System architecture that benefits from ASCII diagrams
- `code-review-playbook`: Review comments with inline diagrams
