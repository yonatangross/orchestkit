# Prompt Management

Version control for prompts in production.

## Basic Usage

```python
# Fetch prompt from Langfuse
from langfuse import Langfuse

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

# Link prompt to trace
langfuse.trace(
    name="security_analysis",
    metadata={"prompt_version": prompt.version}
)
```

## Prompt Versioning in UI

```
security_auditor
├── v1 (Jan 15, 2025) - production
│   └── "You are a security auditor. Analyze code for..."
├── v2 (Jan 20, 2025) - staging
│   └── "You are an expert security auditor. Focus on..."
└── v3 (Jan 25, 2025) - draft
    └── "As a cybersecurity expert, thoroughly analyze..."
```

## Prompt Templates with Variables

```python
# Create prompt in Langfuse UI:
# "You are a {{role}}. Analyze the following {{content_type}}..."

# Fetch and compile with variables
prompt = langfuse.get_prompt("content_analyzer")
compiled = prompt.compile(
    role="security auditor",
    content_type="API endpoint"
)

# Result:
# "You are a security auditor. Analyze the following API endpoint..."
```

## A/B Testing Prompts

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

## Prompt Labels

Use labels for environment-specific prompts:

```python
# Development
dev_prompt = langfuse.get_prompt("analyzer", label="dev")

# Staging
staging_prompt = langfuse.get_prompt("analyzer", label="staging")

# Production
prod_prompt = langfuse.get_prompt("analyzer", label="production")
```

## Best Practices

1. **Use prompt management** instead of hardcoded prompts
2. **Version all prompts** with meaningful descriptions
3. **Test in staging** before promoting to production
4. **Track prompt versions** in trace metadata
5. **Use variables** for reusable prompt templates
6. **A/B test** new prompts before full rollout
7. **Document changes** in version notes

## SkillForge 4-Level Prompt Caching Architecture

SkillForge uses a multi-level caching strategy with Jinja2 templates as L4 fallback:

```
┌─────────────────────────────────────────────────────────────┐
│                    PROMPT RESOLUTION                        │
├─────────────────────────────────────────────────────────────┤
│  L1: In-Memory LRU Cache (5min TTL)                         │
│  └─► Hit? Return cached prompt                              │
│                                                             │
│  L2: Redis Cache (15min TTL)                                │
│  └─► Hit? Populate L1, return prompt                        │
│                                                             │
│  L3: Langfuse API (cloud-managed)                           │
│  └─► Hit? Populate L1+L2, return prompt (uses {var} syntax) │
│                                                             │
│  L4: Jinja2 Templates (local fallback)                      │
│  └─► Uses TRUE Jinja2 {{ var }} syntax                      │
│  └─► Variables passed at render time                        │
│  └─► Located in: templates/*.j2                             │
└─────────────────────────────────────────────────────────────┘
```

### L4 Jinja2 Template Fallback (Issue #414)

When Langfuse is unavailable, SkillForge falls back to Jinja2 templates:

```python
from app.shared.services.prompts.template_loader import render_template

# Templates use TRUE Jinja2 syntax: {{ variable }}
# Variables passed directly to Jinja2, NOT Python .format()
prompt = render_template("supervisor/routing.j2", agent_list=agent_list)
```

**Template location:** `backend/app/shared/services/prompts/templates/`
- `supervisor/routing.j2` - Supervisor routing prompt
- `agents/tier1/*.j2` - Tier 1 universal agents
- `agents/tier2/*.j2` - Tier 2 validation agents
- `agents/tier3/*.j2` - Tier 3 research agents
- `evaluators/*.j2` - G-Eval evaluator prompts

### Variable Syntax Distinction

| Source | Syntax | Substitution |
|--------|--------|--------------|
| Langfuse prompts | `{variable}` | Python regex-based (via `_compile_prompt()`) |
| Jinja2 templates | `{{ variable }}` | Native Jinja2 (via `render_template()`) |

## Migration from Hardcoded Prompts (DEPRECATED)

The old `HARDCODED_PROMPTS` dict is **REMOVED**. All prompts now use:
1. **Langfuse** (primary, cloud-managed)
2. **Jinja2 templates** (L4 fallback, version-controlled)

```python
# OLD (DEPRECATED - DO NOT USE):
system_prompt = HARDCODED_PROMPTS["security_auditor"]

# NEW (Recommended):
prompt_manager = get_prompt_manager()
system_prompt = await prompt_manager.get_prompt(
    name="analysis-agent-security-auditor",
    variables={},
    label="production"
)
# Falls through: L1 → L2 → L3 (Langfuse) → L4 (Jinja2 templates)
```

## References

- [Langfuse Prompt Management](https://langfuse.com/docs/prompts)
- [Prompt Templates Guide](https://langfuse.com/docs/prompts/get-started)
- [A/B Testing Prompts](https://langfuse.com/docs/prompts/example-openai-functions)
