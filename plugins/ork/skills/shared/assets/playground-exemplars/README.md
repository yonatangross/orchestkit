# Playground exemplars

Gold-standard, single-file HTML playgrounds for the **visual** playground archetypes. They are the
copyable starting points enforced by
[`../../rules/playground-visual-standard.md`](../../rules/playground-visual-standard.md).

> **Edit discipline (colocation):** if you change a token, component, or rule in the standard, update
> the matching exemplar in the **same PR** — and vice versa. They are one unit of change.

| File | Archetype | Persona | Use it when… |
|---|---|---|---|
| `homeos-arieh.html` | User-story player | warm-glass | …you want to see the bar. Designed by **Arieh**; committed verbatim — study, don't edit. |
| `user-story-player.template.html` | User-story player | warm-glass | …the playground demonstrates a **feature or flow** (message→card, action→result). Swap `STORY`. |
| `decision-board.template.html` | Decision board | cool-glass | …the playground is for **prioritization / management** via drag-and-drop. Swap `ITEMS`. |

## What makes these different from a dashboard

A dashboard *shows* state; these let the viewer **operate** something:

- **Player** — a device mockup + a transport (▶ play / ‹ prev / next ›) + a cause→effect flow arrow.
- **Decision board** — drag-and-drop across an Impact×Effort matrix, a ranked list, or buckets, with
  a live RICE/WSJF score and a 1-click copy-prompt.

Both are zero-dependency, single-file, dark warm/cool **glass** aesthetic, RTL-ready via CSS logical
properties, accessible (the decision board has full keyboard control + `aria-live` announcements),
and honor `prefers-reduced-motion`.

## Reuse

1. Copy the template matching your archetype.
2. Replace the data block (`STORY` / `ITEMS`) — keep the engine.
3. Run the §10 self-audit checklist in the standard before shipping.

For the routing rule (player vs decision-board vs plain dashboard) and the full token/glass/motion
spec, read the standard.
