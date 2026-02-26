---
title: MCP Patterns Rule Categories
version: 2.0.0
spec-version: "2025-11-25"
---

# Rule Categories

## 1. Server (server) — HIGH — 2 rules

Core MCP server setup and transport configuration. Wrong transport choice or missing lifecycle management causes resource leaks and connection failures.

- `server-setup.md` — FastMCP lifespan, Tool/Resource/Prompt primitives, error handling
- `server-transport.md` — stdio vs Streamable HTTP (SSE deprecated), session management

## 2. Auth (auth) — HIGH — 1 rule

OAuth 2.1 authentication and authorization for remote MCP servers. Required for any server exposed over Streamable HTTP.

- `auth-oauth21.md` — PKCE (S256), RFC 8707 resource indicators, token validation, dynamic client registration

## 3. Advanced (advanced) — MEDIUM — 5 rules

Tool composition, resource management, and new spec features for production-grade MCP servers.

- `advanced-composition.md` — Pipeline, parallel, and branching tool composition patterns
- `advanced-resources.md` — Resource caching with TTL, LRU eviction, memory caps
- `elicitation.md` — Server-initiated structured user input (form + URL modes)
- `sampling-tools.md` — Server-side agent loops with tool calling and parallel execution
- `apps-ui.md` — Interactive UI via MCP Apps extension + @mcp-ui/* SDK

## 4. Client (client) — MEDIUM — 1 rule

Patterns for consuming MCP servers from your application as a client.

- `client-patterns.md` — TypeScript/Python client setup, session management, reconnection

## 5. Security (security) — HIGH — 2 rules

Defense-in-depth against prompt injection, tool poisoning, and data exfiltration through MCP integrations.

- `security-injection.md` — Description sanitization, encoding normalization, threat detection
- `security-hardening.md` — Zero-trust allowlist, hash verification, rug pull detection, capability enforcement

## 6. Quality (quality) — MEDIUM — 1 rule

Testing, debugging, and observability for MCP servers.

- `testing-debugging.md` — MCP Inspector, unit testing tools, integration testing transports

## 7. Ecosystem (ecosystem) — LOW — 2 rules

Discovery, registries, and complementary protocols.

- `registry-discovery.md` — Official MCP Registry API, server metadata, programmatic discovery
- `webmcp-browser.md` — W3C WebMCP browser-native agent tools (complementary to MCP)
