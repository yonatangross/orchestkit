# Link card (Open Graph / X)

The card at `https://orchestkit.yonyon.ai/opengraph-image`: Higgsfield conductor
art, a frosted panel with the wordmark, "The toolkit for any coding agent", the
skills / subagents / hooks counts, and the eight hosts OrchestKit installs into.

## How it is built

| Piece | Where | Changes when |
|---|---|---|
| Art plate | `art/A-1.png` (GPT Image 2 via Higgsfield, prompt in `prompts.json`) | only on purpose, `gen.sh A` (paid) |
| Panel, wordmark, host marks | baked into `docs/site/assets/og/card-bg.png` by `card.py --site` | a host, a mark or the layout changes |
| Counts row | drawn live by `docs/site/app/opengraph-image.tsx` from `TOTALS` | every site build |

Run `bash design/og-card/build.sh` after changing a host, a mark, the copy or
the layout, and commit the regenerated `docs/site/assets/og/`. The counts need
no rebuild: they come from `lib/generated/shared-data.ts` at site build time.

## Rules the layout keeps

- Nothing in the bottom 95 px: X lays its title bar over that strip.
- Each count sits on one baseline with its word, so the word survives the
  500 px feed size (stacked labels shrink to about 6 px there).
- Host marks are sized by ink weight, so blocky marks (OpenCode, Pi) and thin
  ones (Claude, Codex) read as one row.
- Third-party marks: sources and licenses in `marks/SOURCES.md`.

Tests: `python3 -m pytest design/og-card`.
