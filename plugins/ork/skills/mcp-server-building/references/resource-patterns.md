# MCP Resource Patterns

Resources are data that Claude can read (files, API responses, etc).

## File Resources

```python
@server.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="file:///config/settings.json",
            name="Settings",
            mimeType="application/json",
            description="Application configuration"
        )
    ]

@server.read_resource()
async def read_resource(uri: str) -> str:
    if uri == "file:///config/settings.json":
        return Path("settings.json").read_text()
    raise ValueError(f"Unknown resource: {uri}")
```

## Dynamic Resources (API Data)

```python
@server.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="api://users/current",
            name="Current User",
            mimeType="application/json"
        ),
        Resource(
            uri="api://metrics/today",
            name="Today's Metrics",
            mimeType="application/json"
        )
    ]

@server.read_resource()
async def read_resource(uri: str) -> str:
    if uri.startswith("api://"):
        endpoint = uri.replace("api://", "")
        data = await api_client.get(endpoint)
        return json.dumps(data, indent=2)
```

## Resource vs Tool Decision

| Use Resource When | Use Tool When |
|-------------------|---------------|
| Data is read-only | Data is modified |
| Content is static or cacheable | Action has side effects |
| Claude needs to browse/explore | Specific operation needed |

## Resource URI Schemes

- `file://` - Local filesystem
- `api://` - API endpoints
- `db://` - Database queries
- `mem://` - In-memory data
