---
title: "MCP Apps UI"
impact: "MEDIUM"
impactDescription: "Without proper sandbox and CSP declarations, UI resources render without network access or fail to load external assets; missing visibility controls expose internal tools to the model"
tags: [mcp-apps, ui-resource, sandbox, csp, iframe, ext-apps, visibility]
---

## MCP Apps UI

MCP Apps (SEP-1865) let tools return interactive UIs rendered in sandboxed iframes. Declare `ui://` resources, link them to tools via `_meta.ui.resourceUri`, and configure CSP domains for secure external access.

**Incorrect -- no CSP, no sandbox awareness, no visibility control:**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "my-app", version: "1.0.0" });

// BAD: resource uses generic mimeType, no ui:// scheme
server.registerResource("dashboard", "https://my-app.com/dashboard", {
  mimeType: "text/html",
});

// BAD: no _meta.ui linkage, no visibility — internal tool exposed to model
server.registerTool("refresh_dashboard", {
  description: "Refresh dashboard data",
  inputSchema: { type: "object" },
}, async () => ({
  content: [{ type: "text", text: "refreshed" }],
}));
```

**Correct -- `registerAppTool`/`registerAppResource` with CSP and visibility:**
```typescript
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE, // "text/html;profile=mcp-app"
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

const server = new McpServer({ name: "my-app", version: "1.0.0" });
const RESOURCE_URI = "ui://my-app/dashboard";

// Declare CSP domains for external tile/API access
const cspMeta = {
  ui: {
    csp: {
      connectDomains: ["https://api.example.com"],       // fetch/XHR/WebSocket
      resourceDomains: ["https://cdn.jsdelivr.net"],     // scripts, images, styles
      frameDomains: ["https://www.youtube.com"],         // nested iframes
    },
    prefersBorder: true,
  },
};

// Register UI resource with CSP metadata
registerAppResource(server, RESOURCE_URI, RESOURCE_URI,
  { mimeType: RESOURCE_MIME_TYPE },
  async (): Promise<ReadResourceResult> => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: htmlContent,
      _meta: cspMeta,
    }],
  }),
);

// Tool visible to both model and app (default)
registerAppTool(server, "get-dashboard", {
  title: "Get Dashboard",
  description: "Show interactive analytics dashboard.",
  inputSchema: {},
  _meta: { ui: { resourceUri: RESOURCE_URI } },
}, async (): Promise<CallToolResult> => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
}));

// App-only tool — hidden from model, callable only by the UI
registerAppTool(server, "refresh_data", {
  title: "Refresh Data",
  description: "Refresh dashboard data (internal).",
  inputSchema: {},
  _meta: {
    ui: {
      resourceUri: RESOURCE_URI,
      visibility: ["app"],        // hidden from model tool list
    },
  },
}, async (): Promise<CallToolResult> => ({
  content: [{ type: "text", text: JSON.stringify(freshData) }],
}));
```

**Correct -- React app using `@modelcontextprotocol/ext-apps/react`:**
```tsx
import { useToolResult } from "@modelcontextprotocol/ext-apps/react";

function Dashboard() {
  const result = useToolResult();              // receives tool call data
  const data = JSON.parse(result?.content?.[0]?.text ?? "{}");
  return <div>{/* render interactive UI from data */}</div>;
}
```

**Key rules:**
- Use `ui://` URI scheme for all UI resources, with `text/html;profile=mcp-app` mimeType
- Use `registerAppTool` and `registerAppResource` from `@modelcontextprotocol/ext-apps/server`
- Link tools to UIs via `_meta.ui.resourceUri` on the tool definition
- Declare CSP domains explicitly: `connectDomains` (fetch), `resourceDomains` (CDN), `frameDomains` (iframes)
- Omitting CSP defaults to `connect-src 'none'` -- no external network access
- Set `visibility: ["app"]` for tools only the UI should call (hides from model)
- Default visibility is `["model", "app"]` -- tool visible to both model and UI
- Host renders UI in sandboxed iframe; never assume permissions are granted
- Content MUST be valid HTML5 provided via `text` (string) or `blob` (base64)

Reference: [MCP Apps Extension (SEP-1865)](https://github.com/modelcontextprotocol/ext-apps)
