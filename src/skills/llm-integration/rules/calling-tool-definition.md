---
title: "Function Calling: Tool Definition"
impact: CRITICAL
impactDescription: "Strict mode schemas ensure reliable tool use and prevent hallucinated parameters"
tags: [tool, function, schema, strict-mode, openai, anthropic, langchain]
---

# Tool Definition (Strict Mode)

## OpenAI Strict Mode Schema (2026 Best Practice)

```python
# OpenAI format with strict mode (2026 recommended)
tools = [{
    "type": "function",
    "function": {
        "name": "search_documents",
        "description": "Search the document database for relevant content",
        "strict": True,  # Enables structured output validation
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return"
                }
            },
            "required": ["query", "limit"],  # All props required when strict
            "additionalProperties": False     # Required for strict mode
        }
    }
}]

# Note: With strict=True:
# - All properties must be listed in "required"
# - additionalProperties must be False
# - No "default" values (provide via code instead)
```

## Schema Factory Pattern

```python
def create_tool_schema(
    name: str,
    description: str,
    parameters: dict,
    strict: bool = True
) -> dict:
    """Create OpenAI-compatible tool schema with strict mode."""
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "strict": strict,
            "parameters": {
                "type": "object",
                "properties": parameters,
                "required": list(parameters.keys()),
                "additionalProperties": False
            }
        }
    }
```

## Anthropic Tool Schema

```python
def create_anthropic_tool(
    name: str,
    description: str,
    input_schema: dict
) -> dict:
    """Create Anthropic-compatible tool definition."""
    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": input_schema,
            "required": list(input_schema.keys())
        }
    }
```

## LangChain Tool Binding

```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field

@tool
def search_documents(query: str, limit: int = 5) -> list[dict]:
    """Search the document database.

    Args:
        query: Search query string
        limit: Maximum results to return
    """
    return db.search(query, limit=limit)

# Bind to model
llm_with_tools = llm.bind_tools([search_documents])

# Or with structured output
class SearchResult(BaseModel):
    query: str = Field(description="The search query used")
    results: list[str] = Field(description="Matching documents")

structured_llm = llm.with_structured_output(SearchResult)
```

## Structured Output (Guaranteed JSON)

```python
from pydantic import BaseModel

class Analysis(BaseModel):
    sentiment: str
    confidence: float
    key_points: list[str]

# OpenAI structured output
response = await client.beta.chat.completions.parse(
    model="gpt-5.2",
    messages=[{"role": "user", "content": "Analyze this text..."}],
    response_format=Analysis
)

analysis = response.choices[0].message.parsed  # Typed Analysis object
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Schema mode | `strict: true` (2026 best practice) |
| Description length | 1-2 sentences |
| Tool count | 5-15 max (more = confusion) |
| Output format | Structured Outputs > JSON mode |
| Parameter validation | Use Pydantic/Zod |

## Common Mistakes

- Vague tool descriptions (LLM won't know when to use)
- Missing `additionalProperties: false` in strict mode
- Using `default` values with strict mode (not supported)
- Too many tools (LLM gets confused beyond 15)
