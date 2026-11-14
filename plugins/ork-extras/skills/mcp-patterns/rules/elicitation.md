---
title: Use MCP elicitation safely with consent handling and secure form-mode data collection
impact: "MEDIUM"
impactDescription: "Requesting sensitive data via form mode exposes credentials to the LLM context; skipping user consent or mishandling cancel/decline breaks trust and leaves servers in inconsistent state"
tags: [elicitation, form-mode, url-mode, security, json-schema, oauth]
---

## Elicitation

MCP elicitation lets servers request structured input from users at runtime via form mode (JSON Schema) or URL mode (external flows). Form mode collects non-sensitive data in-band; URL mode redirects users to secure pages for credentials, OAuth, or payments.

**Incorrect -- requesting secrets via form mode, ignoring decline/cancel:**
```python
@mcp.tool()
async def connect_api(ctx: Context) -> str:
    # WRONG: form mode exposes secrets to the LLM context
    result = await ctx.session.create_elicitation(
        mode="form",
        message="Enter your API key",
        requestedSchema={
            "type": "object",
            "properties": {
                "api_key": {"type": "string"},
                # WRONG: nested objects not allowed in elicitation schemas
                "config": {"type": "object", "properties": {"timeout": {"type": "number"}}},
            },
        },
    )
    # WRONG: assumes accept, crashes on decline/cancel
    return call_api(result.content["api_key"])
```

**Correct -- form mode for non-sensitive data, flat schema, handle all actions:**
```python
@mcp.tool()
async def configure_search(ctx: Context) -> str:
    result = await ctx.session.create_elicitation(
        mode="form",
        message="Configure your search preferences",
        requestedSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "minLength": 1, "description": "Search terms"},
                "category": {
                    "type": "string",
                    "enum": ["docs", "code", "issues"],
                    "default": "docs",
                },
                "max_results": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 50,
                    "default": 10,
                },
            },
            "required": ["query"],
        },
    )

    if result.action == "accept":
        return search(result.content)
    elif result.action == "decline":
        return "Search cancelled. Let me know if you'd like to try different options."
    else:  # cancel
        return "Search dismissed. I can search with defaults if you'd like."
```

**Correct -- URL mode for sensitive data (API keys, OAuth):**
```python
@mcp.tool()
async def connect_service(ctx: Context) -> str:
    elicitation_id = str(uuid.uuid4())

    result = await ctx.session.create_elicitation(
        mode="url",
        message="Please authorize access to your account.",
        elicitation_id=elicitation_id,
        url=f"https://myserver.example.com/connect?eid={elicitation_id}",
    )

    if result.action == "accept":
        # User consented to open URL -- interaction happens out-of-band.
        # Server sends notifications/elicitation/complete when done.
        return "Authorization started. I'll proceed once you complete the flow."
    elif result.action == "decline":
        return "Authorization declined. Some features will be unavailable."
    else:  # cancel
        return "Authorization dismissed."
```

**Correct -- client declares elicitation capabilities:**
```typescript
const client = new Client({
  name: "my-client",
  version: "1.0.0",
}, {
  capabilities: {
    elicitation: { form: {}, url: {} },  // declare supported modes
  },
});
```

**Key rules:**
- Never request secrets (API keys, passwords, tokens) via form mode -- use URL mode instead
- Schemas must be flat objects with primitive properties only (string, number, integer, boolean, enum) -- no nested objects or `$ref`
- Always handle all three response actions: `accept`, `decline`, `cancel`
- URL mode `accept` means user consented to open the URL, not that the flow is complete -- listen for `notifications/elicitation/complete`
- Clients must show the full URL and get explicit consent before opening; never auto-fetch or auto-navigate
- Servers must verify the user who completes a URL flow is the same user who initiated it (prevent phishing/account takeover)
- Check client capabilities before sending elicitation requests -- clients may support only `form`, only `url`, or both

Reference: https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation
