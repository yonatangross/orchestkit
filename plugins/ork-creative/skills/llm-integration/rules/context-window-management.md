---
title: Manage context windows to avoid wasting 80 percent of token budget on irrelevant content
impact: HIGH
impactDescription: "Mismanaged context windows waste 80% of token budget and degrade LLM task completion"
tags: context, tokens, compression, attention, lost-in-the-middle
---

## Context Window Management

**Incorrect -- context-unaware prompting:**
```python
# Stuffing entire conversation into context without structure
messages = full_history + retrieved_docs + system_prompt
response = llm.chat(messages)  # Hits limits, "lost in the middle" recall drops to 10-40%
```

**Correct -- attention-aware context layering:**
```python
# Five-layer context architecture with attention-aware positioning
ALLOCATIONS = {
    "agent": {
        "system": 0.10,       # 10% — START (high attention)
        "tools": 0.15,        # 15% — START
        "history": 0.30,      # 30% — MIDDLE (compressible)
        "retrieval": 0.25,    # 25% — MIDDLE (just-in-time)
        "observations": 0.20, # 20% — END (high attention)
    },
}

# Compression triggers
COMPRESS_AT = 0.70   # 70% utilization
TARGET_AFTER = 0.50  # 50% utilization after compression
MIN_MESSAGES = 10    # Minimum before compressing
PRESERVE_LAST = 5    # Always keep last 5 uncompressed
```

**Correct -- anchored iterative summarization (recommended):**
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

Key principles:
- Position critical info at START and END of context (high attention zones)
- Middle of context has 10-40% recall rate — place background/optional info there
- Merge summaries incrementally, never regenerate from scratch (avoids "telephone game" detail loss)
- Truncate tool outputs at source — they can consume 83.9% of total context
- Optimize for tokens-per-task, not tokens-per-request
