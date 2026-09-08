# fn-hooks-canary

Fixture-only plugin. It is never installed, never shipped, and its handlers never
run. `claude plugin validate` parses it statically in CI.

## Why it exists

OrchestKit is not migrating to Function Hooks (upstream anthropics/claude-code#91870,
tracked here as #3917). 78 of our 152 hook entries, across 28 events, have no native
address at all, and the identifiers are still moving. The decision is to keep
watching.

This fixture makes that watch mechanical instead of manual. It pins the parts of the
module contract we measured on CC 2.1.263, so CI notices when upstream moves one:

- the `modules` key in `hooks.json` is followed and the TypeScript is parsed
- `tool.call` takes a matcher, and the matcher is echoed back
- bare `PreToolUse` is accepted; no other bare event name is
- `session.start` and `engine.create` are spelled that way
- `$.ui.log` is the capability name

## What CI asserts

`scripts/validate-fn-hooks-canary.sh` runs `claude plugin validate` on this
directory and requires the reported events and capabilities to match exactly. A
rename upstream (for example the announced but not yet shipped `fs.readFile` to
`fs.read`) turns the job red, which is the signal we want.

## Two limits, both measured

`claude plugin validate` checks **shape, not membership**: `banana.PreToolUse` and
`$.zzz.nope` both validate clean. And it is not the runtime loader, so it cannot
observe the fold, skip semantics, or `next.to`. Do not read a pass here as proof a
noun exists.

## Version floor

The `modules` key is parsed as far back as CC 2.1.250, below our 2.1.251 support
floor, so this fixture needs no floor bump. Measured across seven binaries; see
#3917.
