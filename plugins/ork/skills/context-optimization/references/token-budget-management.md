# Token Budget Management Reference

Budget calculators, skill scaling, MCP auto-deferral, and cost optimization for context windows.

---

## Token Budget Calculator

```python
def calculate_budget(model: str, task_type: str) -> dict:
    """Calculate optimal token allocation."""

    MAX_CONTEXT = {
        "gpt-5.2": 256_000,
        "gpt-5.2-mini": 128_000,
        "claude-opus-4-6": 1_000_000,
        "claude-sonnet-4-5": 1_000_000,
        "gemini-3-pro": 2_000_000,
        "gemini-3-flash": 1_000_000,
        "llama-3": 128_000,
    }

    # Opus 4.6: 128K max output tokens (up from 64K)
    MAX_OUTPUT = {
        "claude-opus-4-6": 128_000,
        "claude-sonnet-4-5": 64_000,
        "gpt-5.2": 64_000,
        "gemini-3-pro": 65_536,
    }

    # Reserve 20% for response generation
    available = MAX_CONTEXT[model] * 0.8

    # Allocation by task type
    ALLOCATIONS = {
        "chat": {
            "system": 0.05,      # 5%
            "tools": 0.05,       # 5%
            "history": 0.60,     # 60%
            "retrieval": 0.20,   # 20%
            "current": 0.10,     # 10%
        },
        "agent": {
            "system": 0.10,      # 10%
            "tools": 0.15,       # 15%
            "history": 0.30,     # 30%
            "retrieval": 0.25,   # 25%
            "observations": 0.20, # 20%
        },
    }

    alloc = ALLOCATIONS[task_type]
    return {k: int(v * available) for k, v in alloc.items()}
```

---

## CC 2.1.32+ Skill Budget Scaling

CC 2.1.32+ automatically scales the skill character budget to **2% of the context window**:

| Context Window | Skill Budget (2%) | OrchestKit Skills |
|---------------|--------------------|-------------------|
| 200K tokens | ~4,000 tokens | Standard (1200 token skill-injection budget) |
| 500K tokens | ~10,000 tokens | 3x more room for skill descriptions |
| 1M tokens (beta) | ~20,000 tokens | 5x skill budget, richer auto-suggest |

OrchestKit's token budgets auto-scale proportionally via `CLAUDE_MAX_CONTEXT` env var.

---

## MCP Auto-Discovery and Deferral (CC 2.1.7)

### MCP Search Mode

CC 2.1.7 introduces intelligent MCP tool discovery. When context usage exceeds 10% of the effective window, MCPs are automatically deferred to reduce token overhead.

```
Context < 10%:  MCP tools immediately available
Context > 10%:  MCP tools discovered via MCPSearch (deferred loading)

Savings: ~7200 tokens per session average
```

### How Auto-Deferral Works

The context budget monitor tracks usage against the effective window:

1. **Below 10%**: MCP tool definitions loaded in context (~1200 tokens)
2. **Above 10%**: MCP tools deferred, available via MCPSearch on-demand
3. **State file**: `/tmp/claude-mcp-defer-state-{session}.json`

### Best Practices for MCP with Auto-Deferral

1. **Use MCPs early** - Before context fills up
2. **Batch MCP calls** - Multiple queries in one turn
3. **Cache MCP results** - Store retrieved docs in context
4. **Monitor statusline** - Watch for `mcp.deferred: true`

### Checking MCP Deferral State

```bash
cat /tmp/claude-mcp-defer-state-${CLAUDE_SESSION_ID}.json
```

---

## Tokens-Per-Task Metric

**Optimize for total task completion, not individual requests:**

```python
@dataclass
class TaskMetrics:
    task_id: str
    total_tokens: int = 0
    request_count: int = 0
    retrieval_tokens: int = 0
    generation_tokens: int = 0

    @property
    def tokens_per_request(self) -> float:
        return self.total_tokens / max(self.request_count, 1)

    @property
    def efficiency_ratio(self) -> float:
        """Lower is better - generation vs total context."""
        return self.generation_tokens / max(self.total_tokens, 1)
```

**Anti-pattern:** Aggressive compression that loses critical details forces expensive re-fetching, consuming MORE tokens overall.

---

## The 95% Finding

Research shows what actually drives agent performance:

```
TOKEN USAGE         80%
TOOL CALLS          10%
MODEL CHOICE         5%
OTHER                5%
```

**Key Insight:** Optimize context efficiency BEFORE switching models.

---

## Cost Optimization Strategies

### 1. Progressive Loading

Load minimal context first, expand only when needed:

```python
# Stage 1: Load skill metadata only (~100 tokens)
skill_index = load_skill_summaries()

# Stage 2: Load relevant skill on demand (~500 tokens)
if task_matches("database"):
    full_skill = load_skill("pgvector-search")
```

### 2. Prompt Caching Alignment

Structure prompts so stable content comes first (cacheability):

```
[STABLE - Cacheable]
System prompt + Tool definitions + Static references

[VARIABLE - Not cached]
User messages + Dynamic context + Current query
```

### 3. Token Counting Awareness

Different tokenizers produce different counts for the same text:

| Tokenizer | "Hello, world!" | Code snippet (100 chars) |
|-----------|----------------|--------------------------|
| cl100k_base (GPT-4) | 4 tokens | ~25-35 tokens |
| Claude | 3 tokens | ~20-30 tokens |

Always use the model-specific tokenizer for accurate budget calculations.
