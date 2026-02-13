# Anchored Summarization Reference

Implementation patterns for structured, incremental context compression with forced sections.

---

## Overview

Anchored summarization maintains structured, persistent summaries that prevent silent information loss. The "anchored" aspect refers to forced sections that must always be populated, ensuring critical categories of information survive compression.

---

## Forced Sections Template

```markdown
## Session Intent
[REQUIRED - What are we trying to accomplish?]

## Files Modified
[REQUIRED - Path: changes made]

## Decisions Made
[REQUIRED - Decision + rationale]

## Current State
[REQUIRED - Where are we now?]

## Blockers / Open Questions
[OPTIONAL - What's blocking progress?]

## Next Steps
[REQUIRED - What's next?]
```

Each section MUST be populated. This prevents silent information loss during compression.

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
            "## Files Modified\n" + "\n".join(
                f"- `{path}`: {', '.join(changes)}"
                for path, changes in self.files_modified.items()
            ),
            "## Decisions Made\n" + "\n".join(
                f"- **{d['decision']}**: {d['rationale']}"
                for d in self.decisions_made
            ),
            f"## Current State\n{self.current_state}",
        ]
        if self.blockers:
            sections.append("## Blockers\n" + "\n".join(f"- {b}" for b in self.blockers))
        sections.append("## Next Steps\n" + "\n".join(
            f"{i+1}. {step}" for i, step in enumerate(self.next_steps)
        ))
        return "\n\n".join(sections)
```

---

## Merge vs Regenerate

### The Telephone Game Problem

Regenerating summaries from scratch causes progressive detail loss:

```
Compression 1: "User wants to implement OAuth with JWT for stateless auth"
Compression 2: "User is working on authentication"
Compression 3: "User needs help with login"
Compression 4: "User has a question"
```

### Why Merge Works Better

```python
# BAD: Regenerate from scratch
def compress_bad(all_messages):
    return llm.summarize(all_messages)  # Loses detail each time!

# GOOD: Merge incrementally
def compress_good(new_messages, existing_summary):
    new_summary = llm.summarize(new_messages)  # Only new content
    return merge_summaries(existing_summary, new_summary)  # Preserve old
```

Incremental merging preserves old information because:
1. The existing summary is never re-summarized
2. Only new messages are compressed
3. The merge operation extends existing sections rather than replacing them
4. Session intent is only updated if the new content provides a better version

---

## Integration with OrchestKit State

### In session/state.json (Context Protocol 2.0)

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

### With Task Tracking

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
    new_summary = compress_with_anchor(messages, summary, llm)

    for todo in todos:
        if todo["status"] == "in_progress":
            if todo["content"].lower() in new_summary.current_state.lower():
                todo["status"] = "completed"

    return new_summary, todos
```

---

## Best Practices

### DO
- Populate ALL forced sections on every compression
- Merge incrementally (extend, don't replace)
- Track compression count and quality scores
- Preserve session intent across all compressions
- Include rationale with every decision

### DON'T
- Regenerate summaries from scratch
- Drop sections that seem "empty" (mark as N/A instead)
- Compress system prompts into the summary
- Merge unrelated sessions into one summary
