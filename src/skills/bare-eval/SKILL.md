---
name: bare-eval
description: "Run isolated eval and grading calls using CC 2.1.81 --bare mode. Constructs claude -p --bare invocations for skill evaluation, trigger testing, and LLM grading without plugin/hook interference. Use when running eval pipelines, grading skill outputs, benchmarking prompt quality, or testing trigger accuracy in isolation."
tags: [eval, bare, grading, pipeline, testing, ci]
version: 1.0.0
author: OrchestKit
user-invocable: false
complexity: medium
context: inherit
persuasion-type: discipline
effort: low
---

# Bare Eval — Isolated Evaluation Calls

Run `claude -p --bare` for fast, clean eval/grading without plugin overhead.

**CC 2.1.81 required.** The `--bare` flag skips hooks, LSP, plugin sync, and skill directory walks.

## When to Use

- Grading skill outputs against assertions
- Trigger classification (which skill matches a prompt)
- Description optimization iterations
- Any scripted `-p` call that doesn't need plugins

## When NOT to Use

- Testing skill routing (needs `--plugin-dir`)
- Testing agent orchestration (needs full plugin context)
- Interactive sessions

## Prerequisites

```bash
# --bare requires ANTHROPIC_API_KEY (OAuth/keychain disabled)
export ANTHROPIC_API_KEY="sk-ant-..."

# Verify CC version
claude --version  # Must be >= 2.1.81
```

## Quick Reference

| Call Type | Command Pattern |
|-----------|----------------|
| Grading | `claude -p "$prompt" --bare --max-turns 1 --output-format text` |
| Trigger | `claude -p "$prompt" --bare --json-schema "$schema" --output-format json` |
| Optimize | `echo "$prompt" \| claude -p --bare --max-turns 1 --output-format text` |
| Force-skill | `claude -p "$prompt" --bare --print --append-system-prompt "$content"` |

## Invocation Patterns

Load detailed patterns and examples:

```
Read("${CLAUDE_SKILL_DIR}/references/invocation-patterns.md")
```

## Grading Schemas

JSON schemas for structured eval output:

```
Read("${CLAUDE_SKILL_DIR}/references/grading-schemas.md")
```

## Pipeline Integration

OrchestKit's eval scripts (`npm run eval:skill`) auto-detect bare mode:

```bash
# eval-common.sh detects ANTHROPIC_API_KEY → sets BARE_MODE=true
# Scripts add --bare to all non-plugin calls automatically
```

**Bare calls:** Trigger classification, force-skill, baseline, all grading.
**Never bare:** `run_with_skill` (needs plugin context for routing tests).

## Performance

| Scenario | Without --bare | With --bare | Savings |
|----------|---------------|-------------|---------|
| Single grading call | ~3-5s startup | ~0.5-1s | 2-4x |
| Trigger (per prompt) | ~3-5s | ~0.5-1s | 2-4x |
| Full eval (50 calls) | ~150-250s overhead | ~25-50s | 3-5x |

## Rules

```
Read("${CLAUDE_SKILL_DIR}/rules/_sections.md")
```

## Troubleshooting

```
Read("${CLAUDE_SKILL_DIR}/references/troubleshooting.md")
```

## Related

- `eval:skill` npm script — unified skill evaluation runner
- `eval:trigger` — trigger accuracy testing
- `eval:quality` — A/B quality comparison
- `optimize-description.sh` — iterative description improvement
- Version compatibility: `doctor/references/version-compatibility.md`
