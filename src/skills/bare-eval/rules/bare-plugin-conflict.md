---
title: Never combine --bare with --plugin-dir
impact: HIGH
impactDescription: --bare skips plugin sync, making --plugin-dir silently ineffective
tags: [eval, bare, safety]
---

# Never Combine --bare with --plugin-dir

`--bare` explicitly skips plugin sync and skill directory walks. Adding `--plugin-dir` alongside it creates a silent conflict — the plugin may not load correctly.

## Incorrect

```bash
# BAD: --bare + --plugin-dir is contradictory
claude -p "$prompt" --bare --plugin-dir plugins/ork --output-format json
```

## Correct

```bash
# For plugin-routed tests: no --bare
claude -p "$prompt" --plugin-dir plugins/ork --dangerously-skip-permissions --output-format json

# For grading/classification: --bare, no --plugin-dir
claude -p "$prompt" --bare --max-turns 1 --output-format text
```

## Why

The `--bare` flag was designed for scripted `-p` calls that don't need the full Claude Code environment. Using it with `--plugin-dir` defeats the purpose and may cause unpredictable behavior since hooks and skill discovery are disabled.
