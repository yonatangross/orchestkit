# Prompt Management

Version control for prompts in production, with MCP Server integration and webhook notifications.

## Basic Usage (v3)

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Get latest version of security auditor prompt
prompt = langfuse.get_prompt("security_auditor", label="production")

# Use in LLM call
response = await llm.generate(
    messages=[
        {"role": "system", "content": prompt.compile()},
        {"role": "user", "content": user_input},
    ]
)

# Link prompt to trace via @observe
from langfuse import observe, get_client

@observe()
async def analyze(user_input: str):
    prompt = langfuse.get_prompt("security_auditor", label="production")
    get_client().update_current_observation(
        metadata={"prompt_name": prompt.name, "prompt_version": prompt.version},
    )
    return await llm.generate(
        messages=[
            {"role": "system", "content": prompt.compile()},
            {"role": "user", "content": user_input},
        ]
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
    content_type="API endpoint",
)

# Result:
# "You are a security auditor. Analyze the following API endpoint..."
```

## MCP Server for Prompt Management

Langfuse exposes an MCP Server at `/api/public/mcp` for managing prompts from IDEs like Claude Code and Cursor:

### Setup

```json
{
  "mcpServers": {
    "langfuse-prompts": {
      "transport": "streamable-http",
      "url": "https://cloud.langfuse.com/api/public/mcp",
      "headers": {
        "Authorization": "Basic <base64(public_key:secret_key)>"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_prompt` | Fetch a prompt by name and optional version/label |
| `list_prompts` | List all prompts with filtering |
| `create_prompt` | Create a new prompt version |
| `update_prompt` | Update prompt labels (promote to production) |

### Usage from IDE

```
# In Claude Code or Cursor with MCP configured:
> Use the langfuse get_prompt tool to fetch "security_auditor" with label "production"
> Use the langfuse create_prompt tool to create a new version of "security_auditor"
```

## Webhooks for Prompt Changes

Get notified when prompts are updated:

### Setup in Langfuse UI

1. Navigate to **Settings → Webhooks**
2. Add webhook URL: `https://your-app.com/api/webhooks/langfuse`
3. Select events: `prompt.created`, `prompt.updated`, `prompt.label_changed`

### Webhook Payload

```json
{
  "event": "prompt.label_changed",
  "data": {
    "prompt_name": "security_auditor",
    "version": 3,
    "old_label": "staging",
    "new_label": "production",
    "changed_by": "user@example.com",
    "timestamp": "2026-02-01T12:00:00Z"
  }
}
```

### Slack Notifications

```python
# backend/app/api/webhooks/langfuse.py
from fastapi import APIRouter

router = APIRouter()

@router.post("/api/webhooks/langfuse")
async def handle_langfuse_webhook(payload: dict):
    """Handle Langfuse webhook events."""
    event = payload["event"]
    data = payload["data"]

    if event == "prompt.label_changed" and data["new_label"] == "production":
        await slack.post_message(
            channel="#llm-ops",
            text=(
                f"Prompt `{data['prompt_name']}` v{data['version']} "
                f"promoted to production by {data['changed_by']}"
            ),
        )
```

## Full-Text Search + Playground

Langfuse v3 adds full-text search across all prompt versions and a side-by-side Playground:

- **Search**: Find prompts by content, name, or labels
- **Playground**: Test prompts with different variables side-by-side
- **Compare**: View diff between prompt versions
- **History**: Full audit trail of all changes

## A/B Testing Prompts

```python
# Test two prompt versions
prompt_v1 = langfuse.get_prompt("security_auditor", version=1)
prompt_v2 = langfuse.get_prompt("security_auditor", version=2)

# Run A/B test
import random
from langfuse import observe, get_client

@observe()
async def ab_test(test_input: str):
    prompt = random.choice([prompt_v1, prompt_v2])
    get_client().update_current_trace(
        metadata={"prompt_version": prompt.version},
    )
    return await llm.generate(
        messages=[
            {"role": "system", "content": prompt.compile()},
            {"role": "user", "content": test_input},
        ]
    )

# Compare in Langfuse UI:
# - Filter by prompt_version in metadata
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
4. **Set up webhooks** for deployment notifications
5. **Use MCP Server** for IDE-based prompt management
6. **Track prompt versions** in trace metadata
7. **Use variables** for reusable prompt templates
8. **A/B test** new prompts before full rollout

## OrchestKit 4-Level Prompt Caching Architecture

OrchestKit uses a multi-level caching strategy with Jinja2 templates as L4 fallback:

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
│  └─► Located in: scripts/*.j2                             │
└─────────────────────────────────────────────────────────────┘
```

### L4 Jinja2 Template Fallback (Issue #414)

When Langfuse is unavailable, OrchestKit falls back to Jinja2 templates:

```python
from app.shared.services.prompts.template_loader import render_template

# Templates use TRUE Jinja2 syntax: {{ variable }}
# Variables passed directly to Jinja2, NOT Python .format()
prompt = render_template("supervisor/routing.j2", agent_list=agent_list)
```

**Template location:** `backend/app/shared/services/prompts/scripts/`
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
    label="production",
)
# Falls through: L1 → L2 → L3 (Langfuse) → L4 (Jinja2 templates)
```

## References

- [Langfuse Prompt Management](https://langfuse.com/docs/prompts)
- [MCP Server](https://langfuse.com/docs/integrations/mcp)
- [Prompt Webhooks](https://langfuse.com/docs/webhooks)
- [Prompt Templates Guide](https://langfuse.com/docs/prompts/get-started)
