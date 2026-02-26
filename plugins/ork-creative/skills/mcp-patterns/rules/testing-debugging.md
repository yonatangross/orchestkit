---
title: Test and debug MCP servers to catch broken tools and transport failures before production
impact: "MEDIUM"
impactDescription: "Untested MCP servers ship broken tools and opaque transport failures that are impossible to diagnose in production"
tags: [testing, debugging, pytest, inspector, fixtures]
---

## Testing & Debugging

Write automated tests for every tool using the SDK's in-process `Client`, and use MCP Inspector for interactive debugging of transports and auth.

**Incorrect -- manual testing only, no assertions:**
```python
# "I'll just test it in Claude Desktop"
mcp = FastMCP("my-server")

@mcp.tool()
def search(query: str) -> str:
    return db.search(query)

# No tests, no fixtures, no CI -- bugs found by end users
```

**Correct -- unit tests with in-process Client:**
```python
import pytest
from mcp import Client
from mcp.types import CallToolResult, TextContent
from server import app

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client():
    async with Client(app, raise_exceptions=True) as c:
        yield c

@pytest.mark.anyio
async def test_search_returns_results(client: Client):
    result = await client.call_tool("search", {"query": "test"})
    assert isinstance(result, CallToolResult)
    assert len(result.content) > 0
    assert result.content[0].type == "text"

@pytest.mark.anyio
async def test_search_empty_query(client: Client):
    result = await client.call_tool("search", {"query": ""})
    assert "Error" in result.content[0].text  # Graceful error, not crash
```

**Correct -- parametrized edge-case tests:**
```python
@pytest.mark.anyio
@pytest.mark.parametrize("args", [{"query": ""}, {"max_results": -1}, {}])
async def test_invalid_inputs_return_errors(client: Client, args):
    result = await client.call_tool("search", args)
    assert result.isError or "Error" in result.content[0].text
```

**Correct -- integration test with stdio transport:**
```python
import subprocess, json

def test_stdio_transport_connects():
    """Verify the server starts and responds to initialize over stdio."""
    proc = subprocess.Popen(
        ["uv", "run", "server.py"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    init_msg = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"capabilities": {}, "clientInfo": {"name": "test"},
                           "protocolVersion": "2025-03-26"}}
    proc.stdin.write(json.dumps(init_msg).encode() + b"\n")
    proc.stdin.flush()
    line = proc.stdout.readline()
    assert b'"result"' in line  # Server responded to init
    proc.terminate()
```

**Interactive debugging with MCP Inspector:**
```bash
# Inspect a local Python server
npx @modelcontextprotocol/inspector uv run server.py

# Inspect a PyPI package
npx @modelcontextprotocol/inspector uvx mcp-server-git --repository ~/repo

# Inspect with environment variables
npx @modelcontextprotocol/inspector -e API_KEY=xxx uv run server.py

# Use Inspector to: list tools/resources, test tool calls with custom
# inputs, check capability negotiation, and view server logs.
# For scaffolding new servers, see the mcp-builder skill.
```

**Debug common connection failures:**
```bash
# Timeout: slow lifespan init blocks connection -- keep lifespan under 5s
# Auth 401: pass secrets via Inspector's -e flag or .env file
# "Connection refused": wrong transport -- match stdio vs Streamable HTTP
# Hang on tool call: blocking sync code -- wrap with asyncio.to_thread()
```

**Key rules:**
- Use `Client(app, raise_exceptions=True)` for unit tests -- no transport overhead
- Test both valid inputs and edge cases (empty, missing, out-of-range)
- Use `@pytest.mark.anyio` with `anyio_backend` fixture for async tests
- Use MCP Inspector (`npx @modelcontextprotocol/inspector`) for interactive debugging
- Keep lifespan initialization under 5s so Inspector and clients can connect
- Test stdio transport separately with `subprocess` for integration coverage
- Install test deps: `pip install inline-snapshot pytest anyio`
