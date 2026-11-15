---
title: Integrate WebMCP browser mediation correctly to avoid confusing it with standard MCP
impact: LOW
impactDescription: "Confusing WebMCP with MCP leads to wrong transport choice; skipping browser mediation exposes tools without user consent"
tags: [webmcp, browser, navigator, client-side, w3c]
---

## WebMCP Browser Integration

WebMCP is a W3C Community Group standard that exposes structured tools to AI agents inside the browser via `navigator.modelContext`. It complements MCP (not a replacement) — MCP handles AI-to-backend over JSON-RPC, WebMCP handles AI-to-browser-UI via in-page callbacks.

**Incorrect -- registering tools without input schema or user mediation:**
```typescript
// No schema, no description, no user interaction handling
navigator.modelContext.registerTool({
  name: "submit-order",
  description: "Submit order",
  execute: async (input) => {
    // Directly mutates state with no user confirmation
    await fetch("/api/orders", { method: "POST", body: JSON.stringify(input) });
    return { status: "submitted" };
  },
});
```

**Correct -- full schema, annotations, and user interaction request:**
```typescript
navigator.modelContext.registerTool({
  name: "submit-order",
  description: "Submit the current shopping cart as an order. Requires user confirmation.",
  inputSchema: {
    type: "object",
    properties: {
      cartId:    { type: "string", description: "Cart identifier" },
      shipping:  { type: "string", enum: ["standard", "express"] },
    },
    required: ["cartId"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input, client) => {
    // Request explicit user confirmation before mutating state
    const confirmed = await client.requestUserInteraction(async () => {
      return window.confirm(`Place order for cart ${input.cartId}?`);
    });
    if (!confirmed) return { status: "cancelled_by_user" };
    const res = await fetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { status: "submitted", orderId: (await res.json()).id };
  },
});
```

**Read-only tool with annotations:**
```typescript
navigator.modelContext.registerTool({
  name: "get-product-details",
  description: "Retrieve product name, price, and availability from the current page.",
  inputSchema: {
    type: "object",
    properties: {
      productId: { type: "string", description: "Product ID visible on page" },
    },
    required: ["productId"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const el = document.querySelector(`[data-product-id="${input.productId}"]`);
    return el ? { name: el.dataset.name, price: el.dataset.price } : { error: "Not found" };
  },
});
```

**When to use MCP vs WebMCP:**

| Concern | MCP | WebMCP |
|---------|-----|--------|
| Transport | JSON-RPC (stdio / SSE / HTTP) | In-page callbacks |
| Runs on | Server / backend | Browser (SecureContext) |
| Use case | DB queries, APIs, file I/O | DOM access, form fill, UI actions |
| Auth | OAuth 2.1 / tokens | Browser-mediated permission |

**Key rules:**
- WebMCP complements MCP — use MCP for backend services, WebMCP for browser-side UI tools
- Always provide `inputSchema` with property descriptions so agents understand parameters
- Set `annotations.readOnlyHint: true` on tools that only read data (no side effects)
- Use `client.requestUserInteraction()` before any state-mutating operation
- WebMCP requires `SecureContext` (HTTPS only) — `navigator.modelContext` is undefined on HTTP
- Call `unregisterTool(name)` or `clearContext()` during SPA route teardown to prevent stale tools
- Keep tool descriptions specific — agents select tools by description, not by probing
