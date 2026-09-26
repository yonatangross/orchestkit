# promote-lights

Shows CI status lights above the prompt while a promote PR (base `main`) is open.

## What it does

- Displays a compact AbovePrompt band: one summary line (PR, head, merge state, green/yellow/red counts), then one line per required context that is not green, full name, red first, at most 5 such lines with a `+N more` line after them; when everything is green the band is the summary line alone:

  ```
  🚦 #4435  3afff24  BLOCKED   19 🟢  0 🟡  2 🔴
     🔴 PR Playground
     🔴 CI Summary
  ```
- Pins a one-line status summary under the prompt
- Polls one REST page per minute, only while the PR is open
- Stops automatically when the PR merges, closes, or the head moves
- Shows `HOLD` in red when the latest PR comment starts with `HOLD*`
- Draws a one-line dim `lights: <reason>` band when it cannot show lights (no required contexts, gh failed, head moved), so a failure is never a blank space
- Demo mode: `/lights watch owner/repo#N` shows lights for any open PR in any repo, no promote PR needed

## How the band is drawn

The band is built from the `Box` and `Text` elements that `$.ui.resolve(e)` hands the `ui.render` hook. On Claude Code 2.1.282 a plain `{ type: "Box" }` object is not an element and never draws (measured 2026-09-25: the hook settles, nothing appears). The downstream tree from `next(e)` is an opaque engine node, so the band is placed above it in a column and never mutates it.

## Watch mode (demo)

`/lights watch owner/repo#123` (also `owner/repo 123` or a PR URL) points the tick at any open PR:

- every gh call targets the watched repo (`-R owner/repo`); the lights still show in this session's band
- a watched repo that protects nothing falls back to every check run on the head, worst run per name wins
- a new push to a watched PR is followed, not stopped (a promote PR still stops on a moved head)
- `PROMOTE_LIGHTS_WATCH=owner/repo#123` starts watching at session start with no typing, for recorded demos

A real promote PR keeps its stricter rule: an empty required-context union refuses green instead of falling back.

## Only this session's lights

Lights are kept in `$.store`, which outlives a Claude Code session, and the
band can be drawn before `session.start` runs. Every stored entry therefore
carries a token of the process that wrote it, and the band and `/lights`
ignore any entry with another token (or none). A new session never shows the
previous session's lights, even for a moment.

## Light colors

| Status | Color |
| ------ | ----- |
| success | green circle |
| queued / in_progress / null | yellow circle |
| failure / timed_out / action_required | red circle |
| cancelled | warning sign (its own bucket, never pass) |
| missing (no run found) | red circle |

Cancelled runs get their own bucket because a superseded attempt leaves tiers CANCELLED, and the aggregate must read failure even though zero tests failed.

## Requirements

- Claude Code 2.1.266 minimum (first measured `classic.*` binary)
- `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` in your shell profile or personal settings

## Footprint

Hooks:

- `session.start{}`
- `turn.complete{}`
- `command.register{}`
- `ui.render{component=AbovePrompt}`

Calls:

- `$.process.run` (gh CLI, read-only)
- `$.fs.read` (.github/branch-protection.json)
- `$.session.repo`
- `$.clock.every`
- `$.store.get`, `$.store.set`
- `$.ui.status`, `$.ui.invalidate`, `$.ui.resolve`
- `$.env.get` (`PROMOTE_HEAD`, `PROMOTE_LIGHTS_WATCH`)

Declared capability: `process.run` (can run host processes; gh carries your auth, read-only calls only).

Negative: no `$.secrets.*`, no `$.http.fetch`, no `$.model.*`.

## Rollback

1. `/lights off` or disable the plugin
2. Unset `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`
3. `$.store` keys `lights:*` are the only residue and are safe to drop

## Budget guard

One REST call group per minute. Measured over 10 minutes with a real PR: at most 40 calls (gh API count), staying under the 5000/h budget shared across seats.

## Commands

- `/lights` - show current status
- `/lights off` - stop tracking and clear the band
- `/lights refresh` - force immediate refresh
- `/lights watch owner/repo#N` - show lights for any open PR (demo mode)

## Acceptance checklist

- [ ] With a real platform promote PR open, the band shows the summary for its 11 required contexts for `main` above the prompt within one tick, plus one line per context that is not green
- [ ] A tier that CI cancelled shows warning sign and the pinned line says so
- [ ] When the head moves the band says "head moved, stopped" and the tick stops
- [ ] When the PR merges the band clears itself
- [ ] One REST call group per minute measured in the gh audit log (<= 40 calls over 10 minutes)
- [ ] The band survives a hot reload because it re-reads `$.store` on the next `ui.render`
- [ ] The classic `merge-on-required.sh` is untouched and still the thing that merges
