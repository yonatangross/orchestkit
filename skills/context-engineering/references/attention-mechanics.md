# Attention Mechanics Reference

Deep dive into how transformer attention affects context utilization.

---

## The Attention Budget

Attention in transformers creates an **O(n²)** relationship across tokens:

```
Context Length    Attention Computations
─────────────────────────────────────────
1,000 tokens      1,000,000 operations
10,000 tokens     100,000,000 operations
100,000 tokens    10,000,000,000 operations
```

**Key Insight:** Longer contexts don't just use more memory—they exponentially increase computational cost and dilute attention across tokens.

---

## Lost-in-the-Middle Phenomenon

Research shows models pay unequal attention across the context window:

```
Position in Context Window
──────────────────────────────────────────────────────────────────
START           MIDDLE                                    END
████████████    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ████████████
High Attention  Low Attention (10-40% recall)     High Attention
(80-95% recall) Information often "lost"          (85-95% recall)
```

### Empirical Findings (from research)

| Position | Recall Rate | Best Content Types |
|----------|-------------|-------------------|
| First 10% | 85-95% | Identity, constraints, rules |
| Middle 50% | 10-40% | Background, optional details |
| Last 20% | 80-95% | Current task, query, format |

---

## Attention Patterns by Model

Different models exhibit different attention patterns:

### Primacy Bias (GPT-4, Claude)
- Strong attention to beginning of context
- Good for: System prompts, identity, constraints

### Recency Bias (All models)
- Strong attention to end of context
- Good for: Current task, recent messages

### Sliding Window (Mistral, Mixtral)
- Limited attention window that slides
- Good for: Long-form generation
- Challenge: May lose early context entirely

---

## Positional Encoding Effects

### Absolute Position Embeddings
```
Token 1: Strong positional signal
Token 1000: Medium positional signal
Token 10000: Weak positional signal (extrapolation)
```

Models trained on shorter contexts struggle with positions beyond training range.

### RoPE (Rotary Position Embeddings)
- Better extrapolation to longer contexts
- Used by: Llama, Mistral, Qwen
- Still shows degradation at extreme lengths

### ALiBi (Attention with Linear Biases)
- Decays attention linearly with distance
- Better long-context handling
- Used by: Some MPT models

---

## Practical Implications

### 1. Structure Your Prompts

```markdown
[POSITION: START - High Attention]
## System Identity
You are a senior engineer...

## Critical Rules
- NEVER expose credentials
- ALWAYS validate input

[POSITION: MIDDLE - Lower Attention]
## Background Context
{retrieved_documents}
{conversation_history}

[POSITION: END - High Attention]
## Current Task
{user_query}

## Output Format
Respond with...
```

### 2. Repeat Critical Information

For truly critical constraints, consider:
- State at START (system prompt)
- Reinforce at END (before query)

```markdown
[START]
## Rules
Never output code without tests.

...middle content...

[END]
Remember: Include tests with any code.

User query: Write a function...
```

### 3. Use Markers for Middle Content

Help the model navigate middle content:

```markdown
## Retrieved Document 1 of 3: Authentication Patterns
[RELEVANCE: HIGH for auth questions]
...content...

## Retrieved Document 2 of 3: Database Schema
[RELEVANCE: MEDIUM - background context]
...content...
```

---

## Measuring Attention Utilization

### Needle-in-Haystack Test

Place a specific fact at various positions and test retrieval:

```python
def needle_in_haystack_test(model, context_length: int):
    results = {}
    positions = [0.1, 0.25, 0.5, 0.75, 0.9]  # 10%, 25%, 50%, 75%, 90%

    for pos in positions:
        context = build_context_with_needle(context_length, pos)
        response = model.generate(context + "\nWhat was the secret number?")
        results[pos] = "correct" in response.lower()

    return results
```

### Expected Results Pattern

```
Position    Pass Rate
──────────────────────
10%         95%
25%         75%
50%         40%  ← Lost in middle
75%         70%
90%         90%
```

---

## Related References

- `context-layers.md` - The five layers of context
- `../checklists/context-optimization-checklist.md` - Practical checklist
- `compression-strategies.md` - When context is too long
