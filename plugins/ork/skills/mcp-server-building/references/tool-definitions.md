# MCP Tool Definition Patterns

## Input Schema Best Practices

```python
Tool(
    name="search_database",
    description="Search the product database. Returns up to 10 results.",
    inputSchema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query (supports wildcards with *)"
            },
            "category": {
                "type": "string",
                "enum": ["electronics", "clothing", "books"],
                "description": "Filter by category"
            },
            "max_results": {
                "type": "integer",
                "minimum": 1,
                "maximum": 50,
                "default": 10,
                "description": "Maximum results to return"
            }
        },
        "required": ["query"]
    }
)
```

**Guidelines:**
- Always include `description` for each property
- Use `enum` for fixed option sets
- Set `minimum`/`maximum` for numbers
- Mark `required` fields explicitly
- Provide `default` values where sensible

## Error Handling

```python
@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        if name == "query_api":
            result = await external_api.query(arguments["query"])
            return [TextContent(type="text", text=json.dumps(result))]
    except ExternalAPIError as e:
        # Return error as text - Claude will see and handle it
        return [TextContent(
            type="text",
            text=f"Error: API returned {e.status_code}: {e.message}"
        )]
    except Exception as e:
        # Log internally, return user-friendly message
        logger.exception("Tool execution failed")
        return [TextContent(
            type="text",
            text=f"Error: {type(e).__name__}: {str(e)}"
        )]
```

## Caching Expensive Operations

```python
from datetime import datetime, timedelta

_cache = {}
_cache_ttl = timedelta(minutes=5)

async def get_cached_data(key: str) -> dict:
    now = datetime.now()
    if key in _cache:
        data, timestamp = _cache[key]
        if now - timestamp < _cache_ttl:
            return data

    data = await expensive_fetch(key)
    _cache[key] = (data, now)
    return data
```

## Rate Limiting

```python
import asyncio
from collections import defaultdict

_request_times = defaultdict(list)
MAX_REQUESTS_PER_MINUTE = 60

async def rate_limited_call(user_id: str, func, *args):
    now = asyncio.get_event_loop().time()
    _request_times[user_id] = [
        t for t in _request_times[user_id]
        if now - t < 60
    ]

    if len(_request_times[user_id]) >= MAX_REQUESTS_PER_MINUTE:
        raise Exception("Rate limit exceeded. Try again in a minute.")

    _request_times[user_id].append(now)
    return await func(*args)
```

## Anti-Patterns

1. **Stateful tools without cleanup**: Always clean up connections/resources
2. **Blocking synchronous code**: Use `asyncio.to_thread()` for blocking ops
3. **Missing input validation**: Always validate before processing
4. **Secrets in tool output**: Never return API keys or credentials
5. **Unbounded responses**: Limit response sizes (Claude has context limits)
