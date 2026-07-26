---
title: Use the closed-set status glyph vocabulary for semantic indicators
impact: HIGH
impactDescription: "Single source of truth for ✓/✗/⚠/●/○/◆/◇/▶/▷/↑↓→/▓▒░ semantics. Closed set v1 prevents drift across skills, hooks, monitors, and rendered output."
tags: ascii, glyphs, vocabulary, status, semantics, closed-set
---

## Closed Status Glyph Vocabulary (v1)

Eleven glyphs, frozen at v1.0.0. Adding a 12th is a MINOR bump via the
process in `CONTRIBUTING.md`. Removing or repurposing any of the 11 is
a MAJOR bump (rare).

### Vocabulary

```
GLYPH   SEMANTIC                    DON'T USE FOR
─────   ────────                    ─────────────
●       active / on / current       generic bullet
○       inactive / off / pending    decoration
✓       passed / completed          decoration
✗       failed / blocked            general "no"
⚠       warning / attention         hard error
◆       primary / focused           random emphasis
◇       secondary / unfocused       decoration
▶       running / in-progress       generic arrow
▷       paused / awaiting input     generic arrow
↑↓→     trend up/down/forward       random direction
▓▒░     fill: high/med/low          decoration
```

### Incorrect — generic decoration

```
* Build passed
> Tests running
- Linter clean
```

### Correct — semantic glyphs

```
✓ Build passed
▶ Tests running
✓ Linter clean
```

### Anti-pattern — repurposing a semantic for decoration

```
✓ Item 1
✓ Item 2
✓ Item 3
```

A list of items isn't passing/failing — `✓` is reserved for pass/completed
states. Use `●` for active items and `○` for inactive/pending ones, or
plain `-` for an unmarked list.

### Anti-pattern — mixing semantically-loaded glyphs with decoration

```
■  Phase 1   ✓  Phase 2   ◉  Phase 3
```

`■` and `◉` are not in the vocabulary — they read as decoration. Pick
exactly one glyph from the table above per slot:

```
✓  Phase 1   ▶  Phase 2   ○  Phase 3
   done       running       pending
```
