# Compression Strategies Reference

Detailed comparison of context compression approaches.

---

## Strategy Comparison Matrix

| Strategy | Compression | Interpretable | Verifiable | Best For |
|----------|-------------|---------------|------------|----------|
| Anchored Iterative | 60-80% | Yes | Yes | Long sessions |
| Opaque | 95-99% | No | No | Storage-critical |
| Regenerative Full | 70-85% | Yes | Partial | Simple tasks |
| Sliding Window | 50-70% | Yes | Yes | Real-time chat |
| Importance Sampling | 60-75% | Partial | Partial | Mixed content |

---

## 1. Anchored Iterative Summarization (RECOMMENDED)

### How It Works

```
Initial Session
────────────────
Messages 1-20: Raw conversation

First Compression (at 70% capacity)
───────────────────────────────────
[Anchored Summary of 1-15]    ← New summary
Messages 16-20: Preserved     ← Recent kept raw

Second Compression (at 70% capacity)
────────────────────────────────────
[Merged Summary of 1-25]      ← Previous summary + new content
Messages 26-30: Preserved     ← Recent kept raw
```

### Key Principle: Merge, Don't Regenerate

```python
# ❌ BAD: Regenerate entire summary
def compress_bad(all_messages):
    return llm.summarize(all_messages)  # Loses detail each time!

# ✅ GOOD: Merge incrementally
def compress_good(new_messages, existing_summary):
    new_summary = llm.summarize(new_messages)  # Only new content
    return merge_summaries(existing_summary, new_summary)  # Preserve old
```

### Forced Sections

The power of anchored summarization comes from **required sections**:

```markdown
## Session Intent
[REQUIRED - What are we trying to accomplish?]

## Files Modified
[REQUIRED - Path: changes made]

## Decisions Made
[REQUIRED - Decision + rationale]

## Current State
[REQUIRED - Where are we now?]

## Next Steps
[REQUIRED - What's next?]
```

Each section MUST be populated—this prevents silent information loss.

### Advantages
- Preserves critical information by structure
- Incremental (no "telephone game" degradation)
- Human-readable and verifiable
- Recoverable (can reconstruct intent)

### Disadvantages
- Requires LLM call for summarization
- Moderate compression ratio (60-80%)
- Latency on compression trigger

---

## 2. Opaque Compression

### How It Works

Produces maximally compressed representation optimized for reconstruction:

```python
compressed = llm.compress(
    messages,
    instruction="Produce the most compact representation that allows "
                "complete reconstruction of conversation state and intent."
)
# Output: Dense, non-human-readable string
```

### Example Output

```
S:auth-impl|F:src/auth.ts+oauth,src/api/users.ts+ep|D:jwt>sess(stateless)|
B:refresh-rotation|N:tests,deploy
```

### Advantages
- Extreme compression (95-99%)
- Preserves maximum information density
- Good for archival/storage

### Disadvantages
- Not human-readable
- Cannot verify what's preserved
- Cannot selectively retrieve
- Risk of reconstruction errors

### When to Use
- Long-term archival only
- When verification isn't needed
- Storage-constrained environments

---

## 3. Regenerative Full Summary

### How It Works

Creates complete fresh summary on each compression cycle:

```python
def compress(all_messages, previous_summary=None):
    # Ignores previous summary, regenerates from scratch
    return llm.summarize(
        messages=all_messages,
        sections=["intent", "progress", "decisions", "state"]
    )
```

### The Telephone Game Problem

```
Compression 1: "User wants to implement OAuth with JWT"
Compression 2: "User is working on authentication"
Compression 3: "User needs help with login"
Compression 4: "User has a question"  ← Critical detail lost!
```

Each regeneration may drop different details, causing progressive degradation.

### Advantages
- Simple to implement
- Produces clean, readable output
- No merge complexity

### Disadvantages
- Detail loss across cycles
- "Telephone game" degradation
- Inconsistent information retention

### When to Use
- Short sessions (few compression cycles)
- When anchor structure isn't needed
- Quick prototyping

---

## 4. Sliding Window (No Summarization)

### How It Works

Simply truncates old messages without summarization:

```python
def compress(messages, window_size=20):
    return messages[-window_size:]  # Keep only recent
```

### Advantages
- Zero latency (no LLM call)
- Deterministic
- Simple implementation

### Disadvantages
- Complete loss of old context
- No preservation of decisions/intent
- Poor for multi-step tasks

### When to Use
- Real-time chat with short context needs
- Simple Q&A without session state
- When latency is critical

---

## 5. Importance-Weighted Sampling

### How It Works

Scores messages by importance, keeps highest-scored:

```python
def compress(messages, keep_count=10):
    scored = [(m, importance_score(m)) for m in messages]
    sorted_msgs = sorted(scored, key=lambda x: -x[1])
    return [m for m, _ in sorted_msgs[:keep_count]]
```

### Importance Signals
- Contains file paths → Higher importance
- Contains decisions ("decided", "chose") → Higher importance
- Contains errors/blockers → Higher importance
- Pure acknowledgment ("ok", "thanks") → Lower importance
- Redundant with other messages → Lower importance

### Advantages
- Preserves important content
- No LLM call required (rule-based)
- Fast execution

### Disadvantages
- May miss implicit importance
- Ordering may be disrupted
- Doesn't synthesize related messages

---

## Hybrid Approach: Anchored + Sliding Window

Combines best of both:

```python
def hybrid_compress(messages, summary, window=5):
    if len(messages) > 20:
        # Compress older messages into summary
        to_compress = messages[:-window]
        new_summary = anchored_summarize(to_compress, summary)

        # Keep recent messages raw
        recent = messages[-window:]

        return new_summary, recent

    return summary, messages
```

### Benefits
- Recent context is preserved exactly
- Older context is summarized (not lost)
- Compression triggers are predictable
- Incremental merging prevents degradation

---

## Compression Quality Metrics

### DON'T Use: Traditional NLP Metrics

```python
# ❌ These don't measure functional preservation
rouge_score = calculate_rouge(summary, original)
bleu_score = calculate_bleu(summary, original)
```

### DO Use: Probe-Based Evaluation

```python
# ✅ Test if critical information is preserved
probes = [
    ("What file was modified?", "src/auth.ts"),
    ("What decision was made about tokens?", "JWT"),
    ("What error occurred?", "timeout"),
]

score = sum(
    1 for question, expected in probes
    if expected.lower() in llm.answer(summary, question).lower()
) / len(probes)
```

### Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Probe pass rate | >90% | <70% |
| Compression ratio | 60-80% | >95% (too aggressive) |
| Task completion | Same as uncompressed | Degraded |
| Latency overhead | <2s | >5s |

---

## Decision Guide

```
                    ┌─────────────────────┐
                    │ Need to compress?   │
                    │ (>70% capacity)     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │ YES                             │ NO
              ▼                                 ▼
    ┌─────────────────┐              ┌─────────────────┐
    │ Multi-step task │              │ Continue        │
    │ with decisions? │              │ without         │
    └────────┬────────┘              │ compression     │
             │                       └─────────────────┘
    ┌────────┴────────┐
    │ YES             │ NO
    ▼                 ▼
┌──────────┐    ┌──────────────┐
│ ANCHORED │    │ Need speed?  │
│ ITERATIVE│    └──────┬───────┘
└──────────┘           │
              ┌────────┴────────┐
              │ YES             │ NO
              ▼                 ▼
        ┌──────────┐    ┌──────────────┐
        │ SLIDING  │    │ REGENERATIVE │
        │ WINDOW   │    │ FULL         │
        └──────────┘    └──────────────┘
```

---

## Related References

- `../assets/anchored-summary-template.md` - Template for structured summaries
- `../checklists/compression-checklist.md` - When and how to compress
- `probe-based-evaluation.md` - Testing compression quality
