---
name: glyph
license: MIT
compatibility: "Claude Code 2.1.220+. Page route optionally uses portless and agent-browser for visual verification."
description: "One front door for visual answers. Infers the audience (operator or novice) and the surface (chat, ask, or page) from the request, announces the pick in one line, then renders ASCII plus semantic emojis inline, asks with side-by-side previews, or writes a self-contained explainer page. Use for status, comparisons, trade-offs, architecture, any 'show me X visually', 'explain X to someone', 'eli5 X', 'chart X', 'make an explainer', or a bare /glyph meaning render where we are now. For a persisted multi-artifact plan playground, use visualize-plan."
tags: [ascii, diagrams, visualization, box-drawing, terminal, explainer, eli5, quick]
version: 3.0.0
author: OrchestKit
user-invocable: true
disable-model-invocation: false
context: inherit
allowed-tools: [Read, Grep, Glob, Write, Bash, Skill, AskUserQuestion]
argument-hint: "[--chat|--ask|--page|--eli5|--decide] [topic-to-render]"
complexity: low
persuasion-type: reference
effort: low
triggers:
  keywords: [eli5, "explain like", "explain to", visually, ascii, "ascii emojis", chart, explainer, "explainer page", glyph, draw, "the options", "a page"]
  examples:
    - "status? vis in ascii emojies"
    - "eli5 how our OAuth flow works"
    - "explain the deploy pipeline to the client, make it a page"
    - "chart the hook timings from last week"
  anti-triggers: [png, "interactive playground", "plan playground", visualize-plan, implement, fix, commit]
metadata:
  category: document-asset-creation
---

# Glyph

Render the answer as structure, not decoration. Every diagram element must communicate something; an emoji must mean something (✅ pass, ❌ fail, ⚠️ risk, 🔴 blocked).

Four skills used to cover "show me this" and choosing between them was the friction. There are only **two dials**. Infer both, say which you picked, render.

|              | **chat** (inline)      | **ask** (interactive)     | **page** (file)               |
|--------------|------------------------|---------------------------|-------------------------------|
| **operator** | dense ASCII            | trade-offs side by side   | playground / decision page    |
| **novice**   | plain-word ASCII       | 3 framings, pick one      | explainer page                |

## Execution (run this, do not ask first)

1. **Resolve the dials** (overrides first, then inference, tables below).
2. **Announce in exactly one line**, then a blank line: `→ page · novice`. Nothing else, no "I'll now…".
3. **Render or delegate** per the routing table. Never call `AskUserQuestion` to pick a format, never `TaskCreate`, never spawn an `Agent` for a chat render. Asking first defeats the skill.

**With no argument, the topic is the current conversation.** Measured over a real 13-prompt session: zero asks supplied a self-contained topic. Bare `/ork:glyph` means "render where we are right now": the open work, the decision just reached, the state of the thing being discussed.

## Dial 1: audience

Default **operator**. Pick **novice** when any of these hold:

- `--eli5` passed, or the word "eli5" / "explain like" appears
- the ask names a reader who is not the operator ("explain to Nir", "for the client", "for onboarding", "so my mum gets it")
- it asks what a thing *is* or how it *works* in general rather than what our instance is doing now ("how does OAuth work" = novice; "is our OAuth broken" = operator)

Novice means: no jargon without a one-clause gloss, no internal names (file paths, service names, branch names) unless defined on the spot, concrete analogies, fewer words per visual. It does **not** mean less accurate.

## Dial 2: surface

Default **chat**. Escalate only on a real trigger:

| Pick     | When |
|----------|------|
| **chat** | The honest rendering fits in ≤ 12 visual lines and ≤ 40% of the reply. The common case. |
| **ask**  | A genuine 2 to 4 way fork the operator must settle before the next step: which angle, which depth, which of N options to build. |
| **page** | Over the 12-line budget when rendered honestly, **or** it must persist (client deliverable, onboarding doc, something to link later), **or** a file was explicitly asked for. |

**The `ask` guardrail.** `AskUserQuestion` blocks until answered and caps at 2 to 4 options with previews on single-select only. Use it only when the pick changes what happens next, never as a prettier way to print something you were going to print anyway.

**Decision-return template.** When handing the operator a decision, in chat or on a page, return a ready-made structure, never free prose:

```
DECIDE: <one-line question>
( ) option A  - <one-line consequence>
( ) option B  - <one-line consequence>   <- recommended, because <one clause>
after you pick:
[ ] <step 1 that follows>
[ ] <step 2 that follows>
```

Radio rows for the exclusive pick, checkbox rows for the follow-ups it unlocks, one consequence clause per option, recommendation marked inline, copy-paste-able plain text.

## Routing

| audience · surface | Do this |
|---|---|
| any · **chat** | Render inline with the engine below: the box-drawing vocabulary, the 12-emoji semantic set, the budget. For novice, keep the forms and drop the jargon. |
| any · **ask** | `AskUserQuestion`, one question, 2 to 4 options, **each with an ASCII+emoji `preview`**. Previews render monospace side by side; that is what makes this surface worth having. The question is always asked of the operator, whatever the artifact's audience; the announce line prints `→ ask · operator`, then render the chosen branch at the artifact's audience. |
| operator · **page**, shaped "compare N options across M dimensions, pick one" | If a decision-page skill is installed (`hq-ext:decision` or a repo-local equivalent), delegate to it. Otherwise write the explainer template with a `decision` beat per fork (below). |
| operator · **page**, shaped "let me tune inputs and see it change" | If a `playground` skill is installed, delegate: it is a configurator (controls → live preview → copyable prompt). Only when there is genuinely something to configure. |
| any · any, shaped "a genuine chart" (real numbers: series, distribution, ranking, dashboard) | If the `dataviz` skill is installed, load it first and follow its form heuristic and palette. Chat stays ASCII bars inside the budget; page charts are real HTML/SVG, never ASCII on a page. |
| novice · **page** | The page route below. Check for a house kit first; only when the repo has none, use `templates/explainer.html` from this skill. |

Delegation is a capability check, not an assumption: `Skill` names above are invoked only when the skill is listed in this session. A missing delegate falls through to this skill's own route and says so in one clause.

## Chat engine

**Pick the form from the shape of the data:**

| Topic shape | Form |
|---|---|
| state / progress / health | status box + bar meters |
| A vs B, options, trade-offs | comparison table or side-by-side boxes |
| steps, pipeline, hand-offs | left-to-right flow with `──▶` |
| containment, layers, layout | nested boxes / tree |
| ranked list, scores, counts | table + bar meters |
| over time | sparkline or milestone track |

**Budget: ≤ 12 visual lines and ≤ 40% of the reply.** Block count within that is free; two 5-line blocks are fine, four 10-line blocks are not (#3558, derivation in `rules/visual-style.md`). Over budget is not a longer chat answer, it is the page trigger firing: switch surface and say so.

**Prose first.** One or two sentences state the point, then the visual. The visual supports the answer; it is never the answer. **Unknown is `?`.** Never invent a number to make a chart look finished.

### Box-drawing character reference

This block intentionally shows multiple sets together as a key. Use ONE set per real diagram; the `single-set` lint rule enforces this on production diagrams.

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

| Set | Characters | Use for |
|-----|-----------|---------|
| `default` `─│` | normal boxes and connectors | most diagrams |
| `emphasis` `━┃` | headers, focus | key components, outer frames |
| `title` `═║` | document titles | banners only |
| `soft` `╭╮╰╯ ─│` | status cards, ambient UI | diff blocks |
| `portable` `+-\|` | NO_COLOR / CI / bare TTY | fallback |

Tokens live in `tokens.json`; names describe USE not APPEARANCE (D8). The status glyph vocabulary is a closed set of 11 (`●○✓✗⚠◆◇▶▷ ↑↓→ ▓▒░`), single source of truth `rules/status-glyph-vocabulary.md`, add-a-glyph process in `CONTRIBUTING.md`.

### Diagram patterns

Architecture:

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

Annotated file tree:

```
src/
├── api/
│   ├── routes.py          [M] +45 -12    !! high-traffic path
│   └── schemas.py         [M] +20 -5
└── services/
    └── billing.py         [A] +180       ** new file

Legend: [A]dd [M]odify [D]elete  !! Risk  ** New
```

Progress and reversibility:

```
[████████░░] 80% Complete
Phase 1  [================]  FULLY REVERSIBLE    (add column)
Phase 3  [============....]  PARTIALLY           (backfill)
              --- POINT OF NO RETURN ---
Phase 4  [........????????]  IRREVERSIBLE        (drop column)
```

Blast radius (concentric rings):

```
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

Swimlanes (`===` active, `---` blocked, `|` dependency) and before/after comparisons follow the same vocabulary; full examples in `rules/ascii-diagrams.md` and `rules/ascii-architecture.md`.

| Rule | Description |
|------|-------------|
| Font | monospace only; box-drawing needs fixed width |
| Arrows | `─>`, `──>`, or `│` with `v`/`^` |
| Annotations | `!!` risk, `**` new, `[A/M/D]` change type |
| Width | under 80 chars for terminal compatibility |
| Nesting | max 3 levels before readability degrades |

## Page route

The full contract (house kit, where a page lands, the quality bar, verification) is in `references/page-route.md`. The parts that are normative even when nothing else is read:

1. **House kit first.** `ls docs/playgrounds/_kit/base.css` (or the repo's documented equivalent). If it exists, scaffold with the repo's own playground pipeline and write no new CSS. Only when the kit is absent does `templates/explainer.html` in this skill apply.
2. **Where it lands.** With no kit: `docs/playgrounds/<category>/<slug>-explainer.html`, category from the topic (`dev` for how we build and ship, `infra` for machines and cost, `ops` for the business, `design`, `marketing`, `clients/<slug>/playgrounds/` for a named client). `ls -d` the root before writing; if it is missing, fall back to `docs/playgrounds/dev/` and say so.
3. **Quality bar (novice page).** Draw the actual thing, not generic rectangles joined by arrows. Analogy before mechanism. Every beat ends in a consequence AND a do-nothing line (two side-by-side cards, ≤ 12 words each). ≤ 20 words per beat, 4 to 6 beats. Plain words inside the diagram too. No leftover `TITLE` / `DATE` markers. Self-contained: opens from `file://`, zero network references. Light theme for outside readers.
4. **A decision page carries the controls.** If the topic is a decision or an action plan, every fork is a `decision` beat with real controls (radio pick, consequence column, follow-up checkboxes) and one sticky answer bar that keeps "copy my answers" disabled until every fork has a pick. A page that only pictures the options is a poster.
5. **Not done until you have looked at it.** Serve it via portless (`https://<name>.localhost/...`, never a `:port`, never `file://` in someone's live browser), open it with agent-browser over CDP, take viewport screenshots at several scroll positions, and READ them. Numeric gates are blind to layout collisions; the last four glyph pages each shipped a defect only a screenshot caught. If no browser path works, hand the URL to a peer that has one and wait for the verdict.
6. **RTL in SVG.** Under `dir=rtl`, SVG `<text>` has no bidi isolation. Hebrew goes in HTML captions, never SVG text; numbers that must stay in SVG use `text-anchor="middle" direction="ltr"`.

Always print the absolute path AND the served URL on completion.

## Overrides

`--chat` `--ask` `--page` force the surface. `--eli5` sets audience novice (and page, unless a surface flag is also given); the bare word "eli5" in the request behaves exactly as the flag. `--decide` forces the decision-page route. An explicit flag always beats inference, and the announce line still prints.

## When NOT to use this skill

A persisted multi-artifact plan with before/after architecture, risk heat map and execution order is `visualize-plan`. A PNG or any non-monospace, non-HTML deliverable is not this skill. Renaming a variable or running tests has no shape to render.

## Related skills

- `visualize-plan`: the full multi-artifact plan playground
- `brainstorm`: design exploration where diagrams communicate ideas
- `architecture-patterns`: system architecture that benefits from ASCII diagrams
- `code-review-playbook`: review comments with inline diagrams
