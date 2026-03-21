---
title: Use --bare for grading/classification only
impact: MEDIUM
impactDescription: Ensures eval integrity by keeping plugin-routed tests running with full context
tags: [eval, bare, pipeline]
---

# Use --bare for Grading/Classification Only

`--bare` should only be used for calls that don't need plugin context.

## Bare-Safe Calls

- Assertion grading (batch or per-assertion)
- Trigger classification (skill matching)
- Description optimization
- Force-skill eval (`--append-system-prompt`)
- Baseline comparison (no plugin)

## Never-Bare Calls

- `run_with_skill` — tests plugin routing and skill loading
- Agent eval generation — tests agent spawning via plugin
- Any call using `--plugin-dir`

## Incorrect

```bash
# BAD: run_with_skill with --bare defeats the purpose of testing plugin routing
build_claude_flags() {
    flags+=(--bare)  # Wrong — this function is called with include_plugin=true
    flags+=(--plugin-dir "$PLUGIN_DIR")
}
```

## Correct

```bash
# GOOD: only add --bare when NOT using plugins
build_claude_flags() {
    local include_plugin="$1"
    if [[ "$include_plugin" == "true" ]]; then
        flags+=(--plugin-dir "$PLUGIN_DIR")
    elif [[ "$BARE_MODE" == "true" ]]; then
        flags+=(--bare)
    fi
}
```

## Why

The eval pipeline's value comes from testing skills in their real environment. `--bare` is for the grading/classification overhead calls, not the core eval itself.
