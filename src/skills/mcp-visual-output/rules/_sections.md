---
title: MCP Visual Output Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Setup (mcp-app) -- HIGH -- 1 rule

Server-side setup for visual output. Wrong setup means tools return plain text instead of interactive UIs.

- `mcp-app-setup.md` -- createMcpApp() vs registerJsonRenderTool(), catalog registration, html bundling

## 2. Security (sandbox) -- HIGH -- 1 rule

CSP declarations and iframe sandboxing. Missing CSP blocks all external network access; overly permissive CSP creates security holes.

- `sandbox-csp.md` -- CSP domain declarations, iframe sandbox attributes, visibility controls

## 3. Rendering (streaming / dashboard) -- MEDIUM -- 2 rules

Progressive rendering and dashboard layout patterns. Affects perceived latency and component reusability.

- `streaming-output.md` -- JSON Patch streaming, progressive rendering, partial spec updates
- `dashboard-patterns.md` -- Stat grids, status badges, data tables, flat layout patterns
