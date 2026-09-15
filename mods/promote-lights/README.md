# promote-lights

Shows CI status lights above the prompt while a promote PR (base `main`) is open.

## What it does

- Displays one light per required context in an AbovePrompt band
- Pins a one-line status summary under the prompt
- Polls one REST page per minute, only while the PR is open
- Stops automatically when the PR merges, closes, or the head moves
- Shows `HOLD` in red when the latest PR comment starts with `HOLD*`

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
- `$.ui.status`, `$.ui.invalidate`

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

## Acceptance checklist

- [ ] With a real platform promote PR open, the band shows 11 lights for `main` above the prompt within one tick
- [ ] A tier that CI cancelled shows warning sign and the pinned line says so
- [ ] When the head moves the band says "head moved, stopped" and the tick stops
- [ ] When the PR merges the band clears itself
- [ ] One REST call group per minute measured in the gh audit log (<= 40 calls over 10 minutes)
- [ ] The band survives a hot reload because it re-reads `$.store` on the next `ui.render`
- [ ] The classic `merge-on-required.sh` is untouched and still the thing that merges
