---
description: "Render an answer as ASCII art plus semantic emojis inline, right now, with no setup questions. Use for a fast visual take on status, comparisons, trade-offs, architecture, or any ad-hoc 'show me X visually' ask. For a full multi-artifact plan playground, use visualize-plan instead."
argument-hint: "[topic-to-render]"
disable-model-invocation: false
effort: low
context: inherit
user-invocable: true
name: glyph
allowed-tools: [Read, Grep, Glob]
---

# Auto-generated from skills/glyph/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Glyph

Render the answer as ASCII art plus semantic emojis, inline, immediately. All output renders in a monospace terminal with no external tools.

**Core principle:** Encode information into structure, not decoration. Every diagram element should communicate something meaningful.

## Execution (run this, do not ask first)

The whole point is speed, so there is no setup phase.

**With no argument, the topic is the current conversation.** Measured over a real 13-prompt session: zero asks supplied a self-contained topic, and the one direct invocation passed nothing at all. `/ork:glyph` on its own means "render where we are right now" — the open work, the decision just reached, the state of the thing being discussed. Render that; do not ask what to draw.

Given a topic (or the conversation, when none is given):

1. **Render immediately.** Do NOT call `AskUserQuestion` to pick a format, do NOT call `TaskCreate`, do NOT spawn an `Agent`. Choose the form yourself from the topic shape and draw it. Asking first defeats the skill.
2. **Pick the form from the shape of the data**, using the pattern library below:

   | Topic shape | Form |
   |---|---|
   | state / progress / health | status box + bar meters |
   | A vs B, options, trade-offs | comparison table or side-by-side boxes |
   | steps, pipeline, hand-offs | left-to-right flow with `──▶` |
   | containment, layers, layout | nested boxes / tree |
   | ranked list, scores, counts | table + bar meters |
   | over time | sparkline or milestone track |

3. **Emit inline in the reply.** Never write a file unless the user asked for one. This is a chat answer, not an artifact.
4. **Use the 12-emoji semantic set and box-drawing vocabulary** defined in `rules/visual-style.md` (shipped with this skill). Semantic, never decorative: an emoji must mean something (✅ pass, ❌ fail, ⚠️ risk, 🔴 blocked).
5. **Lead with the answer.** The visual comes first; prose after it only if it adds something the diagram cannot carry.
6. **Stay honest.** If a number is unknown, print `?` rather than inventing one. A confident-looking chart built on guesses is worse than prose.

**When NOT to use this skill:** if the deliverable is a multi-section HTML playground, a persisted plan artifact, or anything needing file output, use `visualize-plan` instead. Glyph is the cheap inline path; visualize-plan is the full pipeline.


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
Status:    ● ○ ✓ ✗ ⚠ ◆ ◇ ▶ ▷  ↑↓→ ▓▒░  (closed-set vocab — see rules)
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

Closed-set v1 of 11 semantic glyphs (`●○✓✗⚠◆◇▶▷ ↑↓→ ▓▒░`). Single source of truth — see `rules/status-glyph-vocabulary.md`. Add-a-glyph process in `CONTRIBUTING.md`.


## Diagram Patterns

### Architecture Diagrams

```
┌──────────────┐      ┌──────────────┐
│   Frontend   │─────>│   Backend    │
│   React 19   │      │   FastAPI    │
└──────────────┘      └───────┬──────┘
                              │
                              v
                      ┌──────────────┐
                      │  PostgreSQL  │
                      └──────────────┘
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
BEFORE                          AFTER
┌────────────┐                  ┌────────────┐
│  Monolith  │                  │  Service A │──┐
│  (all-in-1)│                  └────────────┘  │  ┌──────────┐
└────────────┘                  ┌────────────┐  ├─>│  Shared  │
                                │  Service B │──┘  │  Queue   │
                                └────────────┘     └──────────┘
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
| Font | Always monospace — box-drawing requires fixed-width |
| Weight | Standard for normal, Heavy for emphasis, Double for titles |
| Arrows | `─>`, `──>`, or `│` with `v`/`^` for direction |
| Alignment | Right-pad labels to match column widths |
| Annotations | `!!` for risk, `**` for new, `[A/M/D]` for change type |
| Width | Keep under 80 chars for terminal compatibility |
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

## Related Skills

- `brainstorm` — Design exploration where diagrams communicate ideas
- `architecture-patterns` — System architecture that benefits from ASCII diagrams
- `code-review-playbook` — Review comments with inline diagrams
