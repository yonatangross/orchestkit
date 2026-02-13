---
title: Context Optimization Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Compression (compression) — HIGH — 3 rules

Context compression strategies for reducing token usage while preserving critical information.

- `compression-summarization.md` — Anchored iterative summarization with forced sections and incremental merge
- `compression-pruning.md` — Compression triggers, thresholds, effective context window calculation
- `compression-chunking.md` — Probe-based evaluation, quality validation, target metrics

## 2. Engineering (engineering) — HIGH — 3 rules

Context engineering for attention-aware positioning and budget management.

- `engineering-system-prompts.md` — Five context layers, system prompt design, tool definition patterns
- `engineering-few-shot.md` — Just-in-time loading, token budget calculator, skill budget scaling
- `engineering-chain-of-thought.md` — Lost-in-the-middle phenomenon, attention-aware positioning, template structure
