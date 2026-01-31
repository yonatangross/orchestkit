---
name: context-compression
description: Use when conversation context is too long, hitting token limits, or responses are degrading. Compresses history while preserving critical information using anchored summarization and probe-based validation.
context: fork
version: 1.0.0
author: OrchestKit AI Agent Hub
tags: [context, compression, summarization, memory, optimization, 2026]
user-invocable: false
---

# Context Compression

**Reduce context size while preserving information critical to task completion.**

## Overview

Context compression is essential for long-running agent sessions. The goal is NOT maximum compression—it's preserving enough information to complete tasks without re-fetching.

**Key Metric:** Tokens-per-task (total tokens to complete a task), NOT tokens-per-request.

## Overview

- Long-running conversations approaching context limits
- Multi-step agent workflows with accumulating history
- Sessions with large tool outputs
- Memory management in persistent agents

---

## Strategy Quick Reference

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

**Why it works:**
- Structure FORCES preservation of critical categories
- Each section must be explicitly populated (can't silently drop info)
- Incremental merge (new compressions extend, don't replace)

---

## Implementation

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class AnchoredSummary:
    """Structured summary with forced sections."""

    session_intent: str
    files_modified: dict[str, list[str]] = field(default_factory=dict)
    decisions_made: list[dict] = field(default_factory=list)
    current_state: str = ""
    blockers: list[str] = field(default_factory=list)
    next_steps: list[str] = field(default_factory=list)
    compression_count: int = 0

    def merge(self, new_content: "AnchoredSummary") -> "AnchoredSummary":
        """Incrementally merge new summary into existing."""
        return AnchoredSummary(
            session_intent=new_content.session_intent or self.session_intent,
            files_modified={**self.files_modified, **new_content.files_modified},
            decisions_made=self.decisions_made + new_content.decisions_made,
            current_state=new_content.current_state,
            blockers=new_content.blockers,
            next_steps=new_content.next_steps,
            compression_count=self.compression_count + 1,
        )

    def to_markdown(self) -> str:
        """Render as markdown for context injection."""
        sections = [
            f"## Session Intent\n{self.session_intent}",
            f"## Files Modified\n" + "\n".join(
                f"- `{path}`: {', '.join(changes)}"
                for path, changes in self.files_modified.items()
            ),
            f"## Decisions Made\n" + "\n".join(
                f"- **{d['decision']}**: {d['rationale']}"
                for d in self.decisions_made
            ),
            f"## Current State\n{self.current_state}",
        ]
        if self.blockers:
            sections.append(f"## Blockers\n" + "\n".join(f"- {b}" for b in self.blockers))
        sections.append(f"## Next Steps\n" + "\n".join(
            f"{i+1}. {step}" for i, step in enumerate(self.next_steps)
        ))
        return "\n\n".join(sections)
```

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
| Warning | 60% of static | 60% of effective |
| Compress | 70% of static | 70% of effective |
| Critical | 90% of static | 90% of effective |

---

## Best Practices

### DO
- Use anchored summarization with forced sections
- Preserve recent messages uncompressed (context continuity)
- Test compression with probes, not similarity metrics
- Merge incrementally (don't regenerate from scratch)
- Track compression count and quality scores

### DON'T
- Compress system prompts (keep at START)
- Use opaque compression for critical workflows
- Compress below the point of task completion
- Trigger compression opportunistically (use fixed thresholds)
- Optimize for compression ratio over task success

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

- **[Compression Strategies](references/compression-strategies.md)**: Detailed comparison of all strategies (anchored, opaque, regenerative, sliding window), implementation patterns, and decision flowcharts
- **[Priority Management](references/priority-management.md)**: Compression triggers, CC 2.1.7 effective context, probe-based evaluation, OrchestKit integration

## Bundled Resources

- `assets/anchored-summary-template.md` - Template for structured compression summaries with forced sections
- `assets/compression-probes-template.md` - Probe templates for validating compression quality
- `references/compression-strategies.md` - Detailed strategy comparisons
- `references/priority-management.md` - Compression triggers and evaluation

---

## Related Skills

- `context-engineering` - Attention mechanics and positioning
- `memory-systems` - Persistent storage patterns
- `multi-agent-orchestration` - Context isolation across agents
- `observability-monitoring` - Tracking compression metrics

---

**Version:** 1.0.0 (January 2026)
**Key Principle:** Optimize for tokens-per-task, not tokens-per-request
**Recommended Strategy:** Anchored Iterative Summarization with probe-based evaluation

---

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