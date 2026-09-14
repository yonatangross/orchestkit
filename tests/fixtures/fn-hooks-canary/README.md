# fn-hooks-canary

Fixture-only plugin. It is never installed, never shipped, and its handlers never
run. `claude plugin validate` parses it statically in CI.

## Why it exists

OrchestKit is not migrating to Function Hooks (upstream anthropics/claude-code#91870,
tracked here as #3917). 78 of our 152 hook entries, across 28 events, have no native
address at all, and the identifiers are still moving. The decision is to keep
watching.

This fixture makes that watch mechanical instead of manual. It pins the parts of the
module contract we measured on CC 2.1.263 and re-measured on 2.1.270, so CI notices
when upstream moves one:

- the `modules` key in `hooks.json` is followed and the TypeScript is parsed
- `tool.call` takes a matcher, and the matcher is echoed back
- the legacy shell-hook bridge is spelled `classic.PreToolUse`, and bare `PreToolUse`
  is rejected as "not an event" (see below)
- `session.start` and `engine.create` are spelled that way
- `$.ui.log` is the capability name

## What moved, and when

Through 2.1.263, bare `PreToolUse` was the one bare event name the validator
accepted. From 2.1.266 it is rejected, and the binary dispatches shell PreToolUse
hooks through a `classic.PreToolUse` site. No CHANGELOG bullet between 2.1.265 and
2.1.270 mentions it (the feature is still behind `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`),
so this canary is what noticed. The probe went red on 2026-09-09 on 2.1.266; 2.1.265
was @latest for about four hours and was never probed.

## What CI asserts

`scripts/validate-fn-hooks-canary.sh` runs `claude plugin validate` on this
directory and requires the reported events and capabilities to match exactly. A
rename upstream (for example the announced but not yet shipped `fs.readFile` to
`fs.read`) turns the job red, which is the signal we want.

It also wraps `negative/bare-pretooluse.ts` (deliberately not listed in
`hooks.json`) in a throwaway plugin and requires validation to FAIL with
`"PreToolUse" is not an event`. That pins the rename from the side a shape-only
validator cannot fake, so a revert upstream turns the job red too.

## Two limits, both measured

`claude plugin validate` checks **shape, not membership**: `banana.PreToolUse` and
`$.zzz.nope` both validate clean. And it is not the runtime loader, so it cannot
observe the fold, skip semantics, or `next.to`. Do not read a pass here as proof a
noun exists.

## Version floor

The `modules` key is parsed as far back as CC 2.1.250, below our 2.1.251 support
floor, so this fixture needs no plugin floor bump. The canary script itself skips
below 2.1.266, the first release measured to carry the `classic.PreToolUse`
spelling. Measured across seven binaries for the `modules` key and three (2.1.268 to
2.1.270) for the rename; see #3917.
