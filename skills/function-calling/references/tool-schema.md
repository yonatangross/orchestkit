# Tool Schema Patterns

Define robust tool schemas for OpenAI and Anthropic function calling.

## OpenAI Strict Mode Schema

```python
from typing import Literal

def create_tool_schema(
    name: str,
    description: str,
    parameters: dict,
    strict: bool = True
) -> dict:
    """Create OpenAI-compatible tool schema with strict mode."""
    schema = {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "strict": strict,
            "parameters": {
                "type": "object",
                "properties": parameters,
                "required": list(parameters.keys()),  # All required in strict
                "additionalProperties": False
            }
        }
    }
    return schema

# Example: Search tool
search_tool = create_tool_schema(
    name="search_documents",
    description="Search knowledge base for relevant documents",
    parameters={
        "query": {"type": "string", "description": "Search query"},
        "limit": {"type": "integer", "description": "Max results (1-100)"},
        "filters": {
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "date_from": {"type": "string", "format": "date"}
            },
            "required": ["category", "date_from"],
            "additionalProperties": False
        }
    }
)
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

# Anthropic usage
tools = [create_anthropic_tool(
    name="get_weather",
    description="Get current weather for a location",
    input_schema={
        "location": {"type": "string", "description": "City name"},
        "units": {"type": "string", "enum": ["celsius", "fahrenheit"]}
    }
)]
```

## Configuration

- `strict: true` - Enforces schema compliance (OpenAI)
- `additionalProperties: false` - No extra fields allowed
- All properties in `required` array for strict mode
- Use `enum` for fixed choices

## Cost Optimization

- Shorter descriptions reduce prompt tokens
- Limit tools to 5-15 per request
- Cache tool schemas (they're static)
- Disable parallel_tool_calls with strict mode