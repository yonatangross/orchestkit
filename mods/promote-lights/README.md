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
- The band is the only place the lights are drawn: each tick clears the plugin status line instead of repeating the band in it, and a degraded promote search shows as `DEGRADED` in the band. Claude Code gives a mod no signal when the band is collapsed (ctrl+x ctrl+a), so `/lights` answers the one-line status on demand
- Draws a one-line dim `lights: <reason>` band when it cannot show lights (no required contexts, gh failed, head moved), so a failure is never a blank space
- Demo mode: `/lights watch owner/repo#N` shows lights for any open PR in any repo, no promote PR needed

## How the band is drawn

The band is built from the `Box` and `Text` elements that `$.ui.resolve(e)` hands the `ui.render` hook. On Claude Code 2.1.282 a plain `{ type: "Box" }` object is not an element and never draws (measured 2026-09-25: the hook settles, nothing appears). The downstream tree from `next(e)` is an opaque engine node, so the band is placed above it in a column and never mutates it.

## Watch mode (demo)

`/lights watch owner/repo#123` (also `owner/repo 123` or a PR URL) points the tick at any open PR:

- every gh call targets the watched repo (`-R owner/repo`); the lights still show in this session's band
- a watched repo that protects nothing falls back to every check run on the head, worst non-skipped run per name wins
- a new push to a watched PR is followed, not stopped (a promote PR still stops on a moved head)
- `PROMOTE_LIGHTS_WATCH=owner/repo#123` starts watching at session start with no typing, for recorded demos

A real promote PR keeps its stricter rule: an empty required-context union refuses green instead of falling back.

## Only this session's lights

Lights are kept in `$.store`, which outlives a Claude Code session and is
shared by every session on the machine, and the band can be drawn before
`session.start` runs. Each session therefore stores its lights under its own
key (the repo plus a session token), stamps the entry with that token, and
draws only its own entry. Two live sessions on the same repo keep separate
bands, and a new session (including a `/clear`, which rotates the token and
removes the previous entry) never shows older lights, even for a moment.

## Light colors

| Status | Color |
| ------ | ----- |
| success | green circle |
| queued / in_progress / null | yellow circle |
| failure / timed_out / action_required | red circle |
| cancelled | warning sign (its own bucket, never pass) |
| skipped | dropped when the name has a real verdict; a skipped-only name stays yellow (never ran, never pass) |
| missing (no run found) | red circle |

Cancelled runs get their own bucket because a superseded attempt leaves tiers CANCELLED, and the aggregate must read failure even though zero tests failed.

## Requirements

- Claude Code 2.1.266 minimum (first measured `classic.*` binary)
- On 2.1.266 through 2.1.286 the module system sits behind
  `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; set it in your shell profile or personal settings.
  On 2.1.287+ Mods are public and the flag is no longer needed.

### Public Mods status (CC 2.1.287+)

CC 2.1.287 announces Claude Mods as public, so plugins may now modify deeper behaviour than
hooks. Measured on CC 2.1.288 (2026-10-03, headless `-p --plugin-dir` per mod, flag unset
then set to 1): all four ork mods load and fire with the flag unset. secrets-veil masked a
secret in a Bash tool result, lesson-cards denied `gh pr checks` via lesson
`cancelled-check-is-not-pass`, memory-lens indexed 384 memories at session start, and
promote-lights ran `gh` through `$.process.run`. The flag only gates 2.1.266 to 2.1.286.
The built-in "You should know" mod (`/plugin enable cc-plugin-you-should-know@builtin`)
ships in the same release; coexistence is unverified and ork does not enable it. Migration
questions stay open in GH-3917; the command hook fleet is not part of this check.

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
2. On 2.1.266 to 2.1.286 also unset `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` (inert on 2.1.287+)
3. `$.store` keys `lights:*` are the only residue and are safe to drop

## Budget guard

One REST call group per minute. Measured over 10 minutes with a real PR: at most 40 calls (gh API count), staying under the 5000/h budget shared across seats.

## Commands

- `/lights` - show current status
- `/lights off` - stop tracking and clear the band
- `/lights refresh` - force immediate refresh
- `/lights watch owner/repo#N` - show lights for any open PR (demo mode)
- `/lights owner/repo#N` - the same, without the watch word (also `owner/repo N` and PR URLs)

## Acceptance checklist

- [ ] With a real platform promote PR open, the band shows the summary for its 11 required contexts for `main` above the prompt within one tick, plus one line per context that is not green
- [ ] A tier that CI cancelled shows warning sign and the pinned line says so
- [ ] When the head moves the band says "head moved, stopped" and the tick stops
- [ ] When the PR merges the band clears itself
- [ ] One REST call group per minute measured in the gh audit log (<= 40 calls over 10 minutes)
- [ ] The band survives a hot reload because it re-reads `$.store` on the next `ui.render`
- [ ] The classic `merge-on-required.sh` is untouched and still the thing that merges
