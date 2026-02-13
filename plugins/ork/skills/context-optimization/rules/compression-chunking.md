---
title: "Compression: Probe-Based Evaluation"
category: compression
impact: HIGH
impactDescription: Probe evaluation validates compression quality with functional tests not similarity metrics
tags: [compression, evaluation, probes, quality, validation, metrics]
---

# Probe-Based Evaluation

## Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Probe pass rate | >90% | <70% |
| Compression ratio | 60-80% | >95% (too aggressive) |
| Task completion | Same as uncompressed | Degraded |
| Latency overhead | <2s | >5s |

## How Probes Work

Generate questions from the compressed content that test functional preservation:

1. **File probes**: "What files were modified?" -> Should list all files
2. **Decision probes**: "Why did we choose X?" -> Should recall rationale
3. **State probes**: "What's the current status?" -> Should report progress
4. **Error probes**: "What errors occurred?" -> Should recall blockers

## Best Practices

- Use functional probes, NOT similarity metrics (ROUGE/BLEU)
- Test task completion with compressed context
- Generate probes from file paths, decisions, and errors
- Track probe pass rate across compression cycles
- Re-expand if probe pass rate drops below 70%

## Anti-Pattern

Aggressive compression that loses critical details forces expensive re-fetching, consuming MORE tokens overall. Optimize for tokens-per-task, not tokens-per-request.
