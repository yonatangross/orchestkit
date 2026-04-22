# gh-rate-limit-tracker — Live CC-Session Integration Test

End-to-end harness for the `posttool/bash/gh-rate-limit-tracker` hook. Spawns a
real `claude -p` session with a fake `gh` on `PATH` and asserts the hook fires
(or doesn't) and that the model responds appropriately.

Closes GitHub issue #1438 (milestone #117).

## What this covers that the 19 unit tests do not

Unit tests (`src/hooks/src/__tests__/posttool/bash/gh-rate-limit-tracker.test.ts`)
verify the handler's output shape given synthetic `HookInput`. This harness
verifies the full loop: CC invokes Bash -> real fake `gh` runs -> PostToolUse
hook dispatcher routes to the tracker -> `additionalContext` lands in the
model's next turn -> the model changes behavior.

## Prerequisites

- `ANTHROPIC_API_KEY` exported in the environment
- `claude` CLI `>= 2.1.117` on `PATH` (`claude --version`)
- Bash, and optionally `jq` for more precise assertion parsing

## Running

```bash
# Positive case: primary rate-limit stderr must trigger the hook.
bash test-session.sh --positive && bash assertions/golden.sh

# Negative case: plain HTTP 403 must NOT trigger the hook.
bash test-session.sh --negative && bash assertions/false-positive.sh
```

Output lands in `out/session.jsonl` (stream-json) and `out/session.err`.

## CI note

**Not wired into CI by default** — each run costs real Anthropic API tokens.
Invoke manually during hook changes, or via a `workflow_dispatch` job gated
on the `live-session-tests` label. Do not add to the default `npm test`
matrix.

## Files

| Path | Purpose |
|------|---------|
| `fakes/gh` | Positive fake — primary rate-limit stderr, exits 1 |
| `fakes/gh-permission-denied` | Negative fake — plain HTTP 403, exits 1 |
| `test-session.sh` | Orchestrator — installs fake, runs `claude -p` |
| `assertions/golden.sh` | Positive-case assertions |
| `assertions/false-positive.sh` | Negative-case assertions |
| `out/` | Generated session output (gitignored) |

## Security

- No secrets written to logs — `ANTHROPIC_API_KEY` is only read from env
- `PATH` is scoped for the child `claude` process only
- Fakes are self-contained bash scripts with no network access
