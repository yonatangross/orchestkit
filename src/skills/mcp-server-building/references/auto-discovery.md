# MCP Auto-Discovery Optimization

Claude Code 2.1.7+ uses automatic MCP discovery via `MCPSearch`. When context exceeds 10%, your MCP tools are discovered on-demand rather than pre-loaded.

## Optimizing for Auto-Discovery

Use descriptive names and keywords:

```python
# GOOD: Descriptive, searchable
Tool(
    name="query_product_database",
    description="""
    Search the product catalog database.

    KEYWORDS: products, catalog, inventory, SKU, search
    USE WHEN: User needs product info, pricing, availability
    """,
    inputSchema={...}
)

# BAD: Generic, hard to discover
Tool(
    name="search",
    description="Search things",
    inputSchema={...}
)
```

## Token-Efficient Tool Definitions

Tool definitions consume context when loaded. Optimize for size:

```python
# Verbose: ~200 tokens
Tool(
    name="search_database",
    description="This tool allows you to search our comprehensive database...",
    inputSchema={...}  # detailed descriptions
)

# Concise: ~80 tokens
Tool(
    name="search_database",
    description="Search database. Supports: full-text, filters. Returns: {id, title, snippet}",
    inputSchema={...}  # brief descriptions
)
```

## Discovery Metadata Pattern

Add discovery hints to improve MCPSearch matching:

```python
Tool(
    name="analyze_logs",
    description="""
    Analyze application logs for errors.

    Category: Observability
    Keywords: logs, errors, debugging, monitoring
    Triggers: "check logs", "find errors", "debug issue"
    """,
    inputSchema={...}
)
```

## Best Practices for Discovery

| Practice | Benefit |
|----------|---------|
| Use action verbs in name | `query_users` not `users` |
| Include keywords in description | Better MCPSearch matching |
| Add trigger phrases | Match user language |
| Keep descriptions concise | Lower token cost |
