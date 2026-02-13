---
title: "Compression: Anchored Summarization"
category: compression
impact: HIGH
impactDescription: Anchored summarization preserves critical information through structured forced sections
tags: [compression, summarization, anchored, forced-sections, incremental-merge]
---

# Anchored Summarization (Recommended)

Maintains structured, persistent summaries with forced sections:

```
## Session Intent
[What we're trying to accomplish - NEVER lose this]

## Files Modified
- path/to/file.ts: Added function X, modified class Y

## Decisions Made
- Decision 1: Chose X over Y because [rationale]

## Current State
[Where we are in the task - progress indicator]

## Blockers / Open Questions
- Question 1: Awaiting user input on...

## Next Steps
1. Complete X
2. Test Y
```

## Implementation

```python
@dataclass
class AnchoredSummary:
    session_intent: str
    files_modified: dict[str, list[str]] = field(default_factory=dict)
    decisions_made: list[dict] = field(default_factory=list)
    current_state: str = ""
    blockers: list[str] = field(default_factory=list)
    next_steps: list[str] = field(default_factory=list)
    compression_count: int = 0

    def merge(self, new_content: "AnchoredSummary") -> "AnchoredSummary":
        return AnchoredSummary(
            session_intent=new_content.session_intent or self.session_intent,
            files_modified={**self.files_modified, **new_content.files_modified},
            decisions_made=self.decisions_made + new_content.decisions_made,
            current_state=new_content.current_state,
            blockers=new_content.blockers,
            next_steps=new_content.next_steps,
            compression_count=self.compression_count + 1,
        )
```

## Why It Works

- Structure **forces** preservation of critical categories
- Each section must be explicitly populated (can't silently drop info)
- Incremental merge (new compressions extend, not replace)
- Avoids "telephone game" degradation of regenerative approaches

## Strategy Comparison

| Strategy | Compression | Verifiable | Best For |
|----------|-------------|------------|----------|
| Anchored Iterative | 60-80% | Yes | Long sessions |
| Sliding Window | 50-70% | Yes | Real-time chat |
| Regenerative | 70-85% | Partial | Simple tasks |
| Opaque | 95-99% | No | Storage-critical |
