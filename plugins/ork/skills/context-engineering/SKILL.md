---
name: context-engineering
description: Use when designing agent system prompts, optimizing RAG retrieval, or when context is too expensive or slow. Reduces tokens while maintaining quality through strategic positioning and attention-aware design.
context: fork
version: 1.0.0
author: OrchestKit AI Agent Hub
tags: [context, attention, optimization, llm, performance, 2026]
user-invocable: false
---

# Context Engineering

**The discipline of curating the smallest high-signal token set that achieves desired outcomes.**

## Overview

Context engineering goes beyond prompt engineering. While prompts focus on *what* you ask, context engineering focuses on *everything* the model sees—system instructions, tool definitions, documents, message history, and tool outputs.

**Key Insight:** Context windows are constrained not by raw token capacity but by attention mechanics. As context grows, models experience degradation.

## Overview

- Designing agent system prompts
- Optimizing RAG retrieval pipelines
- Managing long-running conversations
- Building multi-agent architectures
- Reducing token costs while maintaining quality

---

## The "Lost in the Middle" Phenomenon

Models pay unequal attention across the context window:

```
Attention
Strength   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████
           ↑                                                      ↑
        START              MIDDLE (weakest attention)           END
```

**Practical Implications:**

| Position | Attention | Best For |
|----------|-----------|----------|
| START | High | System identity, critical instructions, constraints |
| MIDDLE | Low | Background context, optional details |
| END | High | Current task, recent messages, immediate query |

---

## The Five Context Layers

### 1. System Prompts (Identity Layer)

Establishes agent identity at the right "altitude":

```
TOO HIGH (vague):        "You are a helpful assistant"
TOO LOW (brittle):       "Always respond with exactly 3 bullet points..."
OPTIMAL (principled):    "You are a senior engineer who values clarity,
                          tests assumptions, and explains trade-offs"
```

**Best Practices:**
- Define role and expertise level
- State core principles (not rigid rules)
- Include what NOT to do (boundaries)
- Position at START of context

### 2. Tool Definitions (Capability Layer)

Tools steer behavior through descriptions:

```python
# ❌ BAD: Ambiguous - when would you use this?
@tool
def search(query: str) -> str:
    """Search for information."""
    pass

# ✅ GOOD: Clear trigger conditions
@tool
def search_documentation(query: str) -> str:
    """
    Search internal documentation for technical answers.

    USE WHEN:
    - User asks about internal APIs or services
    - Question requires company-specific knowledge
    - Public information is insufficient

    DO NOT USE WHEN:
    - Question is general programming knowledge
    - User explicitly wants external sources
    """
    pass
```

**Rule:** If a human cannot definitively say which tool to use, an agent cannot either.

### 3. Retrieved Documents (Knowledge Layer)

Just-in-time loading beats pre-loading:

```python
# ❌ BAD: Pre-load everything
context = load_all_documentation()  # 50k tokens!

# ✅ GOOD: Progressive disclosure
def build_context(query: str) -> str:
    # Stage 1: Lightweight retrieval (500 tokens)
    summaries = search_summaries(query, top_k=5)

    # Stage 2: Selective deep loading (only if needed)
    if needs_detail(summaries):
        full_docs = load_full_documents(summaries[:2])
        return summaries + full_docs

    return summaries
```

### 4. Message History (Memory Layer)

Treat as scratchpad, not permanent storage:

```python
# Implement sliding window with compression
MAX_MESSAGES = 20
COMPRESSION_TRIGGER = 0.7  # 70% of context budget

def manage_history(messages: list, budget: int) -> list:
    current_tokens = count_tokens(messages)

    if current_tokens > budget * COMPRESSION_TRIGGER:
        # Compress older messages, keep recent
        old = messages[:-5]
        recent = messages[-5:]

        summary = summarize(old)  # Anchored compression
        return [summary] + recent

    return messages
```

### 5. Tool Outputs (Observation Layer)

**Critical Finding:** Tool outputs can reach 83.9% of total context usage!

```python
# ❌ BAD: Return raw output
def search_web(query: str) -> str:
    results = web_search(query)
    return json.dumps(results)  # Could be 10k+ tokens!

# ✅ GOOD: Structured, bounded output
def search_web(query: str) -> str:
    results = web_search(query)

    # Extract only what's needed
    extracted = [
        {
            "title": r["title"],
            "snippet": r["snippet"][:200],  # Truncate
            "url": r["url"]
        }
        for r in results[:5]  # Limit count
    ]

    return json.dumps(extracted)  # ~500 tokens max
```

---

## The 95% Finding

Research shows what actually drives agent performance:

```
┌────────────────────────────────────────────────────────────────┐
│  TOKEN USAGE        ████████████████████████████████████  80%  │
│  TOOL CALLS         █████  10%                                 │
│  MODEL CHOICE       ██  5%                                     │
│  OTHER              ██  5%                                     │
└────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Optimize context efficiency BEFORE switching models.

---

## Context Budget Management

### Token Budget Calculator

```python
def calculate_budget(model: str, task_type: str) -> dict:
    """Calculate optimal token allocation."""

    MAX_CONTEXT = {
        "gpt-4o": 128_000,
        "claude-3": 200_000,
        "llama-3": 128_000,
    }

    # Reserve 20% for response generation
    available = MAX_CONTEXT[model] * 0.8

    # Allocation by task type
    ALLOCATIONS = {
        "chat": {
            "system": 0.05,      # 5%
            "tools": 0.05,       # 5%
            "history": 0.60,    # 60%
            "retrieval": 0.20,  # 20%
            "current": 0.10,    # 10%
        },
        "agent": {
            "system": 0.10,     # 10%
            "tools": 0.15,      # 15%
            "history": 0.30,    # 30%
            "retrieval": 0.25,  # 25%
            "observations": 0.20, # 20%
        },
    }

    alloc = ALLOCATIONS[task_type]
    return {k: int(v * available) for k, v in alloc.items()}
```

### Compression Triggers

```python
COMPRESSION_CONFIG = {
    "trigger_threshold": 0.70,    # Start compressing at 70%
    "target_threshold": 0.50,     # Compress down to 50%
    "preserve_recent": 5,         # Always keep last 5 messages
    "preserve_system": True,      # Never compress system prompt
}
```

---

## Attention-Aware Positioning

### Template Structure

```markdown
[START - HIGH ATTENTION]
## System Identity
You are a {role} specialized in {domain}.

## Critical Constraints
- NEVER {dangerous_action}
- ALWAYS {required_behavior}

[MIDDLE - LOWER ATTENTION]
## Background Context
{retrieved_documents}
{older_conversation_history}

[END - HIGH ATTENTION]
## Current Task
{recent_messages}
{user_query}

## Response Guidelines
{output_format_instructions}
```

### Priority Positioning Rules

1. **Identity & Constraints** → START (immutable)
2. **Critical instructions** → START or END
3. **Retrieved documents** → MIDDLE (expandable)
4. **Conversation history** → MIDDLE (compressible)
5. **Current query** → END (always visible)
6. **Output format** → END (guides generation)

---

## Metrics: Tokens-Per-Task

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

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Token stuffing | "More context = better" | Quality over quantity |
| Flat structure | No priority signaling | Use headers, positioning |
| Static context | Same context for all queries | Dynamic, query-relevant retrieval |
| Ignoring middle | Important info gets lost | Position critically |
| No compression | Context grows unbounded | Sliding window + summarization |

---

## Integration with OrchestKit

### Agent System Prompts

Apply attention-aware positioning to agent definitions:

```markdown
# Agent: backend-system-architect

[HIGH ATTENTION - START]
## Identity
Senior backend architect with 15+ years experience.

## Constraints
- NEVER suggest unvalidated security patterns
- ALWAYS consider multi-tenant isolation

[LOWER ATTENTION - MIDDLE]
## Domain Knowledge
{dynamically_loaded_patterns}

[HIGH ATTENTION - END]
## Current Task
{user_request}
```

### Skill Loading

Progressive skill disclosure:

```python
# Stage 1: Load skill metadata only (~100 tokens)
skill_index = load_skill_summaries()

# Stage 2: Load relevant skill on demand (~500 tokens)
if task_matches("database"):
    full_skill = load_skill("pgvector-search")
```

---

---

## CC 2.1.7: MCP Auto-Discovery and Deferral

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


## Related Skills

- `context-compression` - Compression strategies and anchored summarization
- `multi-agent-orchestration` - Context isolation across agents
- `rag-retrieval` - Optimizing retrieved document context
- `prompt-caching` - Reducing redundant context transmission

---

**Version:** 1.0.0 (January 2026)
**Based on:** Context Engineering research, BrowseComp evaluation findings
**Key Metric:** 80% of agent performance variance explained by token usage

## Capability Details

### attention-mechanics
**Keywords:** context window, attention, lost in the middle, token budget
**Solves:**
- Understand lost-in-the-middle effect (high attention at START/END)
- Position critical info strategically
- Optimize tokens-per-task not tokens-per-request

### context-layers
**Keywords:** context anatomy, context structure, five layers
**Solves:**
- Understand 5 context layers (system, tools, docs, history, outputs)
- Implement just-in-time document loading
- Manage tool output truncation

### budget-allocation
**Keywords:** token budget, context budget, allocation
**Solves:**
- Allocate tokens across context layers
- Implement compression triggers at 70% utilization
- Target 50% utilization after compression
