# Priority Management Reference

Context prioritization, eviction policies, and compression triggers.

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

## CC 2.1.7: Effective Context Window

### Static vs Effective Context

CC 2.1.7 introduces the concept of **effective context window** - the actual usable space after system overhead:

```
STATIC CONTEXT WINDOW (Theoretical Maximum)
  200,000 tokens

EFFECTIVE CONTEXT WINDOW (Actual Usable)
  ~160,000 tokens (after system overhead)

YOUR CONTEXT BUDGET (SkillForge Managed)
  2,200 tokens (for context layer files)
```

### Updated Compression Triggers

| Trigger | Static (CC 2.1.6) | Effective (CC 2.1.7) |
|---------|-------------------|----------------------|
| MCP Defer | N/A | 10% of effective |
| Warning | 60% of static | 60% of effective |
| Compress | 70% of static | 70% of effective |
| Critical | 90% of static | 90% of effective |

### Calculating Against Effective Window

```python
def calculate_effective_usage(tokens_used: int) -> float:
    # CC 2.1.7: Use effective window for more accurate percentage
    effective_window = os.environ.get("CLAUDE_EFFECTIVE_CONTEXT", 160000)
    return (tokens_used / effective_window) * 100
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
        """Evaluate if compressed summary can answer probes."""
        results = {"passed": 0, "failed": 0, "failed_probes": []}

        for probe in probes:
            answer = llm.generate(f"""
            Based ONLY on this context:
            {compressed_summary}

            Answer: {probe['question']}
            """)

            if probe["expected_contains"].lower() in answer.lower():
                results["passed"] += 1
            else:
                results["failed"] += 1
                results["failed_probes"].append(probe)

        results["score"] = results["passed"] / max(len(probes), 1)
        return results
```

---

## Compression Decision Tree

```
                    +---------------------+
                    | Context > 70%       |
                    | capacity?           |
                    +----------+----------+
                               |
              +----------------+----------------+
              | NO                              | YES
              v                                 v
    +-----------------+              +---------------------+
    | Continue        |              | Messages > 10?      |
    | without         |              +----------+----------+
    | compression     |                         |
    +-----------------+              +----------+----------+
                                     | NO                  | YES
                                     v                     v
                           +-----------------+   +-----------------+
                           | Wait for more   |   | COMPRESS        |
                           | messages        |   |                 |
                           +-----------------+   | 1. Keep last 5  |
                                                 | 2. Summarize    |
                                                 |    rest         |
                                                 | 3. Run probes   |
                                                 | 4. Merge with   |
                                                 |    existing     |
                                                 +-----------------+
```

---

## Integration with SkillForge

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
    new_summary = compress_with_anchor(messages, summary, llm)

    for todo in todos:
        if todo["status"] == "in_progress":
            if todo["content"].lower() in new_summary.current_state.lower():
                todo["status"] = "completed"

    return new_summary, todos
```

---

## Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Probe pass rate | >90% | <70% |
| Compression ratio | 60-80% | >95% (too aggressive) |
| Task completion | Same as uncompressed | Degraded |
| Latency overhead | <2s | >5s |

---

## Related References

- `compression-strategies.md` - Detailed strategy comparisons
- `../templates/anchored-summary-template.md` - Template for structured summaries
- `../checklists/compression-checklist.md` - When and how to compress