# MCP Testing Patterns

## Manual Testing with Inspector

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector python server.py
```

The Inspector provides an interactive UI to:
- List available tools and resources
- Call tools with custom arguments
- View responses and errors

## Automated Testing

```python
import pytest
from mcp.client import Client
from mcp.client.stdio import stdio_client

@pytest.mark.asyncio
async def test_greet_tool():
    async with stdio_client("python", ["server.py"]) as (read, write):
        client = Client("test", "1.0.0")
        await client.connect(read, write)

        # List tools
        tools = await client.list_tools()
        assert any(t.name == "greet" for t in tools.tools)

        # Call tool
        result = await client.call_tool("greet", {"name": "World"})
        assert "Hello, World!" in result.content[0].text
```

## Integration Testing Pattern

```python
@pytest.fixture
async def mcp_client():
    """Create MCP client for testing."""
    async with stdio_client("python", ["server.py"]) as (read, write):
        client = Client("test", "1.0.0")
        await client.connect(read, write)
        yield client

@pytest.mark.asyncio
async def test_search_returns_results(mcp_client):
    result = await mcp_client.call_tool("search", {"query": "test"})
    data = json.loads(result.content[0].text)
    assert len(data["results"]) > 0

@pytest.mark.asyncio
async def test_search_handles_empty_query(mcp_client):
    result = await mcp_client.call_tool("search", {"query": ""})
    assert "Error" in result.content[0].text
```

## Testing Error Conditions

```python
@pytest.mark.asyncio
async def test_handles_api_timeout(mcp_client, mock_api):
    mock_api.delay = 30  # Simulate timeout
    result = await mcp_client.call_tool("fetch_data", {"id": "123"})
    assert "timeout" in result.content[0].text.lower()

@pytest.mark.asyncio
async def test_handles_invalid_input(mcp_client):
    result = await mcp_client.call_tool("process", {"data": None})
    assert "Error" in result.content[0].text
```
