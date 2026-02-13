# When to Fine-Tune: Decision Framework

## The Fine-Tuning Ladder

Fine-tuning should be your **last resort**, not your first choice. Always climb the ladder from bottom to top:

```
Level 4: Fine-Tuning      ← Last resort
Level 3: RAG              ← External knowledge
Level 2: Few-Shot         ← Examples in prompt
Level 1: Prompt Engineering  ← Always start here
```

## Decision Flowchart

```
START: "I need the model to do X"
         │
         ▼
┌─────────────────────────────┐
│ Can prompt engineering      │
│ achieve acceptable results? │
└─────────────────────────────┘
         │
    YES ─┼─ NO
         │    │
         ▼    ▼
      DONE  ┌─────────────────────────────┐
            │ Is the knowledge external/  │
            │ frequently updated?         │
            └─────────────────────────────┘
                     │
                YES ─┼─ NO
                     │    │
                     ▼    ▼
                Use RAG  ┌─────────────────────────────┐
                         │ Do you have ~1000+ quality  │
                         │ examples of desired I/O?   │
                         └─────────────────────────────┘
                                  │
                             YES ─┼─ NO
                                  │    │
                                  ▼    ▼
                          Fine-Tune   Collect more data
                                      or revisit prompt
```

## When Each Approach Works

### Prompt Engineering (Level 1)

**Use when:**
- Task can be explained in natural language
- Model has knowledge but needs guidance
- Output format is flexible
- You need rapid iteration

**Examples:**
- "Respond in formal business English"
- "Always include a summary at the end"
- "Use markdown formatting"

```python
# Often sufficient!
system_prompt = """You are a legal document assistant.
Always:
- Use formal language
- Cite relevant sections
- End with a disclaimer"""
```

### Few-Shot Prompting (Level 2)

**Use when:**
- Task needs specific examples
- Format is precise but describable
- 3-10 examples capture the pattern

**Examples:**
- JSON extraction with specific schema
- Classification with defined categories
- Style transfer with reference

```python
# Few-shot often beats fine-tuning
examples = [
    {"input": "example1", "output": "desired_output1"},
    {"input": "example2", "output": "desired_output2"},
]
```

### RAG (Level 3)

**Use when:**
- Knowledge is external to model
- Information changes frequently
- Need citations/sources
- Domain knowledge > training data

**Examples:**
- Company documentation Q&A
- Product catalog search
- Legal case lookup
- Recent news analysis

```python
# RAG for dynamic knowledge
context = retrieve_relevant_docs(query)
response = llm.generate(f"Based on: {context}\n\nAnswer: {query}")
```

### Fine-Tuning (Level 4)

**Use when ALL of these are true:**
1. Prompt engineering exhausted
2. RAG doesn't capture nuances
3. Need deep behavioral changes
4. Have ~1000+ quality examples
5. Pattern too complex for prompts

**Good use cases:**
- Domain-specific terminology (medical, legal)
- Consistent persona/voice
- Specific output structure (always)
- Task requires implicit knowledge

**Bad use cases:**
- "My prompt is too long" → Use prompt compression
- "Need factual accuracy" → Use RAG
- "Model doesn't know X" → Add to context
- "Want different style" → Few-shot examples

## Comparison Matrix

| Criterion | Prompt | Few-Shot | RAG | Fine-Tune |
|-----------|--------|----------|-----|-----------|
| Setup time | Minutes | Hours | Days | Weeks |
| Cost | $0 | $0 | $$ | $$$ |
| Data needed | 0 | 3-10 | Docs | 1000+ |
| Iteration speed | Fast | Fast | Medium | Slow |
| Maintenance | Easy | Easy | Medium | Hard |
| Knowledge update | Instant | Instant | Hours | Retrain |
| Deep behavior | No | Limited | No | Yes |

## Red Flags: Don't Fine-Tune

Watch for these anti-patterns:

```python
# Thinking: "I'll fine-tune because..."

# "...my prompt is getting long"
# → Use prompt caching, compression, or few-shot

# "...I need factual accuracy"
# → Use RAG with verified sources

# "...the model doesn't know about my product"
# → Add product docs to context (RAG)

# "...I only have 50 examples"
# → Not enough! Collect more or use few-shot

# "...I want faster inference"
# → Fine-tuning doesn't make inference faster
# → Use smaller model or prompt caching

# "...I want cheaper inference"
# → Fine-tune smaller model OR use caching
# → But validate quality first with prompting
```

## Green Flags: Do Fine-Tune

Fine-tuning is appropriate when:

```python
# "...the model needs a consistent clinical voice"
# ✅ Deep behavioral change

# "...every response must follow our 50-field JSON schema"
# ✅ Complex structural requirements

# "...we have 5,000 expert-validated examples"
# ✅ Sufficient high-quality data

# "...legal terminology must be used precisely"
# ✅ Domain-specific patterns

# "...prompt engineering plateau'd at 70% accuracy"
# ✅ Other approaches exhausted
```

## Data Requirements by Task

| Task Type | Minimum Examples | Recommended |
|-----------|------------------|-------------|
| Style/tone | 500 | 1,000 |
| Classification | 100/class | 500/class |
| Format enforcement | 500 | 2,000 |
| Domain expertise | 2,000 | 10,000 |
| Complex reasoning | 5,000 | 20,000+ |

## Cost-Benefit Analysis

```python
def should_finetune(
    current_accuracy: float,
    target_accuracy: float,
    training_examples: int,
    monthly_volume: int,
) -> dict:
    """Analyze fine-tuning ROI."""

    # Fine-tuning costs (rough estimates)
    training_cost = training_examples * 0.008  # ~$8/1K examples
    maintenance_cost_monthly = 500  # Re-training, evaluation

    # Prompt-based costs
    extra_tokens_per_call = 500  # Few-shot examples
    token_cost = 0.01 / 1000  # Per token
    prompt_cost_monthly = monthly_volume * extra_tokens_per_call * token_cost

    # Break-even
    if prompt_cost_monthly > 0:
        break_even_months = training_cost / prompt_cost_monthly
    else:
        break_even_months = float('inf')

    return {
        "training_cost": training_cost,
        "monthly_prompt_savings": prompt_cost_monthly,
        "break_even_months": break_even_months,
        "recommendation": "fine-tune" if break_even_months < 6 else "prompt",
    }
```

## Checklist Before Fine-Tuning

- [ ] Prompt engineering tried with 5+ iterations
- [ ] Few-shot examples tested (3, 5, 10 examples)
- [ ] RAG evaluated if knowledge-based
- [ ] Have 1,000+ high-quality examples
- [ ] Examples validated by domain expert
- [ ] Evaluation set separate from training
- [ ] Success metrics defined
- [ ] Maintenance plan in place
- [ ] Cost-benefit analysis positive
