---
title: "Engineering: Token Budget Management"
category: engineering
impact: HIGH
impactDescription: Token budget allocation determines how efficiently agents use their context window
tags: [token-budget, budget-calculator, skill-scaling, allocation, mcp-deferral]
---

# Token Budget Management

## Budget Calculator

```python
def calculate_budget(model: str, task_type: str) -> dict:
    MAX_CONTEXT = {
        "claude-opus-4-6": 1_000_000,
        "claude-sonnet-4-5": 1_000_000,
        "gpt-5.2": 256_000,
    }

    available = MAX_CONTEXT[model] * 0.8  # Reserve 20% for response

    ALLOCATIONS = {
        "chat": {"system": 0.05, "tools": 0.05, "history": 0.60,
                 "retrieval": 0.20, "current": 0.10},
        "agent": {"system": 0.10, "tools": 0.15, "history": 0.30,
                  "retrieval": 0.25, "observations": 0.20},
    }

    alloc = ALLOCATIONS[task_type]
    return {k: int(v * available) for k, v in alloc.items()}
```

## CC 2.1.32 Skill Budget Scaling

| Context Window | Skill Budget (2%) |
|---------------|-------------------|
| 200K tokens | ~4,000 tokens |
| 500K tokens | ~10,000 tokens |
| 1M tokens | ~20,000 tokens |

## MCP Auto-Deferral (CC 2.1.7)

```
Context < 10%:  MCP tools immediately available
Context > 10%:  MCP tools discovered via MCPSearch (deferred)
Savings: ~7200 tokens per session average
```

**Best Practices:** Use MCPs early, batch calls, cache results, monitor statusline.
