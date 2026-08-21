---
title: Visual Style — ASCII Art and Emoji Usage
impact: MEDIUM
---

# Visual Style

OrchestKit leans into ASCII art and semantic emojis for visual scanability — but only with a fixed vocabulary, only where they earn their keep, and never where they break greppability, byte budgets, or accessibility.

## The Twelve-Glyph Vocabulary

Every emoji must come from this list. No decorative additions. Adding to the list requires a PR.

| Glyph | Meaning | Use for |
|-------|---------|---------|
| ✅ | success / done / pass | completed tasks, passing tests, met criteria |
| ❌ | failure / blocked / no | failed tests, denied actions, explicit "don't" |
| ⚠️ | warning / caution | non-fatal issues, edge cases, soft constraints |
| 🔄 | in-progress / loop | running tasks, retry loops, async work |
| ⏸ | paused / blocked-by | waiting on dependency or user input |
| 💡 | hint / suggestion | optional improvements, "consider this" |
| 🚨 | hard block / critical | security violations, hook denies, must-fix |
| 🎯 | goal / target | objectives, success criteria, focus |
| 🔥 | high-leverage / hot | top priority, recommended path |
| 📜 | docs / skill / spec | references to SKILL.md, documentation |
| 🤖 | agent | references to subagents |
| ⚡ | hook | references to hooks, fast/automated paths |

Risk and ranking glyphs (always paired, never solo):

- Risk: 🟢 low · 🟡 medium · 🔴 high
- Ranking: 🥇 1st · 🥈 2nd · 🥉 3rd

## ASCII Palette

Use these character sets only — keeps rendering predictable across terminals, GitHub, and CI logs.

<!-- ascii-lint-disable: single-set -->
```
Box drawing:  ┌─┐ │ ┘─└   (light)
              ╔═╗ ║ ╝═╚   (heavy — reserve for top-level section headers)
Dividers:     ───  ═══
Arrows:       → ↓ ▶ ◀
Progress:     ▓▓▓░░  ████████░░
Bullets:      • ◦ ‣
```

Do not use: 3D box characters, shaded blocks for decoration, ASCII-art logos, or any character that requires a non-default monospace font.

## Per-Surface Rules

### ✅ Assistant chat output (BUDGETED)

A budget, not a licence. This section used to read UNLIMITED and "lean in", which
is an affirmative permission for a reply that is mostly diagram (#3558).

Two rules:

1. **Spend a line budget, not a block count.** Total visual lines across the
   whole reply stay **≤ 12**, and must not exceed **40%** of the reply. Within
   that, block count is free: two 5-line blocks are fine, four 10-line blocks are
   not. Over budget means it is not a chat answer — write a playground or a file
   and print the path.
2. **The visual supports the answer, it is never the answer.** State the point in
   prose first, in one or two sentences. If the reader has to parse a diagram to
   find out what happened, the reply failed.

**Why these numbers**, measured rather than asserted. From one 151-reply sample,
28 of which carried a visual: block length p90 = 13 lines; visual share of reply
p75 = 43%. The 12-line ceiling sits just under that p90 tail, so it cuts the real
tail rather than typical use.

A block-COUNT rule was tried first and bound almost nothing: 24 of those 28
replies already used exactly one block, while the worst reply was 81% visual and
would have passed it. Volume is the failure mode, not block count.

Standing exception: a "where do we stand / what's next" status answer still gets
a state summary plus ranked next steps. That is one visual, and it is still
budgeted.

### ✅ SKILL.md files

- **Allowed:** H2 emoji prefix from vocabulary (e.g. `## 🎯 When to use`), ASCII diagrams in workflow sections, emoji in table-status columns.
- **Forbidden:** decorative inline emoji in body prose, emoji-only headings (always pair with text), emoji in code blocks or shell examples.
- 500-line cap still applies. Diagrams pushing the cap → move to `references/*.md`.

### ✅ Agent .md files

- **Allowed:** role emoji in `description:` field, one ASCII "card" block in body showing scope/tools/cost, emoji in capability tables.
- **Forbidden:** emoji in YAML keys, `name:` field, `tools:` array, or anywhere automation parses structurally.

### 🔥 Hook source (TypeScript) — strongest yes

Hook stdout renders directly in chat. Every hook message should lead with a severity glyph:

```
🚨 BLOCK · ⚠ WARN · 💡 HINT · ⏭ SKIP
```

Wrap multi-line deny messages in `┌─ ─┐` boxes so they disambiguate from assistant output.

### ✅ README, CHANGELOG, docs/*.md

GitHub renders both natively. Use ASCII architecture diagrams and emoji section headers freely. CHANGELOG entries lead with type emoji: ✨ feat · 🐛 fix · 📝 docs · 🔥 perf · ♻ refactor.

### ⚠️ CLAUDE.md (project root + .claude/)

Hard 4800-byte cap enforced by `tests/perf/test-token-overhead.sh`. Box-drawing chars are 3 bytes each — a single 60-char border row costs ~180 bytes.

- **Allowed:** one emoji per H2 heading.
- **Forbidden:** ASCII boxes, multi-line diagrams, decorative dividers. Extract to `docs/<topic>.md` with a one-line pointer.

### ✅ PR bodies

GitHub renders these natively, same as README. ASCII diagrams from the palette above are encouraged — a before/after box or a file tree carries a review point faster than a paragraph. Emoji are limited to the twelve-glyph vocabulary.

Enforced by `bin/validate-visual-style.py --mode body` in the Visual-Style PR Lint check. The palette and the emoji vocabulary are two separate lists: box drawing, dividers, arrows and progress blocks are governed by **ASCII Palette**, everything emoji by **The Twelve-Glyph Vocabulary**. The validator once conflated them (both report Unicode category `So`) and rejected plain box-drawn diagrams; keep the two tables distinct when editing either.

### ❌ Code, commit messages, PR titles

No emoji. No ASCII art. Conventional Commits stays plain (`feat:`, `fix:`, etc.) — the type prefix is already the signal. Code comments stay plain so grep stays useful.

The PR **title** is the strict surface; the PR **body** is not. `--mode title` rejects every non-ASCII symbol including the palette, which is why a diagram belongs in the body.

## Greppability Contract

Any emoji-prefixed heading must keep the original text intact so `grep` still works:

```
✅ ## 🎯 When to use      → grep "## " finds it, grep "When to use" finds it
❌ ## 🎯                  → text-less heading; ungreppable
```

## Accessibility

- Screen readers announce every emoji literally ("check mark", "warning sign"). Don't stack them: one glyph per heading or status, not 🎯🔥✅ chains.
- Box-drawing characters are pronounced as their Unicode names — use them in visual chunks (diagrams, table borders), not inline with prose.
- Never convey meaning via emoji alone. Always pair with text: `✅ Passed` not `✅`.

## Echo-Chamber Mitigation

Heavy emoji in OrchestKit's own SKILL.md files trains the model to emoji-bomb every response when those skills are loaded. The vocabulary cap is the mitigation: when Claude sees the same 12 glyphs used consistently with the same semantics across 100+ files, it learns "these glyphs = these meanings" rather than "emoji = always-on style." Drift from the vocabulary defeats the mitigation — reject PRs that add glyphs outside the list.
