---
name: mcp-patterns
description: MCP server building, advanced patterns, and security hardening
tags: [mcp, server, tools, resources, security, prompt-injection]
user-invocable: false
context: fork
complexity: high
---

# MCP Patterns

Comprehensive patterns for building, composing, and securing Model Context Protocol servers. Covers server setup and transport selection, advanced tool composition and resource management, and defense-in-depth security hardening against prompt injection and tool poisoning attacks.

## Quick Reference

| Rule | File | Impact | Key Pattern |
|------|------|--------|-------------|
| Server Setup | `rules/server-setup.md` | HIGH | FastMCP lifespan, Tool/Resource/Prompt primitives |
| Server Transport | `rules/server-transport.md` | HIGH | stdio for CLI, SSE for web, Streamable HTTP for production |
| Advanced Composition | `rules/advanced-composition.md` | MEDIUM | Pipeline, parallel, and branching tool composition |
| Advanced Resources | `rules/advanced-resources.md` | MEDIUM | Resource caching with TTL, LRU eviction, lifecycle |
| Security Injection | `rules/security-injection.md` | HIGH | Description sanitization, encoding normalization, threat detection |
| Security Hardening | `rules/security-hardening.md` | HIGH | Zero-trust allowlist, hash verification, rug pull detection |

**Total: 6 rules across 3 categories**

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Transport | stdio for CLI/Desktop, SSE for browsers, Streamable HTTP for production |
| Language | TypeScript for production (better SDK support, type safety) |
| Server lifecycle | Always use FastMCP lifespan for resource management |
| Error handling | Return errors as text content (Claude can interpret and retry) |
| Tool composition | Pipeline for sequential, `asyncio.gather` for parallel |
| Resource caching | TTL + LRU eviction with memory cap |
| Tool trust model | Zero-trust: explicit allowlist + hash verification |
| Description handling | Normalize encodings, detect injection patterns, sanitize |
| Sensitive operations | Human-in-the-loop approval for high-risk tools |

## Example

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
async def search(query: str) -> str:
    """Search documents. Returns matching results."""
    results = await db.search(query)
    return "\n".join(r.title for r in results[:10])
```

## Common Mistakes

1. No lifecycle management (connection/resource leaks on shutdown)
2. Missing input validation on tool arguments
3. Returning secrets in tool output (API keys, credentials)
4. Unbounded response sizes (Claude has context limits)
5. Trusting tool descriptions without sanitization (injection risk)
6. No hash verification on tool invocations (rug pull vulnerability)
7. Storing auth tokens in session IDs (credential leak)
8. Blocking synchronous code in async server (use `asyncio.to_thread()`)

## Related Skills

- `llm-integration` - LLM function calling patterns
- `security-patterns` - General input sanitization and layered security
- `streaming-api-patterns` - Real-time streaming patterns
