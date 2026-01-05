---
name: context-compression
description: Use when conversation context is too long, hitting token limits, or responses are degrading. Compresses history while preserving critical information using anchored summarization and probe-based validation.
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [context, compression, summarization, memory, optimization, 2026]
---

# Context Compression

**Reduce context size while preserving information critical to task completion.**

## Overview

Context compression is essential for long-running agent sessions. The goal is NOT maximum compression—it's preserving enough information to complete tasks without re-fetching.

**Key Metric:** Tokens-per-task (total tokens to complete a task), NOT tokens-per-request.

## When to Use

- Long-running conversations approaching context limits
- Multi-step agent workflows with accumulating history
- Sessions with large tool outputs
- Memory management in persistent agents

---

## Three Compression Strategies

### 1. Anchored Iterative Summarization (RECOMMENDED)

Maintains structured, persistent summaries with forced sections:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ANCHORED SUMMARY STRUCTURE                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ## Session Intent                                                  │
│  [What we're trying to accomplish - NEVER lose this]                │
│                                                                     │
│  ## Files Modified                                                  │
│  - path/to/file.ts: Added function X, modified class Y              │
│  - path/to/other.py: Fixed bug in method Z                          │
│                                                                     │
│  ## Decisions Made                                                  │
│  - Decision 1: Chose X over Y because [rationale]                   │
│  - Decision 2: Deferred Z until [condition]                         │
│                                                                     │
│  ## Current State                                                   │
│  [Where we are in the task - progress indicator]                    │
│                                                                     │
│  ## Blockers / Open Questions                                       │
│  - Question 1: Awaiting user input on...                            │
│                                                                     │
│  ## Next Steps                                                      │
│  1. Complete X                                                      │
│  2. Test Y                                                          │
│  3. Deploy Z                                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why it works:**
- Structure FORCES preservation of critical categories
- Each section must be explicitly populated (can't silently drop info)
- Incremental merge (new compressions extend, don't replace)

### 2. Opaque Compression

Maximum compression for reconstruction, sacrificing readability:

```python
# Produces highly compressed representation
compressed = llm.compress(
    history,
    target="reconstruct_state",
    max_tokens=500
)
# Output: Dense, not human-readable, but reconstructable
```

**Trade-offs:**
- ✅ 99%+ compression ratios possible
- ❌ Cannot verify what's preserved
- ❌ Not interpretable by humans
- ⚠️ Risk of losing critical details silently

**Use only when:** Storage is critical and verification isn't needed.

### 3. Regenerative Full Summary

Creates fresh summary on each compression cycle:

```python
# Regenerates complete summary each time
summary = llm.summarize(
    history,
    style="comprehensive",
    sections=["intent", "progress", "decisions"]
)
```

**Trade-offs:**
- ✅ Readable, structured output
- ❌ Detail loss across repeated compressions
- ❌ Each regeneration may drop different details
- ⚠️ "Telephone game" effect over multiple cycles

---

## Anchored Summarization Implementation

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

    # Metadata
    compression_count: int = 0
    last_compressed_at: Optional[str] = None
    tokens_before: int = 0
    tokens_after: int = 0

    def merge(self, new_content: "AnchoredSummary") -> "AnchoredSummary":
        """Incrementally merge new summary into existing."""
        return AnchoredSummary(
            session_intent=new_content.session_intent or self.session_intent,
            files_modified={**self.files_modified, **new_content.files_modified},
            decisions_made=self.decisions_made + new_content.decisions_made,
            current_state=new_content.current_state,  # Replace with latest
            blockers=new_content.blockers,  # Replace with current
            next_steps=new_content.next_steps,  # Replace with current
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


def compress_with_anchor(
    messages: list[dict],
    existing_summary: Optional[AnchoredSummary],
    llm: Any
) -> AnchoredSummary:
    """
    Compress messages using anchored summarization.

    Only summarizes NEW messages since last compression,
    then merges with existing summary.
    """

    prompt = f"""
    Analyze these conversation messages and extract structured information.

    MESSAGES:
    {format_messages(messages)}

    Extract into these REQUIRED sections (all must have content):

    1. SESSION_INTENT: What is the user trying to accomplish?
    2. FILES_MODIFIED: List each file path and what changed
    3. DECISIONS_MADE: Key decisions with rationale
    4. CURRENT_STATE: Where are we in the task?
    5. BLOCKERS: Any open questions or blockers?
    6. NEXT_STEPS: What needs to happen next?

    Respond in JSON format matching AnchoredSummary schema.
    """

    response = llm.generate(prompt)
    new_summary = AnchoredSummary(**parse_json(response))

    if existing_summary:
        return existing_summary.merge(new_summary)

    return new_summary
```

---

## Compression Triggers

### Sliding Window Approach

```python
class CompressionManager:
    def __init__(
        self,
        trigger_threshold: float = 0.70,  # Compress at 70% capacity
        target_threshold: float = 0.50,   # Compress down to 50%
        preserve_recent: int = 5,         # Keep last N messages uncompressed
        min_messages_to_compress: int = 10,
    ):
        self.trigger = trigger_threshold
        self.target = target_threshold
        self.preserve_recent = preserve_recent
        self.min_messages = min_messages_to_compress

    def should_compress(self, messages: list, context_budget: int) -> bool:
        """Check if compression should trigger."""
        current_tokens = count_tokens(messages)
        utilization = current_tokens / context_budget

        return (
            utilization >= self.trigger and
            len(messages) >= self.min_messages
        )

    def compress(
        self,
        messages: list,
        existing_summary: Optional[AnchoredSummary],
        llm: Any
    ) -> tuple[AnchoredSummary, list]:
        """
        Compress older messages, preserve recent ones.

        Returns: (updated_summary, preserved_messages)
        """
        # Split messages
        to_compress = messages[:-self.preserve_recent]
        to_preserve = messages[-self.preserve_recent:]

        # Compress older messages
        new_summary = compress_with_anchor(to_compress, existing_summary, llm)

        return new_summary, to_preserve
```

---

## Probe-Based Evaluation

**Don't use ROUGE/BLEU—test functional preservation:**

```python
class CompressionProbes:
    """
    Test whether compression preserved task-critical information.

    Probes are questions that MUST be answerable from compressed context.
    """

    @staticmethod
    def generate_probes(original_messages: list) -> list[dict]:
        """Generate probes from original content."""
        probes = []

        # File path probes
        for msg in original_messages:
            if "file" in msg.get("content", "").lower():
                paths = extract_file_paths(msg["content"])
                for path in paths:
                    probes.append({
                        "type": "file_path",
                        "question": f"What changes were made to {path}?",
                        "expected_contains": path,
                    })

        # Decision probes
        for msg in original_messages:
            if any(word in msg.get("content", "").lower()
                   for word in ["decided", "chose", "will use", "going with"]):
                probes.append({
                    "type": "decision",
                    "question": "What key decisions were made?",
                    "expected_contains": extract_decision_keywords(msg["content"]),
                })

        # Error/blocker probes
        for msg in original_messages:
            if any(word in msg.get("content", "").lower()
                   for word in ["error", "failed", "blocked", "issue"]):
                probes.append({
                    "type": "blocker",
                    "question": "What errors or blockers were encountered?",
                    "expected_contains": extract_error_keywords(msg["content"]),
                })

        return probes

    @staticmethod
    def evaluate_compression(
        probes: list[dict],
        compressed_summary: str,
        llm: Any
    ) -> dict:
        """
        Evaluate if compressed summary can answer probes.

        Returns score and failed probes.
        """
        results = {"passed": 0, "failed": 0, "failed_probes": []}

        for probe in probes:
            # Ask LLM to answer probe from compressed context
            answer = llm.generate(f"""
            Based ONLY on this context:
            {compressed_summary}

            Answer: {probe['question']}
            """)

            # Check if expected content is present
            if probe["expected_contains"].lower() in answer.lower():
                results["passed"] += 1
            else:
                results["failed"] += 1
                results["failed_probes"].append(probe)

        results["score"] = results["passed"] / max(len(probes), 1)
        return results
```

---

## Integration with SkillForge

### In shared-context.json

```json
{
  "compression_state": {
    "summary": {
      "session_intent": "Implement user authentication",
      "files_modified": {
        "src/auth/login.ts": ["Added OAuth flow", "Fixed token refresh"],
        "src/api/users.ts": ["Added getCurrentUser endpoint"]
      },
      "decisions_made": [
        {"decision": "Use JWT over sessions", "rationale": "Stateless, scales better"}
      ],
      "current_state": "OAuth flow complete, testing token refresh",
      "next_steps": ["Add refresh token rotation", "Write E2E tests"]
    },
    "compression_count": 3,
    "last_compressed_at": "2026-01-05T10:30:00Z",
    "probe_score": 0.95
  }
}
```

### With TodoWrite

Compression integrates with task tracking:

```python
def compress_and_update_todos(
    messages: list,
    todos: list[dict],
    summary: AnchoredSummary
) -> tuple[AnchoredSummary, list[dict]]:
    """
    Compress messages and sync with todo state.

    Completed todos become part of summary's "decisions made".
    """
    # Extract completed work from messages
    new_summary = compress_with_anchor(messages, summary, llm)

    # Mark todos completed if mentioned in compression
    for todo in todos:
        if todo["status"] == "in_progress":
            if todo["content"].lower() in new_summary.current_state.lower():
                todo["status"] = "completed"

    return new_summary, todos
```

---

## Best Practices

### DO

- ✅ Use anchored summarization with forced sections
- ✅ Preserve recent messages uncompressed (context continuity)
- ✅ Test compression with probes, not similarity metrics
- ✅ Merge incrementally (don't regenerate from scratch)
- ✅ Track compression count and quality scores

### DON'T

- ❌ Compress system prompts (keep at START)
- ❌ Use opaque compression for critical workflows
- ❌ Compress below the point of task completion
- ❌ Trigger compression opportunistically (use fixed thresholds)
- ❌ Optimize for compression ratio over task success

---

## Compression Decision Tree

```
                    ┌─────────────────────┐
                    │ Context > 70%       │
                    │ capacity?           │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │ NO                              │ YES
              ▼                                 ▼
    ┌─────────────────┐              ┌─────────────────────┐
    │ Continue        │              │ Messages > 10?      │
    │ without         │              └──────────┬──────────┘
    │ compression     │                         │
    └─────────────────┘              ┌──────────┴──────────┐
                                     │ NO                  │ YES
                                     ▼                     ▼
                           ┌─────────────────┐   ┌─────────────────┐
                           │ Wait for more   │   │ COMPRESS        │
                           │ messages        │   │                 │
                           └─────────────────┘   │ 1. Keep last 5  │
                                                 │ 2. Summarize    │
                                                 │    rest         │
                                                 │ 3. Run probes   │
                                                 │ 4. Merge with   │
                                                 │    existing     │
                                                 └─────────────────┘
```

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
