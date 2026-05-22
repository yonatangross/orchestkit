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

### ✅ Assistant chat output (UNLIMITED)

Lean in. ASCII boxes, tables, diagrams, semantic emoji — all encouraged. This is the highest-leverage surface; cost is per-response, not per-repo.

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

### ❌ Code, commit messages, PR titles

No emoji. No ASCII art. Conventional Commits stays plain (`feat:`, `fix:`, etc.) — the type prefix is already the signal. Code comments stay plain so grep stays useful.

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
