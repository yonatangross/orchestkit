---
name: mcp-patterns
license: MIT
compatibility: "Claude Code 2.1.34+."
author: OrchestKit
description: MCP server building, advanced patterns, and security hardening. Use when building MCP servers, implementing tool handlers, adding authentication, creating interactive UIs, hardening MCP security, or debugging MCP integrations.
version: 3.0.0
tags: [mcp, server, tools, resources, security, prompt-injection, oauth, elicitation, sampling, mcp-apps]
user-invocable: false
context: fork
complexity: high
metadata:
  category: mcp-enhancement
  spec-version: "2025-11-25"
---

# MCP Patterns

Patterns for building, composing, and securing Model Context Protocol servers. Based on the **2025-11-25 specification** — the latest stable release maintained by the [Agentic AI Foundation](https://agenticaifoundation.org/) (Linux Foundation), co-founded by Anthropic, Block, and OpenAI.

> **Scaffolding a new server?** Use Anthropic's `mcp-builder` skill (`claude install anthropics/skills`) for project setup and evaluation creation. This skill focuses on **patterns, security, and advanced features** after initial setup.
>
> **Deploying to Cloudflare?** See the `building-mcp-server-on-cloudflare` skill for Workers-specific deployment patterns.

## Decision Tree — Which Rule to Read

```
What are you building?
│
├── New MCP server
│   ├── Setup & primitives ──────► rules/server-setup.md
│   ├── Transport selection ─────► rules/server-transport.md
│   └── Scaffolding ─────────────► mcp-builder skill (anthropics/skills)
│
├── Authentication & authorization
│   └── OAuth 2.1 + OIDC ───────► rules/auth-oauth21.md
│
├── Advanced server features
│   ├── Tool composition ────────► rules/advanced-composition.md
│   ├── Resource caching ────────► rules/advanced-resources.md
│   ├── Elicitation (user input) ► rules/elicitation.md
│   ├── Sampling (agent loops) ──► rules/sampling-tools.md
│   └── Interactive UI ──────────► rules/apps-ui.md
│
├── Client-side consumption
│   └── Connecting to servers ───► rules/client-patterns.md
│
├── Security hardening
│   ├── Prompt injection defense ► rules/security-injection.md
│   └── Zero-trust & verification ► rules/security-hardening.md
│
├── Testing & debugging
│   └── Inspector + unit tests ──► rules/testing-debugging.md
│
├── Discovery & ecosystem
│   └── Registries & catalogs ──► rules/registry-discovery.md
│
└── Browser-native tools
    └── WebMCP (W3C) ───────────► rules/webmcp-browser.md
```

## Quick Reference

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| **Server** | `server-setup.md` | HIGH | FastMCP lifespan, Tool/Resource/Prompt primitives |
| **Server** | `server-transport.md` | HIGH | stdio for CLI, Streamable HTTP for production |
| **Auth** | `auth-oauth21.md` | HIGH | PKCE, RFC 8707 resource indicators, token validation |
| **Advanced** | `advanced-composition.md` | MEDIUM | Pipeline, parallel, and branching tool composition |
| **Advanced** | `advanced-resources.md` | MEDIUM | Resource caching with TTL, LRU eviction, lifecycle |
| **Advanced** | `elicitation.md` | MEDIUM | Server-initiated structured input from users |
| **Advanced** | `sampling-tools.md` | MEDIUM | Server-side agent loops with tool calling |
| **Advanced** | `apps-ui.md` | MEDIUM | Interactive UI via MCP Apps + @mcp-ui/* SDK |
| **Client** | `client-patterns.md` | MEDIUM | TypeScript/Python MCP client connection patterns |
| **Security** | `security-injection.md` | HIGH | Description sanitization, encoding normalization |
| **Security** | `security-hardening.md` | HIGH | Zero-trust allowlist, hash verification, rug pull detection |
| **Quality** | `testing-debugging.md` | MEDIUM | MCP Inspector, unit tests, transport debugging |
| **Ecosystem** | `registry-discovery.md` | LOW | Official registry API, server metadata |
| **Ecosystem** | `webmcp-browser.md` | LOW | W3C browser-native agent tools (complementary) |

**Total: 14 rules across 6 categories**

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Transport | stdio for CLI/Desktop, Streamable HTTP for production (SSE deprecated) |
| Language | TypeScript for production (better SDK support, type safety) |
| Auth | OAuth 2.1 with PKCE (S256) + RFC 8707 resource indicators |
| Server lifecycle | Always use FastMCP lifespan for resource management |
| Error handling | Return errors as text content (Claude can interpret and retry) |
| Tool composition | Pipeline for sequential, `asyncio.gather` for parallel |
| Resource caching | TTL + LRU eviction with memory cap |
| Tool trust model | Zero-trust: explicit allowlist + hash verification |
| User input | Elicitation for runtime input; never request PII via elicitation |
| Interactive UI | MCP Apps with @mcp-ui/* SDK; sandbox all iframes |
| Token handling | Never pass through client tokens to downstream services |

## Spec & Governance

- **Protocol**: Model Context Protocol, spec version **2025-11-25**
- **Governance**: Agentic AI Foundation (Linux Foundation, Dec 2025)
- **Platinum members**: AWS, Anthropic, Block, Bloomberg, Cloudflare, Google, Microsoft, OpenAI
- **Adoption**: 10,000+ servers; Claude, Cursor, Copilot, Gemini, ChatGPT, VS Code
- **Spec URL**: https://modelcontextprotocol.io/specification/2025-11-25

### Feature Maturity

| Feature | Spec Version | Status |
|---------|-------------|--------|
| Tools, Resources, Prompts | 2024-11-05 | Stable |
| Streamable HTTP transport | 2025-03-26 | Stable (replaces SSE) |
| OAuth 2.1 + Elicitation (form) | 2025-06-18 | Stable |
| Sampling with tool calling | 2025-11-25 | Stable |
| Elicitation URL mode | 2025-11-25 | Stable |
| MCP Apps (UI extension) | 2026-01-26 | Extension (ext-apps) |
| WebMCP (browser-native) | 2026-02-14 | W3C Community Draft |

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
9. Using SSE transport instead of Streamable HTTP (deprecated since March 2025)
10. Passing through client tokens to downstream services (confused deputy)

## Ecosystem

| Resource | What For |
|----------|----------|
| `mcp-builder` skill (anthropics/skills) | Scaffold new MCP servers + create evals |
| `building-mcp-server-on-cloudflare` skill | Deploy MCP servers on Cloudflare Workers |
| `@mcp-ui/*` packages (npm) | Implement MCP Apps UI standard |
| MCP Registry | Discover servers: https://registry.modelcontextprotocol.io/ |
| MCP Inspector | Debug and test servers interactively |

## Related Skills

- `llm-integration` — LLM function calling patterns
- `security-patterns` — General input sanitization and layered security
- `api-design` — REST/GraphQL API design patterns
