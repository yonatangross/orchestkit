---
title: MCP Patterns Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Server (server) -- HIGH -- 2 rules

Core MCP server setup and transport configuration. Wrong transport choice or missing lifecycle management causes resource leaks and connection failures.

- `server-setup.md` -- FastMCP lifespan, Tool/Resource/Prompt primitives, error handling
- `server-transport.md` -- stdio vs SSE vs Streamable HTTP, Claude Desktop config

## 2. Advanced (advanced) -- MEDIUM -- 2 rules

Tool composition workflows and resource caching for production-grade MCP servers.

- `advanced-composition.md` -- Pipeline, parallel, and branching tool composition patterns
- `advanced-resources.md` -- Resource caching with TTL, LRU eviction, memory caps

## 3. Security (security) -- HIGH -- 2 rules

Defense-in-depth against prompt injection, tool poisoning, and data exfiltration through MCP integrations.

- `security-injection.md` -- Description sanitization, encoding normalization, threat detection
- `security-hardening.md` -- Zero-trust allowlist, hash verification, rug pull detection, capability enforcement
