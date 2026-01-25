# Prompt Versioning

Manage prompts in production with versioning, labels, and A/B testing.

## Langfuse Prompt Management

### Setup

```python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key="pk-...",
    secret_key="sk-...",
    host="https://cloud.langfuse.com"  # or self-hosted
)
```

### Fetch Versioned Prompts

```python
# Get specific version
prompt = langfuse.get_prompt(
    name="customer-support",
    version=3,
    cache_ttl_seconds=300  # Cache for 5 minutes
)

# Get by label (recommended for production)
prompt = langfuse.get_prompt(
    name="customer-support",
    label="production"  # production, staging, canary
)

# Compile with variables
compiled = prompt.compile(
    customer_name="John",
    issue_type="billing"
)
```

### Prompt Labels

Use labels for environment management:

```python
# Production environment
if env == "production":
    prompt = langfuse.get_prompt("analyzer", label="production")
elif env == "staging":
    prompt = langfuse.get_prompt("analyzer", label="staging")
else:
    prompt = langfuse.get_prompt("analyzer", label="development")
```

Label workflow:
```
development → staging → production
     ↓            ↓           ↓
  Testing    Pre-prod     Live traffic
```

## A/B Testing Prompts

### Basic A/B Test

```python
import random
from langfuse.decorators import observe, langfuse_context

@observe()
async def analyze_with_ab_test(content: str) -> str:
    """Run A/B test between two prompt versions."""

    # Randomly select variant
    variant = random.choice(["A", "B"])

    if variant == "A":
        prompt = langfuse.get_prompt("analyzer", version=1)
    else:
        prompt = langfuse.get_prompt("analyzer", version=2)

    # Track variant in trace
    langfuse_context.update_current_observation(
        metadata={"ab_variant": variant, "prompt_version": prompt.version}
    )

    response = await llm.complete(prompt.compile(content=content))
    return response
```

### Weighted A/B Test

```python
def weighted_choice(weights: dict[str, float]) -> str:
    """Select variant based on weights."""
    import random
    total = sum(weights.values())
    r = random.uniform(0, total)
    cumulative = 0
    for variant, weight in weights.items():
        cumulative += weight
        if r <= cumulative:
            return variant
    return list(weights.keys())[-1]

# 90% production, 10% canary
variant = weighted_choice({"production": 0.9, "canary": 0.1})
prompt = langfuse.get_prompt("analyzer", label=variant)
```

### Statistical Analysis

```python
from scipy import stats

def analyze_ab_results(
    control_scores: list[float],
    treatment_scores: list[float],
    confidence: float = 0.95
) -> dict:
    """Analyze A/B test results with statistical significance."""

    # T-test for difference
    t_stat, p_value = stats.ttest_ind(control_scores, treatment_scores)

    # Effect size (Cohen's d)
    pooled_std = ((len(control_scores) - 1) * np.std(control_scores)**2 +
                  (len(treatment_scores) - 1) * np.std(treatment_scores)**2)
    pooled_std = np.sqrt(pooled_std / (len(control_scores) + len(treatment_scores) - 2))
    cohens_d = (np.mean(treatment_scores) - np.mean(control_scores)) / pooled_std

    return {
        "control_mean": np.mean(control_scores),
        "treatment_mean": np.mean(treatment_scores),
        "p_value": p_value,
        "significant": p_value < (1 - confidence),
        "effect_size": cohens_d,
        "recommendation": "treatment" if p_value < 0.05 and cohens_d > 0.2 else "control"
    }
```

## Prompt Templates with Variables

### Langfuse Syntax

```python
# In Langfuse UI, use {variable} syntax:
# "You are a {role}. The customer's name is {name}."

prompt = langfuse.get_prompt("greeting")
compiled = prompt.compile(role="support agent", name="Alice")
# Result: "You are a support agent. The customer's name is Alice."
```

### Chat Templates

```python
# Langfuse supports chat message templates
prompt = langfuse.get_prompt("chat-analyzer", type="chat")

# Returns list of messages
messages = prompt.compile(
    user_query="What's the weather?",
    context="Location: NYC"
)
# [
#   {"role": "system", "content": "..."},
#   {"role": "user", "content": "What's the weather?"},
# ]
```

## Version Control Best Practices

### 1. Meaningful Version Notes

```
v1 (2025-01-01): Initial version
v2 (2025-01-15): Added safety instructions
v3 (2025-02-01): Improved output format
v4 (2025-02-15): Fixed edge case for empty input
```

### 2. Rollback Strategy

```python
async def safe_prompt_call(name: str, variables: dict) -> str:
    """Call prompt with automatic rollback on failure."""
    try:
        prompt = langfuse.get_prompt(name, label="production")
        return await llm.complete(prompt.compile(**variables))
    except Exception as e:
        # Rollback to known-good version
        logger.warning(f"Prompt failed, rolling back: {e}")
        prompt = langfuse.get_prompt(name, version=1)  # Fallback version
        return await llm.complete(prompt.compile(**variables))
```

### 3. Gradual Rollout

```python
def get_prompt_for_rollout(
    name: str,
    rollout_percentage: float,
    user_id: str
) -> Prompt:
    """Gradual rollout based on user ID hash."""

    # Deterministic bucket based on user
    bucket = hash(user_id) % 100

    if bucket < rollout_percentage:
        return langfuse.get_prompt(name, label="canary")
    else:
        return langfuse.get_prompt(name, label="production")
```

## Prompt Caching Architecture

```
┌─────────────────────────────────────────────────┐
│              PROMPT RESOLUTION                   │
├─────────────────────────────────────────────────┤
│  L1: In-Memory LRU (5min TTL)                   │
│  └─► Hit? Return immediately                    │
│                                                 │
│  L2: Redis (15min TTL)                          │
│  └─► Hit? Populate L1, return                   │
│                                                 │
│  L3: Langfuse API                               │
│  └─► Hit? Populate L1+L2, return                │
│                                                 │
│  L4: Local Fallback (Jinja2)                    │
│  └─► Use if Langfuse unavailable                │
└─────────────────────────────────────────────────┘
```

## Monitoring Prompts

Track prompt performance in Langfuse:

```python
# Link prompt to trace for analytics
langfuse.trace(
    name="customer-analysis",
    metadata={
        "prompt_name": prompt.name,
        "prompt_version": prompt.version,
        "prompt_label": prompt.label
    }
)

# Query in Langfuse UI:
# - Filter by prompt_version
# - Compare scores across versions
# - Analyze cost per version
```
