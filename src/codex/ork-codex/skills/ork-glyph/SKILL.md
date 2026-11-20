---
name: ork-glyph
description: Render an answer inline as compact ASCII or box-drawing art with semantic status icons. Use for status, inventories, budgets, comparisons, rankings, pipelines, or requests to show something visually. Do not use for definitions, conceptual explanations, one-sentence answers, or requests for a saved page or file.
---

# Ork Glyph

Render immediately from the user's topic. With no topic, use the current
conversation. Choose the form yourself without setup questions, task creation,
or subagents. The inline rendering itself needs no external tools.

Encode information in structure. State the verdict in one prose line, then
draw one render in a monospace code block. Follow it with two or three short
observations when the diagram reveals something worth explaining.

## Choose the form

| Data shape | Render |
|---|---|
| Inventory, audit, budget | Header meter, sections, rows, totals, caveats |
| Status, progress, health | Status box and bar meters |
| Options, trade-offs | Comparison table |
| Steps, pipeline, handoffs | Flow with arrows |
| Containment, layers | Nested boxes or tree |
| Ranking, scores, counts | Table and bars |
| Change over time | Sparkline or milestone track |

## Rendering contract

- One render per reply, at most about 50 lines. In a terminal, keep each line
  within 76 display cells. In chat, web transcripts, and other non-TTY surfaces,
  use at most 72 cells and one narrow table or a vertical list, never side-by-side
  boards. Default to the non-TTY layout when the surface is uncertain.
- Use one box style per render: `┌─┐│└─┘` normally, `╭─╮│╰─╯` for soft status
  cards, or `+-|` for ASCII-only surfaces. Keep nesting to three levels.
  Use arrows `→`, `↓`, or `->` and meters `▓▓▓░░` with the numeric value beside them.
- Pair every status icon with a word: ✅ done, ❌ failed, ⚠️ warning,
  🔄 in progress, ⏸ waiting, 💡 idea, 🚨 hard block, 🎯 goal,
  🔥 top priority, 📜 doc, 🤖 agent, ⚡ hook, ℹ️ caveat.
  Risk uses 🟢 low, 🟡 medium, 🔴 high; ranking uses 🥇 1st, 🥈 2nd, 🥉 3rd.
- For domain rows, use at most one leading icon: 🐳 docker, 🌐 browser,
  📦 package, 🐍 python, 🧠 model, 📱 device, 💾 volume, 🗑️ trash,
  🗂️ files, 📥 downloads, 🔑 secret, 🧪 test, 🖥️ host, ☁️ cloud,
  📧 mail, 💬 chat. Keep icons out of prose sentences and avoid emoji chains.
- Align labels and numbers by display width, accounting for wide characters.
  Avoid full-width decorative rules, em or en dashes, and Mermaid in this inline mode.
- Use only supplied or verified data. Print `?` for unknown values. Show units,
  denominators, and arithmetic for totals; call out overlaps or estimates.
- An inventory proceeds from subject and headline meter to labeled sections,
  then rows containing label, bar, value, and action when relevant. Finish with
  section totals, the overall arithmetic, and caveats. Omit unsupported fields.

Example with supplied counts:

```text
Checks        3 / 4 passed
┌──────────┬─────────────┐
│ Unit     │ ✅ done     │
│ Security │ ✅ done     │
│ Build    │ ✅ done     │
│ Browser  │ ⏸ waiting  │
└──────────┴─────────────┘
```

Keep output inline unless the user requested a file. If the full data exceeds
the budget, render a labeled summary and state what was omitted. For an
explicit file or page request, use the host's available artifact workflow and
link the resulting artifact; do not assume another plugin's commands exist.
