---
title: Always check ANTHROPIC_API_KEY before using --bare
impact: HIGH
impactDescription: --bare disables OAuth and keychain auth — API key is the only auth method
tags: [eval, bare, auth]
---

# Always Check ANTHROPIC_API_KEY Before --bare

`--bare` disables OAuth and keychain auth. If `ANTHROPIC_API_KEY` is not set, the call will fail.

## Incorrect

```bash
# BAD: no API key check before --bare
claude -p "$prompt" --bare --max-turns 1 --output-format text
```

## Correct

```bash
# GOOD: conditional bare mode
BARE_MODE=false
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    BARE_MODE=true
fi

local -a bare_flag=()
if [[ "$BARE_MODE" == "true" ]]; then bare_flag=(--bare); fi

claude -p "$prompt" "${bare_flag[@]}" --max-turns 1 --output-format text
```

## Why

Users authenticating via `claude auth login` (OAuth) or macOS keychain won't have `ANTHROPIC_API_KEY` set. Using `--bare` unconditionally would break their eval pipeline. The conditional pattern degrades gracefully — eval still works, just slower.
