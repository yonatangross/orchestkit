---
name: langfuse-observability
description: Use when adding observability to LLM applications with Langfuse. Covers tracing, evaluation, prompt management, and cost tracking for self-hosted deployments.
context: fork
agent: metrics-architect
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [langfuse, llm, observability, tracing, evaluation, prompts, 2025]
---

# Langfuse Observability

## Overview

**Langfuse** is the open-source LLM observability platform that SkillForge uses for tracing, monitoring, evaluation, and prompt management. Unlike LangSmith (deprecated), Langfuse is self-hosted, free, and designed for production LLM applications.

**When to use this skill:**
- Setting up LLM observability from scratch
- Debugging slow or incorrect LLM responses
- Tracking token usage and costs
- Managing prompts in production
- Evaluating LLM output quality
- Migrating from LangSmith to Langfuse

**SkillForge Integration:**
- **Status**: ✅ Migrated from LangSmith (Dec 2025)
- **Location**: `backend/app/shared/services/langfuse/`
- **MCP Server**: `skillforge-langfuse` (optional)

---

## Core Features

### 1. Distributed Tracing

Track LLM calls across your application with automatic parent-child span relationships.

```python
from langfuse.decorators import observe, langfuse_context

@observe()  # Automatic tracing
async def analyze_content(content: str, agent_type: str):
    """Analyze content with automatic Langfuse tracing."""

    # Nested span for retrieval
    @observe(name="retrieval")
    async def retrieve_context():
        chunks = await vector_db.search(content)
        langfuse_context.update_current_observation(
            metadata={"chunks_retrieved": len(chunks)}
        )
        return chunks

    # Nested span for generation
    @observe(name="generation")
    async def generate_analysis(context):
        response = await llm.generate(
            prompt=f"Context: {context}\n\nAnalyze: {content}"
        )
        langfuse_context.update_current_observation(
            input=content[:500],
            output=response[:500],
            model="claude-sonnet-4-20250514",
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        )
        return response

    context = await retrieve_context()
    return await generate_analysis(context)
```

**Result in Langfuse UI:**
```
analyze_content (2.3s, $0.045)
├── retrieval (0.1s)
│   └── metadata: {chunks_retrieved: 5}
└── generation (2.2s, $0.045)
    └── model: claude-sonnet-4-20250514
    └── tokens: 1500 input, 1000 output
```

### 2. Token & Cost Tracking

Automatic cost calculation based on model pricing:

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Create trace with cost tracking
trace = langfuse.trace(
    name="content_analysis",
    user_id="user_123",
    session_id="session_abc"
)

# Log generation with automatic cost calculation
generation = trace.generation(
    name="security_audit",
    model="claude-sonnet-4-20250514",
    model_parameters={"temperature": 1.0, "max_tokens": 4096},
    input=[{"role": "user", "content": "Analyze for XSS..."}],
    output="Analysis: Found 3 vulnerabilities...",
    usage={
        "input": 1500,
        "output": 1000,
        "unit": "TOKENS"
    }
)

# Langfuse automatically calculates: $0.0045 + $0.015 = $0.0195
```

**Pricing Database (Auto-Updated):**
Langfuse maintains a pricing database for all major models. You can also define custom pricing:

```python
# Custom model pricing
langfuse.create_model(
    model_name="claude-sonnet-4-20250514",
    match_pattern="claude-sonnet-4.*",
    unit="TOKENS",
    input_price=0.000003,  # $3/MTok
    output_price=0.000015,  # $15/MTok
    total_price=None  # Calculated from input+output
)
```

### 3. Prompt Management

Version control for prompts in production:

```python
# Fetch prompt from Langfuse
from langfuse import Langfuse, get_client

langfuse = Langfuse()

# Get latest version of security auditor prompt
prompt = langfuse.get_prompt("security_auditor", label="production")

# Use in LLM call
response = await llm.generate(
    messages=[
        {"role": "system", "content": prompt.compile()},
        {"role": "user", "content": user_input}
    ]
)
```

#### Linking Prompts to Generations (Issue #564 Pattern)

**CRITICAL:** To make the "Number of Observations" counter work in Langfuse Prompts UI, you MUST link the `TextPromptClient` object to the generation span:

```python
from langfuse import get_client

# Method 1: update_current_generation (preferred in SkillForge)
langfuse = get_client()
prompt = langfuse.get_prompt("security_auditor", label="production")

# Link prompt to current generation span
langfuse.update_current_generation(prompt=prompt)

# Method 2: Pass prompt when starting generation
with langfuse.start_as_current_generation(
    name="security-analysis",
    model="claude-sonnet-4-20250514",
    prompt=prompt  # Links automatically!
) as generation:
    response = await llm.generate(...)
    generation.update(output=response)
```

**SkillForge Pattern (with caching):**
```python
# PromptManager returns both content AND TextPromptClient
prompt_content, prompt_client = await prompt_manager.get_prompt_with_langfuse_client(
    name="analysis-agent-security-auditor",
    variables={"skill_instructions": "..."},
    label="production",
)

# Pass prompt_client through agent metadata
if prompt_client:
    agent = agent.with_config(metadata={"langfuse_prompt_client": prompt_client})

# In invoke_agent(), link prompt to generation
if prompt_client:
    langfuse.update_current_generation(prompt=prompt_client)
```

**Note:** Cache hits (L1/L2) return `None` for `prompt_client` - linkage only happens on L3 Langfuse fetches (~5% of calls). This is acceptable for analytics.

**Prompt Versioning in UI:**
```
security_auditor
├── v1 (Jan 15, 2025) - production
│   └── "You are a security auditor. Analyze code for..."
├── v2 (Jan 20, 2025) - staging
│   └── "You are an expert security auditor. Focus on..."
└── v3 (Jan 25, 2025) - draft
    └── "As a cybersecurity expert, thoroughly analyze..."
```

### 4. LLM Evaluation (Scores)

Track quality metrics with custom scores:

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Create trace
trace = langfuse.trace(name="content_analysis", id="trace_123")

# After LLM response, score it
trace.score(
    name="relevance",
    value=0.85,  # 0-1 scale
    comment="Response addresses query but lacks depth"
)

trace.score(
    name="factuality",
    value=0.92,
    data_type="NUMERIC"
)

# Use G-Eval for automated scoring
from app.shared.services.g_eval import GEvalScorer

scorer = GEvalScorer()
scores = await scorer.score(
    query=user_query,
    response=llm_response,
    criteria=["relevance", "coherence", "depth"]
)

for criterion, score in scores.items():
    trace.score(name=criterion, value=score)
```

**Scores Dashboard:**
- View score distributions
- Track quality trends over time
- Filter traces by score thresholds
- Compare prompt versions by scores

### 5. Session Tracking

Group related traces into user sessions:

```python
# Start session
session_id = f"analysis_{analysis_id}"

# All traces with same session_id are grouped
trace1 = langfuse.trace(
    name="url_fetch",
    session_id=session_id
)

trace2 = langfuse.trace(
    name="content_analysis",
    session_id=session_id
)

trace3 = langfuse.trace(
    name="quality_gate",
    session_id=session_id
)

# View in UI: All 3 traces grouped under session
```

### 6. User & Metadata Tracking

Track performance per user or content type:

```python
langfuse.trace(
    name="analysis",
    user_id="user_123",
    metadata={
        "content_type": "article",
        "url": "https://example.com/post",
        "analysis_id": "abc123",
        "agent_count": 8,
        "total_cost_usd": 0.15
    },
    tags=["production", "skillforge", "security"]
)
```

**Analytics:**
- Filter by user, tag, metadata
- Group costs by content_type
- Track performance by agent type
- Identify slow or expensive users

---

## SkillForge Integration

### Setup (Already Complete)

```python
# backend/app/shared/services/langfuse/client.py
from langfuse import Langfuse
from app.core.config import settings

langfuse_client = Langfuse(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    host=settings.LANGFUSE_HOST  # Self-hosted or cloud
)
```

### Workflow Integration

```python
# backend/app/workflows/content_analysis.py
from langfuse.decorators import observe

@observe(name="content_analysis_workflow")
async def run_content_analysis(analysis_id: str, content: str):
    """Full workflow with automatic Langfuse tracing."""

    # Set global metadata
    langfuse_context.update_current_trace(
        user_id=f"analysis_{analysis_id}",
        metadata={
            "analysis_id": analysis_id,
            "content_length": len(content)
        }
    )

    # Each agent execution automatically creates nested spans
    results = []
    for agent in agents:
        result = await execute_agent(agent, content)  # @observe decorated
        results.append(result)

    return results
```

### Cost Tracking Per Analysis

```python
# After analysis completes
trace = langfuse.get_trace(trace_id)
total_cost = sum(
    gen.calculated_total_cost or 0
    for gen in trace.observations
    if gen.type == "GENERATION"
)

# Store in database
await analysis_repo.update(
    analysis_id,
    langfuse_trace_id=trace.id,
    total_cost_usd=total_cost
)
```

---

## Advanced Features

### 1. CallbackHandler (LangChain Integration)

For LangChain/LangGraph applications:

```python
from langfuse.callback import CallbackHandler

langfuse_handler = CallbackHandler(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY
)

# Use with LangChain
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    callbacks=[langfuse_handler]
)

response = llm.invoke("Analyze this code...")  # Auto-traced!
```

### 2. Datasets for Evaluation

Create test datasets in Langfuse UI and run automated evaluations:

```python
# Fetch dataset
dataset = langfuse.get_dataset("security_audit_test_set")

# Run evaluation
for item in dataset.items:
    # Run LLM
    response = await llm.generate(item.input)

    # Create observation linked to dataset item
    langfuse.trace(
        name="evaluation_run",
        metadata={"dataset_item_id": item.id}
    ).generation(
        input=item.input,
        output=response,
        usage=response.usage
    )

    # Score
    score = await evaluate_response(item.expected_output, response)
    langfuse.score(
        trace_id=trace.id,
        name="accuracy",
        value=score
    )
```

### 3. Experimentation (A/B Testing Prompts)

```python
# Test two prompt versions
prompt_v1 = langfuse.get_prompt("security_auditor", version=1)
prompt_v2 = langfuse.get_prompt("security_auditor", version=2)

# Run A/B test
import random

for test_input in test_dataset:
    prompt = random.choice([prompt_v1, prompt_v2])

    response = await llm.generate(
        messages=[
            {"role": "system", "content": prompt.compile()},
            {"role": "user", "content": test_input}
        ]
    )

    # Track which version was used
    langfuse.trace(
        name="ab_test",
        metadata={"prompt_version": prompt.version}
    )

# Compare in Langfuse UI:
# - Filter by prompt_version
# - Compare average scores
# - Analyze cost differences
```

---

## Monitoring Dashboard Queries

### Top 10 Most Expensive Traces (Last 7 Days)

```sql
SELECT
    name,
    user_id,
    calculated_total_cost,
    input_tokens,
    output_tokens
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
ORDER BY calculated_total_cost DESC
LIMIT 10;
```

### Average Cost by Agent Type

```sql
SELECT
    metadata->>'agent_type' as agent,
    COUNT(*) as traces,
    AVG(calculated_total_cost) as avg_cost,
    SUM(calculated_total_cost) as total_cost
FROM traces
WHERE metadata->>'agent_type' IS NOT NULL
GROUP BY agent
ORDER BY total_cost DESC;
```

### Quality Scores Trend

```sql
SELECT
    DATE(timestamp) as date,
    AVG(value) FILTER (WHERE name = 'relevance') as avg_relevance,
    AVG(value) FILTER (WHERE name = 'depth') as avg_depth,
    AVG(value) FILTER (WHERE name = 'factuality') as avg_factuality
FROM scores
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date;
```

---

## Best Practices

1. **Always use @observe decorator** for automatic tracing
2. **Set user_id and session_id** for better analytics
3. **Add meaningful metadata** (content_type, analysis_id, etc.)
4. **Score all productions traces** for quality monitoring
5. **Use prompt management** instead of hardcoded prompts
6. **Monitor costs daily** to catch spikes early
7. **Create datasets** for regression testing
8. **Tag production vs staging** traces

---

## References

- [Langfuse Docs](https://langfuse.com/docs)
- [Python SDK](https://langfuse.com/docs/sdk/python)
- [Decorators Guide](https://langfuse.com/docs/sdk/python/decorators)
- [Prompt Management](https://langfuse.com/docs/prompts)
- [Self-Hosting](https://langfuse.com/docs/deployment/self-host)
- [SkillForge Integration](https://github.com/yonatan-gross/SkillForge#langfuse-observability)

---

## Migration from LangSmith

See Langfuse documentation at https://langfuse.com/docs for integration details.

**Key Differences:**
- Langfuse: Self-hosted, open-source, free
- LangSmith: Cloud-only, proprietary, paid
- Langfuse: Prompt management built-in
- LangSmith: External prompt storage needed
- Langfuse: @observe decorator
- LangSmith: @traceable decorator

## Capability Details

### distributed-tracing
**Keywords:** trace, tracing, observability, span, nested, parent-child, observe
**Solves:**
- How do I trace LLM calls across my application?
- How to debug slow LLM responses?
- Track execution flow in multi-agent workflows
- Create nested trace spans

### cost-tracking
**Keywords:** cost, token usage, pricing, budget, spend, expense
**Solves:**
- How do I track LLM costs?
- Calculate token usage and pricing
- Monitor AI budget and spending
- Track cost per user or session

### prompt-management
**Keywords:** prompt version, prompt template, prompt control, prompt registry
**Solves:**
- How do I version control prompts?
- Manage prompts in production
- A/B test different prompt versions
- Link prompts to traces

### llm-evaluation
**Keywords:** score, quality, evaluation, rating, assessment, g-eval
**Solves:**
- How do I evaluate LLM output quality?
- Score responses with custom metrics
- Track quality trends over time
- Compare prompt versions by quality

### session-tracking
**Keywords:** session, user tracking, conversation, group traces
**Solves:**
- How do I group related traces?
- Track multi-turn conversations
- Monitor per-user performance
- Organize traces by session

### langchain-integration
**Keywords:** langchain, callback, handler, langgraph integration
**Solves:**
- How do I integrate Langfuse with LangChain?
- Use CallbackHandler for tracing
- Automatic LangGraph workflow tracing
- LangChain observability setup

### datasets-evaluation
**Keywords:** dataset, test set, evaluation dataset, benchmark
**Solves:**
- How do I create test datasets in Langfuse?
- Run automated evaluations
- Regression testing for LLMs
- Benchmark prompt versions

### ab-testing
**Keywords:** a/b test, experiment, compare prompts, variant testing
**Solves:**
- How do I A/B test prompts?
- Compare two prompt versions
- Experimental prompt evaluation
- Statistical prompt testing

### monitoring-dashboard
**Keywords:** dashboard, analytics, metrics, monitoring, queries
**Solves:**
- What are the most expensive traces?
- Average cost by agent type
- Quality score trends
- Custom monitoring queries

### skillforge-integration
**Keywords:** skillforge, migration, setup, workflow integration
**Solves:**
- How does SkillForge use Langfuse?
- Migrate from LangSmith to Langfuse
- SkillForge workflow tracing patterns
- Cost tracking per analysis

### multi-judge-evaluation
**Keywords:** multi judge, g-eval, multiple evaluators, ensemble evaluation, weighted scoring
**Solves:**
- How do I use multiple LLM judges to evaluate quality?
- Set up G-Eval criteria evaluation
- Configure weighted scoring across judges
- Wire SkillForge's existing langfuse_evaluators.py

### experiments-api
**Keywords:** experiment, dataset, benchmark, regression test, prompt testing
**Solves:**
- How do I run experiments across datasets?
- A/B test models and prompts systematically
- Track quality regression over time
- Compare experiment results
