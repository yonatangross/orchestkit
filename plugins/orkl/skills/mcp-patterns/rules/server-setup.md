---
title: Set up MCP servers with proper lifecycle management and structured error handling
impact: HIGH
impactDescription: "Missing lifecycle management causes resource leaks; wrong error handling crashes the server instead of returning useful feedback to Claude"
tags: server, fastmcp, lifespan, tools, resources, prompts, error-handling
---

## Server Setup

Use FastMCP with lifespan context for shared resources. Define tools with explicit schemas and return errors as text content.

**Incorrect -- no lifecycle, raw exception:**
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")
db = Database.connect()  # Global -- never cleaned up

@mcp.tool()
def query(sql: str) -> str:
    return db.query(sql)  # Crashes on connection failure
```

**Correct -- FastMCP with lifespan and error handling:**
```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from dataclasses import dataclass
from mcp.server.fastmcp import Context, FastMCP

@dataclass
class AppContext:
    db: Database
    cache: CacheService

@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    db = await Database.connect()
    cache = await CacheService.connect()
    try:
        yield AppContext(db=db, cache=cache)
    finally:
        await cache.disconnect()
        await db.disconnect()

mcp = FastMCP("my-server", lifespan=app_lifespan)

@mcp.tool()
def query(sql: str, ctx: Context) -> str:
    """Execute a read-only SQL query. Returns up to 100 rows."""
    try:
        app = ctx.request_context.lifespan_context
        return app.db.query(sql)
    except DatabaseError as e:
        return f"Error: {e}"  # Claude sees and can retry
```

**Tool definition best practices:**
```python
from mcp.types import Tool

Tool(
    name="search_products",
    description="Search product catalog. Returns up to 10 results.",
    inputSchema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search terms"},
            "category": {
                "type": "string",
                "enum": ["electronics", "clothing", "books"],
            },
            "max_results": {
                "type": "integer", "minimum": 1, "maximum": 50, "default": 10,
            },
        },
        "required": ["query"],
    },
)
```

**Key rules:**
- Always use lifespan for database connections, caches, HTTP clients
- Return errors as `TextContent` -- never raise unhandled exceptions
- Include `description` for every schema property
- Use `enum` for fixed option sets, `minimum`/`maximum` for numbers
- Use `asyncio.to_thread()` for blocking synchronous operations
- Limit response sizes (Claude has context limits)
