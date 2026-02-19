---
title: Phase Ordering Priorities
impact: HIGH
impactDescription: "Wrong ordering loses the highest-value work first when rate limits hit"
tags: [checkpoint, ordering, resilience]
---

# Phase Ordering Priorities

## Rule

Always order phases so that the work hardest to reconstruct runs first.

## Priority Order

1. **GitHub issues and commits** — highest-value, hardest to reconstruct; lost first on rate limit
2. **Independent phases** — parallelize with Task sub-agents when no shared dependencies
3. **File-heavy phases** — large writes are recoverable; run these last

## Reasoning

If a rate limit hits mid-session, the state file preserves the checkpoint. But work done BEFORE the last state write is the only work recovered. GitHub issue creation cannot be reconstructed from code — commit SHAs can be re-found but issue comments cannot.

## Application

When building the execution plan, sort phases:
- Issue creation → before → file writes
- Commit phases → before → documentation phases
- Parallelizable phases → grouped → after all their dependencies are complete
