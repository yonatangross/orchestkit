---
title: Registry Discovery
impact: LOW
impactDescription: "Without proper vetting, blindly installing community MCP servers risks supply-chain attacks, data exfiltration, or rug-pull tool modifications"
tags: registry, discovery, vetting, security, trust, smithery, mcp-run
---

## Registry Discovery

Use the official MCP Registry API for programmatic server discovery and apply a vetting checklist before installing any third-party server.

**Incorrect -- blindly install unvetted servers:**
```python
# Grabbed a random server name from a blog post
config = {"mcpServers": {"sketchy-db": {"command": "npx", "args": ["@unknown/mcp-db"]}}}
# No source review, no version pinning, no permission audit
```

**Correct -- query the official registry and vet before installing:**
```python
import httpx

REGISTRY = "https://registry.modelcontextprotocol.io"

async def discover_servers(query: str) -> list[dict]:
    """Search the official MCP Registry API."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{REGISTRY}/v0.1/servers", params={
            "search": query, "version": "latest", "limit": 20,
        })
        resp.raise_for_status()
        return resp.json()["servers"]

async def get_server_detail(name: str, version: str = "latest") -> dict:
    """Fetch full metadata for a specific server."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{REGISTRY}/v0.1/servers/{name}/versions/{version}")
        resp.raise_for_status()
        return resp.json()

def vet_server(server: dict) -> list[str]:
    """Return warnings if server fails vetting checks."""
    warnings = []
    s = server.get("server", server)
    if not s.get("repository", {}).get("url"):
        warnings.append("No public source repository")
    if not s.get("packages"):
        warnings.append("Not published to any package registry")
    meta = server.get("_meta", {}).get("io.modelcontextprotocol.registry/official", {})
    if meta.get("status") != "active":
        warnings.append(f"Registry status: {meta.get('status', 'unknown')}")
    return warnings
```

**Community directories for broader discovery:**

| Directory | URL | Notes |
|-----------|-----|-------|
| Official Registry | registry.modelcontextprotocol.io | API-accessible, moderation |
| mcp.run | mcp.run | Hosted runtime, sandboxed |
| Smithery | smithery.ai | Install counts, reviews |
| Glama | glama.ai/mcp/servers | Curated catalog |
| MCP Servers | mcpservers.org | Community-maintained list |

**Vetting checklist before installing any server:**
```markdown
- [ ] Source code in a public repository with commit history
- [ ] Published to npm/PyPI (not just a git clone)
- [ ] Version pinned in config (no `@latest` in production)
- [ ] README documents all tools, resources, and required permissions
- [ ] No overly broad capabilities (filesystem root, network wildcard)
- [ ] Active maintenance (commits within last 90 days)
- [ ] Listed in official registry or reputable directory
```

**Icon metadata (spec 2025-11-25) -- expose icons for tools/resources:**
```python
@mcp.tool(metadata={"icon": "https://example.com/icons/search.svg"})
def search(query: str) -> str:
    """Search documents."""
    ...
```

**Key rules:**
- Always query the official registry at `registry.modelcontextprotocol.io/v0.1/servers` first
- Never install a server without checking its source repository and package provenance
- Pin exact versions in MCP server configurations -- avoid `@latest` in production
- Cross-reference multiple directories (registry, smithery, mcp.run) for trust signals
- Treat community servers as untrusted by default; apply allowlist patterns from security-hardening
- Use `vet_server()` checks programmatically when building multi-server orchestrations
