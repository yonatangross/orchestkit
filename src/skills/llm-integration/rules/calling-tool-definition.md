---
title: Define tool schemas with strict mode to prevent hallucinated parameters and ensure reliability
impact: CRITICAL
impactDescription: "Strict mode schemas ensure reliable tool use and prevent hallucinated parameters"
tags: [tool, function, schema, strict-mode, openai, anthropic, langchain]
---

# Tool Definition (Strict Mode)

Upstream (do not restate): OpenAI strict mode, structured outputs and the full
parameter grammar live at https://platform.openai.com/docs/guides/function-calling.
Anthropic `input_schema` / `tool_use` lives at
https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview. LangChain
`@tool` and `bind_tools` live in the LangChain docs. This rule keeps only the
three constraints teams get wrong and our house ceilings.

## The three strict-mode constraints

```python
tools = [{
    "type": "function",
    "function": {
        "name": "search_documents",
        "description": "Search the document database for relevant content",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "limit": {"type": "integer", "description": "Max results to return"}
            },
            "required": ["query", "limit"],   # 1. ALL properties, not just the mandatory ones
            "additionalProperties": False      # 2. required, not optional, under strict
        }
    }
}]
# 3. No "default" values anywhere in the schema. Apply defaults in code
#    after the call, never in the parameter declaration.
```

Anthropic uses `input_schema` instead of `function.parameters` and has no
`strict` flag; the "describe every parameter" discipline still applies.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Schema mode | `strict: true` |
| Description length | 1-2 sentences |
| Tool count | 5-15 max (more = confusion) |
| Output format | Structured Outputs > JSON mode |
| Parameter validation | Use Pydantic/Zod |
| Model ids in examples | Plain defaults only, never a hardcoded price |

## Common Mistakes

- Vague tool descriptions (LLM will not know when to use the tool)
- Missing `additionalProperties: false` in strict mode
- Using `default` values with strict mode (not supported)
- Too many tools (LLM gets confused beyond 15)

**Incorrect, invalid strict mode schema with optional parameters:**
```python
tools = [{
    "type": "function",
    "function": {
        "name": "search",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "default": 10}  # Invalid with strict
            },
            "required": ["query"]  # Must include all props when strict=True
        }
    }
}]
```

**Correct, strict mode with all properties required:**
```python
tools = [{
    "type": "function",
    "function": {
        "name": "search",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer"}
            },
            "required": ["query", "limit"],  # All properties required
            "additionalProperties": False    # Required for strict mode
        }
    }
}]
```
