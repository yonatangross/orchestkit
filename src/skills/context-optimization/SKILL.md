---
name: context-optimization
description: Context window optimization patterns for token budget management, context compression, prompt engineering, and context engineering strategies. Use when managing large context windows, optimizing token usage, or engineering effective context for LLM interactions.
tags: [context, optimization, tokens, compression, prompt-engineering, context-window]
context: fork
agent: prompt-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
---

# Context Optimization

**The discipline of managing, compressing, and engineering LLM context windows for maximum effectiveness.**

## Overview

Context optimization unifies two complementary disciplines: **context compression** (reducing context size while preserving critical information) and **context engineering** (curating the smallest high-signal token set that achieves desired outcomes). Together, they ensure agents operate efficiently within token budgets without sacrificing task completion quality.

**Key Metric:** Tokens-per-task (total tokens to complete a task), NOT tokens-per-request.

**Key Insight:** 80% of agent performance variance is explained by token usage. Optimize context efficiency BEFORE switching models.

## When to Use

- Long-running conversations approaching context limits
- Designing agent system prompts and tool definitions
- Optimizing RAG retrieval pipelines
- Multi-step agent workflows with accumulating history
- Sessions with large tool outputs (can reach 83.9% of context)
- Reducing token costs while maintaining quality
- Building multi-agent architectures with context isolation

---

## The "Lost in the Middle" Phenomenon

Models pay unequal attention across the context window:

```
Attention
Strength   HIGH        LOW (10-40% recall)                      HIGH
           START              MIDDLE                             END
```

| Position | Recall Rate | Best For |
|----------|-------------|----------|
| First 10% | 85-95% | Identity, constraints, critical rules |
| Middle 50% | 10-40% | Background context, optional details |
| Last 20% | 80-95% | Current task, recent messages, output format |

---

## The Five Context Layers

```
Layer 1: System Prompt        (~5-10% of budget)   Identity, constraints
Layer 2: Tool Definitions     (~5-15% of budget)   Capabilities, trigger conditions
Layer 3: Retrieved Documents  (~20-30% of budget)  Just-in-time knowledge
Layer 4: Message History      (~30-50% of budget)  Conversation continuity
Layer 5: Tool Outputs         (~10-30% of budget)  Observations (VARIABLE!)
```

**Critical Finding:** Tool outputs can consume 83.9% of total context. Always truncate and structure tool outputs.

---

## Compression Strategy Quick Reference

| Strategy | Compression | Interpretable | Verifiable | Best For |
|----------|-------------|---------------|------------|----------|
| Anchored Iterative | 60-80% | Yes | Yes | Long sessions |
| Opaque | 95-99% | No | No | Storage-critical |
| Regenerative Full | 70-85% | Yes | Partial | Simple tasks |
| Sliding Window | 50-70% | Yes | Yes | Real-time chat |

**Recommended:** Anchored Iterative Summarization with probe-based evaluation.

---

## Anchored Summarization (RECOMMENDED)

Maintains structured, persistent summaries with forced sections:

```markdown
## Session Intent
[What we're trying to accomplish - NEVER lose this]

## Files Modified
- path/to/file.ts: Added function X, modified class Y

## Decisions Made
- Decision 1: Chose X over Y because [rationale]

## Current State
[Where we are in the task - progress indicator]

## Next Steps
1. Complete X
2. Test Y
```

**Key Principle:** Merge incrementally. Never regenerate entire summaries from scratch ("telephone game" problem causes progressive detail loss).

---

## Compression Triggers

| Threshold | Action |
|-----------|--------|
| 70% capacity | Trigger compression |
| 50% capacity | Target after compression |
| 10 messages minimum | Required before compressing |
| Last 5 messages | Always preserve uncompressed |

### CC 2.1.7: Effective Context Window

Calculate against **effective** context (after system overhead):

| Trigger | Static (CC 2.1.6) | Effective (CC 2.1.7) |
|---------|-------------------|----------------------|
| MCP Defer | N/A | 10% of effective |
| Warning | 60% of static | 60% of effective |
| Compress | 70% of static | 70% of effective |
| Critical | 90% of static | 90% of effective |

---

## Context Budget Management

### Token Budget Allocation

```python
ALLOCATIONS = {
    "chat": {
        "system": 0.05,      # 5%
        "tools": 0.05,       # 5%
        "history": 0.60,     # 60%
        "retrieval": 0.20,   # 20%
        "current": 0.10,     # 10%
    },
    "agent": {
        "system": 0.10,      # 10%
        "tools": 0.15,       # 15%
        "history": 0.30,     # 30%
        "retrieval": 0.25,   # 25%
        "observations": 0.20, # 20%
    },
}
```

### CC 2.1.32+ Skill Budget Scaling

CC 2.1.32+ auto-scales skill character budget to 2% of context window:

| Context Window | Skill Budget (2%) |
|---------------|--------------------|
| 200K tokens | ~4,000 tokens |
| 500K tokens | ~10,000 tokens |
| 1M tokens | ~20,000 tokens |

---

## Attention-Aware Positioning

### Template Structure

```markdown
[START - HIGH ATTENTION]
## System Identity & Critical Constraints
Role, expertise, NEVER/ALWAYS rules

[MIDDLE - LOWER ATTENTION]
## Background Context
Retrieved documents, older conversation history

[END - HIGH ATTENTION]
## Current Task
Recent messages, user query, output format instructions
```

### Priority Positioning Rules

1. **Identity & Constraints** -> START (immutable)
2. **Critical instructions** -> START or END
3. **Retrieved documents** -> MIDDLE (expandable)
4. **Conversation history** -> MIDDLE (compressible)
5. **Current query** -> END (always visible)
6. **Output format** -> END (guides generation)

---

## Best Practices

### DO
- Use anchored summarization with forced sections
- Preserve recent messages uncompressed (context continuity)
- Test compression with probes, not similarity metrics (ROUGE/BLEU)
- Merge incrementally (don't regenerate from scratch)
- Truncate tool outputs at source
- Use just-in-time document loading, not pre-loading
- Position critical information at START and END of context

### DON'T
- Compress system prompts (keep at START)
- Use opaque compression for critical workflows
- Compress below the point of task completion
- Optimize for compression ratio over task success
- Pre-load all documentation into context
- Ignore the "lost in the middle" effect

---

## Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Probe pass rate | >90% | <70% |
| Compression ratio | 60-80% | >95% (too aggressive) |
| Task completion | Same as uncompressed | Degraded |
| Latency overhead | <2s | >5s |

---

## References

For detailed implementation and patterns, see:

- **[Compression Strategies](references/compression-strategies.md)**: Detailed comparison of all strategies (anchored, opaque, regenerative, sliding window, importance-weighted)
- **[Anchored Summarization](references/anchored-summarization.md)**: Implementation patterns for structured, incremental compression with forced sections
- **[Compression Triggers](references/compression-triggers.md)**: When to compress, effective context windows, probe-based evaluation
- **[Attention Mechanics](references/attention-mechanics.md)**: Lost-in-the-middle phenomenon, positional encoding, attention patterns by model
- **[Context Layers](references/context-layers.md)**: The five context layers, budget allocation, tool output management
- **[Token Budget Management](references/token-budget-management.md)**: Budget calculators, skill scaling, MCP auto-deferral
- **[Context Positioning](references/context-positioning.md)**: Attention-aware template structure, priority rules, practical prompt optimization

---

## Related Skills

- `multi-agent-orchestration` - Context isolation across agents
- `rag-retrieval` - Optimizing retrieved document context
- `caching` - Reducing redundant context transmission
- `observability-monitoring` - Tracking compression metrics

---

**Version:** 2.0.0 (February 2026)
**Consolidated from:** context-compression, context-engineering
**Key Principle:** Optimize for tokens-per-task, not tokens-per-request
**Key Insight:** 80% of agent performance variance explained by token usage

## Capability Details

### anchored-summarization
**Keywords:** compress, summarize history, context too long, anchored summary
**Solves:**
- Reduce context size while preserving critical information
- Implement structured compression with required sections
- Maintain session intent and decisions through compression

### compression-triggers
**Keywords:** token limit, running out of context, when to compress
**Solves:**
- Determine when to trigger compression (70% utilization)
- Set compression targets (50% utilization)
- Preserve last 5 messages uncompressed

### probe-evaluation
**Keywords:** evaluate compression, test compression, probe
**Solves:**
- Validate compression quality with functional probes
- Test information preservation after compression
- Achieve >90% probe pass rate

### attention-mechanics
**Keywords:** context window, attention, lost in the middle, token budget
**Solves:**
- Understand lost-in-the-middle effect (high attention at START/END)
- Position critical info strategically
- Optimize tokens-per-task not tokens-per-request

### context-layers
**Keywords:** context anatomy, context structure, five layers
**Solves:**
- Understand 5 context layers (system, tools, docs, history, outputs)
- Implement just-in-time document loading
- Manage tool output truncation

### budget-allocation
**Keywords:** token budget, context budget, allocation, skill scaling
**Solves:**
- Allocate tokens across context layers
- Implement compression triggers at 70% utilization
- Target 50% utilization after compression
- Scale skill budgets with CC 2.1.32+ auto-scaling
