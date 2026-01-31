# The Five Context Layers

Comprehensive guide to the anatomy of LLM context.

---

## Overview

Context is everything the model sees at inference time:

```
┌──────────────────────────────────────────────────────────────────┐
│                     COMPLETE CONTEXT                             │
├──────────────────────────────────────────────────────────────────┤
│  Layer 1: System Prompt        (~5-10% of budget)                │
│  Layer 2: Tool Definitions     (~5-15% of budget)                │
│  Layer 3: Retrieved Documents  (~20-30% of budget)               │
│  Layer 4: Message History      (~30-50% of budget)               │
│  Layer 5: Tool Outputs         (~10-30% of budget, VARIABLE!)    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: System Prompts (Identity)

**Purpose:** Establish agent identity, personality, and constraints.

### The Altitude Problem

```
TOO HIGH (Vague)                    TOO LOW (Brittle)
─────────────────                   ─────────────────
"Be helpful"                        "Always respond in exactly
                                     3 bullet points with no
                                     more than 15 words each"

❌ No clear guidance                ❌ Breaks on edge cases
❌ Inconsistent behavior            ❌ Over-constrained
```

### Optimal Altitude: Principled

```markdown
## Identity
You are a senior backend engineer with 15+ years of experience
in distributed systems and API design.

## Principles
- Prioritize correctness over cleverness
- Consider security implications of every decision
- Explain trade-offs, don't just give answers
- Ask clarifying questions when requirements are ambiguous

## Boundaries
- Never suggest deploying to production without tests
- Never hardcode credentials or secrets
- Never make breaking API changes without migration path
```

### Best Practices

| Do | Don't |
|-----|-------|
| Define role and expertise | Use vague descriptors ("be smart") |
| State principles (flexible) | List rigid rules (brittle) |
| Include boundaries (what NOT to do) | Assume model knows constraints |
| Position at START of context | Bury in middle of context |

---

## Layer 2: Tool Definitions (Capabilities)

**Purpose:** Define what actions the agent can take.

### The Ambiguity Problem

```python
# ❌ BAD: When would you use this?
@tool
def search(query: str) -> str:
    """Search for information."""
    pass

# ✅ GOOD: Clear trigger conditions
@tool
def search_internal_docs(query: str) -> str:
    """
    Search company documentation for technical answers.

    USE WHEN:
    - User asks about internal APIs, services, or processes
    - Question requires company-specific knowledge
    - Public documentation is insufficient

    DO NOT USE:
    - For general programming questions (use web search)
    - For external library documentation (use official docs)

    EXAMPLES:
    - "How do I authenticate with our payment service?"
    - "What's the schema for the users table?"
    """
    pass
```

### Tool Description Checklist

- [ ] Clear trigger conditions (when to use)
- [ ] Explicit exclusions (when NOT to use)
- [ ] 2-3 concrete examples
- [ ] Parameter constraints and defaults
- [ ] Expected output format

### Rule of Thumb

> If a human reading the descriptions cannot definitively choose between tools, neither can an agent.

---

## Layer 3: Retrieved Documents (Knowledge)

**Purpose:** Provide relevant information for the current task.

### Pre-loading vs Just-in-Time

```python
# ❌ PRE-LOADING: Wastes context budget
def build_context():
    return load_all_documentation()  # 50k tokens!

# ✅ JUST-IN-TIME: Query-relevant retrieval
def build_context(query: str):
    # Stage 1: Fast, lightweight (100 tokens)
    summaries = search_summaries(query, top_k=5)

    # Stage 2: Selective expansion (500-1000 tokens)
    if needs_detail(summaries, query):
        full_docs = load_documents(summaries[:2])
        return full_docs

    return summaries
```

### Progressive Disclosure Pattern

```
Query arrives
     │
     ▼
┌─────────────┐
│ Search      │ → Return summaries (100 tokens)
│ Summaries   │
└─────────────┘
     │
     ▼ (if insufficient)
┌─────────────┐
│ Load Top 2  │ → Return full docs (500 tokens)
│ Full Docs   │
└─────────────┘
     │
     ▼ (if still insufficient)
┌─────────────┐
│ Expand to   │ → Return more docs (1000 tokens)
│ Top 5 Docs  │
└─────────────┘
```

---

## Layer 4: Message History (Memory)

**Purpose:** Maintain conversation continuity and context.

### The Memory Problem

Message history grows unbounded if not managed:

```
Turn 1:   500 tokens
Turn 5:   2,500 tokens
Turn 10:  5,000 tokens
Turn 20:  10,000 tokens  ← Budget pressure
Turn 50:  25,000 tokens  ← Degradation likely
```

### Management Strategies

#### 1. Sliding Window
```python
MAX_HISTORY = 20  # messages

def manage_history(messages):
    if len(messages) > MAX_HISTORY:
        return messages[-MAX_HISTORY:]
    return messages
```

#### 2. Sliding Window + Summary
```python
def manage_history(messages, summary=None):
    if len(messages) > 20:
        old = messages[:-10]
        recent = messages[-10:]

        new_summary = summarize(old, existing=summary)
        return [new_summary] + recent

    return messages
```

#### 3. Importance-Weighted Retention
```python
def manage_history(messages):
    scored = [(m, importance_score(m)) for m in messages]
    sorted_msgs = sorted(scored, key=lambda x: -x[1])

    # Keep high-importance messages + recent
    important = [m for m, s in sorted_msgs[:10]]
    recent = messages[-5:]

    return dedupe(important + recent)
```

---

## Layer 5: Tool Outputs (Observations)

**Purpose:** Results from tool executions.

### The Hidden Budget Killer

Research finding: Tool outputs can consume **83.9%** of total context!

```
Agent Trajectory Breakdown
──────────────────────────────────────────────────────────────
System + Tools:     10%  ████
Messages:           6%   ███
Tool Outputs:       84%  ████████████████████████████████████████
```

### Mitigation Strategies

#### 1. Truncate at Source
```python
def search_web(query: str) -> str:
    results = api.search(query)

    # Truncate each result
    return json.dumps([{
        "title": r["title"],
        "snippet": r["snippet"][:200],  # Limit snippet
        "url": r["url"]
    } for r in results[:5]])  # Limit count
```

#### 2. Summarize Before Return
```python
def read_file(path: str) -> str:
    content = open(path).read()

    if len(content) > 2000:
        return f"[File summary: {len(content)} chars]\n" + \
               summarize(content, max_tokens=500)

    return content
```

#### 3. Structured Extraction
```python
def analyze_logs(logs: str) -> str:
    # Don't return raw logs!
    errors = extract_errors(logs)
    warnings = extract_warnings(logs)

    return json.dumps({
        "error_count": len(errors),
        "top_errors": errors[:3],
        "warning_count": len(warnings),
        "summary": generate_summary(logs)
    })
```

---

## Budget Allocation Guidelines

### Chat Applications
```
System:      5%   (identity, basic rules)
Tools:       5%   (minimal tool set)
History:     60%  (conversation focus)
Retrieval:   20%  (on-demand)
Current:     10%  (query + response space)
```

### Agent Applications
```
System:      10%  (detailed identity + constraints)
Tools:       15%  (rich tool descriptions)
History:     30%  (compressed + summarized)
Retrieval:   25%  (RAG context)
Observations: 20% (tool outputs, bounded!)
```

---

## Related References

- `attention-mechanics.md` - How attention affects each layer
- `../checklists/context-optimization-checklist.md` - Practical checklist
