---
title: Inventory render template (glyph v3)
description: The default chat render for anything with sections and totals, disk, spend, backlog, dependencies, hooks, "what is using X". Fill the slots; do not add parts.
---

# Inventory render

Verdict line first, then this, then two or three bold-led "what the numbers
told me" bullets. One render per reply, up to about 50 lines, every line 76
cells or fewer.

## The template

Slots are in `<angle brackets>`. Column starts are fixed so rows align:
icon at 0, label at 3, bar at 39, value at 48, action at 56.

<!-- ascii-lint-disable: density-min -->
```
<🖥️ icon>  <SUBJECT>  ·  <path or scope>
[<▓ used><░ free>]
 <used> <unit>    <free> <unit>    <pct> % full · <total> <unit> total
────────────────────────────────────────────────
<🟢|🟡|🔴> <SECTION WORD>, <one clause on what the section means>
────────────────────────────────────────────────
<icon> <label, 34 cells max>         <▓▓▓░░░░>  <value>  <one-word action>
<icon> <label>                       <▓▓░░░░░>  <value>  <action>
                                       ── <section total>

────────────────────────────────────────────────
<🟡> <NEXT SECTION>, <clause>
────────────────────────────────────────────────
<icon> <label>                       <▓░░░░░░>  <value>  <action>
                                       ── <section total>

<🟢> <a> + <🟡> <b> ≈ <sum>  →  <before> → ~<after>
<🔴> <held back>, only with your say-so
ℹ️  <the number that lies, and why>
ℹ️  <the second one, if any>
```

## Filling rules

| Slot | Rule |
|------|------|
| header icon | one domain icon from `tokens.json` `icons.domain` (🖥️ host, 🐳 docker, 📦 package, ☁️ cloud, ...) |
| headline meter | 22 cells inside the brackets; `▓` count = round(22 × used / total) |
| section word | 🟢 SAFE, 🟡 REGENERABLE, 🔴 ASK FIRST, or the domain's own words; always paired with the word, never the circle alone |
| row bar | 7 cells; `▓` count = round(7 × value / largest value in the render), minimum 1 for a non-zero value |
| row icon | one per row, leading column, from `icons.domain`; the same icon for the same kind of thing in every row |
| value | right-aligned, one unit for the whole render (G, $, h, PRs) |
| action | one or two words; what happens if the reader says yes |
| section total | `── <sum>` aligned under the values; every section gets one |
| summary line | show the arithmetic with `+`, `≈`, `→`; the reader must be able to check it |
| caveat lines | `ℹ️` per number that lies (sparse files, shared caches, double counts); `?` for a number you do not have, never a guess |

## Drop rules

- No sections: one section, no traffic-light word, keep the total.
- No headline number: drop the meter, keep the header line.
- No action column: drop the column, keep the alignment.
- Fewer than 4 rows total: this is a status box, not an inventory; use the
  status pattern instead.

## Worked example

`examples/_featured.md` carries the reference render (disk cleanup, three
sections, totals, summary, caveats). It is also the docs-page example, so it
must keep passing `bin/validate-visual-style.py --mode body`.
