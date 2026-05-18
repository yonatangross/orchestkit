---
title: claude --bare auth is broken — never use it in CI
impact: HIGH
impactDescription: Prevents silent CI failures from claude --bare ignoring all auth credentials
tags: [ci, auth, claude-code, headless, bare]
---

# Rule: `claude --bare` auth is broken — never use it in CI

**Status**: confirmed CC 2.1.81–2.1.143 · upstream bug filed [anthropics/claude-code#60155](https://github.com/anthropics/claude-code/issues/60155) · prior incident [orchestkit#1629](https://github.com/yonatangross/orchestkit/issues/1629)

## The trap

The `--bare` flag's `--help` text promises:

> Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read).

**All three documented paths fail.** Every invocation in `--bare` mode returns:

```
{"is_error":true, "result":"Not logged in · Please run /login"}
```

regardless of whether the API key is supplied via env var, `--settings.apiKey`, or `--settings.apiKeyHelper`.

## Don't do this

```yaml
# WRONG — will silently fail every claude invocation
- env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    claude -p --bare --max-turns 4 --output-format json "..."
```

## Do this

```yaml
# RIGHT — FILE-BACKED apiKeyHelper + plain `claude -p`
#
# Critical: the helper script does NOT inherit $ANTHROPIC_API_KEY from
# the parent step's env. CC strips env before spawning the helper.
# Verified locally 2026-05-18 (CC 2.1.143): "apiKeyHelper failed: did
# not return a value". The helper must read from a file the workflow
# writes.
- name: Configure Claude apiKeyHelper
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    mkdir -p ~/.claude
    umask 077
    printf '%s' "$ANTHROPIC_API_KEY" > ~/.claude/.api-key
    chmod 600 ~/.claude/.api-key
    printf '#!/bin/sh\ncat %s/.claude/.api-key\n' "$HOME" \
      > ~/.claude/api-key-helper.sh
    chmod +x ~/.claude/api-key-helper.sh
    printf '{"apiKeyHelper":"%s/.claude/api-key-helper.sh"}\n' "$HOME" \
      > ~/.claude/settings.json

- name: Analyze
  run: |
    claude -p --max-turns 4 --output-format json --no-session-persistence "..."
```

Cost: ~10k tokens/call instead of `--bare`'s advertised ~4k. Worth it — the alternative is a silently failing workflow. The runner is ephemeral; the `.api-key` file is wiped at job end.

## What does NOT work (don't try these)

| Pattern | Result |
|---|---|
| `claude --bare` + `ANTHROPIC_API_KEY` env var | "Not logged in" — `--bare` ignores env despite help text |
| `claude --bare` + `--settings {"apiKey":"..."}` | "Not logged in" — same |
| `claude --bare` + `--settings {"apiKeyHelper":"..."}` | "Not logged in" — same |
| `claude -p` + `--settings {"apiKey":"..."}` | "Not logged in" — `apiKey` in settings is silently ignored |
| `claude -p` + helper that echoes `$ANTHROPIC_API_KEY` | "apiKeyHelper failed: did not return a value" — env stripped before helper invocation |

The ONLY working combo: plain `claude -p` + `apiKeyHelper` that reads from a file the workflow writes.

## Verify auth before burning budget

Always include a one-call smoke test after the apiKeyHelper write step. Disable `set -e` around the smoke since `claude -p` exits 1 on auth failure and would silently kill the step under errexit:

```bash
set +e
smoke=$(claude -p --max-turns 1 --output-format json --no-session-persistence \
  "respond with OK" 2>&1)
smoke_exit=$?
set -e

echo "claude smoke exit: $smoke_exit"
printf '%s\n' "$smoke" | head -c 400

if [ "$smoke_exit" -ne 0 ] || \
   printf '%s' "$smoke" | jq -e '.is_error == true' >/dev/null 2>&1; then
  echo "::error::Auth smoke test failed"
  exit 1
fi
```

The smoke test runs once per workflow invocation and catches auth breaks at the START of the job — not 10 PRs later when you've wasted classifier runs on every failure.

## When upstream fixes it

The fix would let `--bare` honor `ANTHROPIC_API_KEY` per the help text. When that lands, revert this rule's "do this" block to use `--bare` (saves ~60% of token cost per invocation). Anchor the revert PR on the upstream issue closure.

## Reproducer

All three fail. All from the same fresh-HOME state to rule out cached OAuth state:

```bash
TMPH=$(mktemp -d)
KEY="sk-ant-..."

# Path 1: ANTHROPIC_API_KEY env var
HOME=$TMPH ANTHROPIC_API_KEY=$KEY claude -p --bare \
  --max-turns 1 --output-format json "hi"

# Path 2: apiKey via --settings
echo "{\"apiKey\":\"$KEY\"}" > $TMPH/s.json
HOME=$TMPH claude -p --bare --settings $TMPH/s.json \
  --max-turns 1 --output-format json "hi"

# Path 3: apiKeyHelper via --settings
echo "{\"apiKeyHelper\":\"echo $KEY\"}" > $TMPH/s.json
HOME=$TMPH claude -p --bare --settings $TMPH/s.json \
  --max-turns 1 --output-format json "hi"
```

All three: `{"is_error":true,"result":"Not logged in · Please run /login"}`.

Same env var **without** `--bare` (and with apiKeyHelper written to `~/.claude/settings.json`) works:

```bash
HOME=$TMPH ANTHROPIC_API_KEY=$KEY claude -p \
  --max-turns 1 --output-format json "hi"
# → {"is_error":false, "result":"Hi there, friend."}
```
