---
title: "Engineering: Context Layers & System Prompts"
category: engineering
impact: HIGH
impactDescription: Proper context architecture drives 80% of agent performance
tags: [context-layers, system-prompts, tool-definitions, identity, capabilities]
---

# Context Layers & System Prompts

## The Five Context Layers

### 1. System Prompts (Identity)

```
TOO HIGH (vague):     "You are a helpful assistant"
TOO LOW (brittle):    "Always respond with exactly 3 bullet points..."
OPTIMAL (principled): "You are a senior engineer who values clarity,
                       tests assumptions, and explains trade-offs"
```

**Best Practices:** Define role, state principles (not rigid rules), include boundaries, position at START.

### 2. Tool Definitions (Capabilities)

```python
# GOOD: Clear trigger conditions
@tool
def search_documentation(query: str) -> str:
    """
    Search internal documentation for technical answers.
    USE WHEN: User asks about internal APIs
    DO NOT USE WHEN: General programming knowledge
    """
```

### 3. Retrieved Documents (Knowledge)

```python
# Just-in-time loading beats pre-loading
def build_context(query: str) -> str:
    summaries = search_summaries(query, top_k=5)  # 500 tokens
    if needs_detail(summaries):
        full_docs = load_full_documents(summaries[:2])
        return summaries + full_docs
    return summaries
```

### 4. Message History (Memory)

Treat as scratchpad, not permanent storage. Implement sliding window with compression.

### 5. Tool Outputs (Observations)

**Critical:** Tool outputs can reach 83.9% of total context! Always truncate and structure.
