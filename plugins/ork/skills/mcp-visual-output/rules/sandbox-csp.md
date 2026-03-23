---
title: Configure CSP declarations and iframe sandboxing for MCP visual output
impact: "HIGH"
impactDescription: "Missing CSP blocks all external network access from the iframe; overly permissive CSP (unsafe-inline, wildcard origins) creates XSS and data exfiltration risks"
tags: [csp, sandbox, iframe, security, mcp-visual-output]
---

## Sandbox & CSP

MCP visual output renders inside sandboxed iframes. The host (Claude Desktop, Cursor, ChatGPT) enforces a Content Security Policy. By default, iframes have no external network access -- you must declare exactly which domains are needed.

**Incorrect -- overly permissive CSP:**
```typescript
import { createMcpApp } from '@json-render/mcp'

const app = createMcpApp({
  catalog,
  html: bundledHtml,
  csp: {
    // BAD: wildcard allows any domain -- data exfiltration risk
    connectDomains: ['*'],
    // BAD: unsafe-inline allows injected scripts to execute
    scriptSrc: ["'unsafe-inline'", "'unsafe-eval'"],
    // BAD: no resource domain restrictions
    resourceDomains: ['*'],
  },
})
```

**Incorrect -- no CSP at all (default blocks everything):**
```typescript
const app = createMcpApp({
  catalog,
  html: bundledHtml,
  // No csp config -- iframe cannot fetch any external resources.
  // Images, fonts, API calls all fail silently.
})
```

**Correct -- minimal CSP with only required domains:**
```typescript
import { createMcpApp } from '@json-render/mcp'

const app = createMcpApp({
  catalog,
  html: bundledHtml,
  csp: {
    // Only the API your dashboard actually calls
    connectDomains: ['https://api.example.com'],
    // Only the CDN you load fonts/icons from
    resourceDomains: ['https://cdn.jsdelivr.net'],
    // Only if you embed external iframes (e.g., video)
    frameDomains: ['https://www.youtube.com'],
  },
})
```

**Correct -- registerJsonRenderTool with CSP on existing server:**
```typescript
registerJsonRenderTool(server, {
  catalog,
  html: bundledHtml,
  csp: {
    connectDomains: ['https://api.internal.com'],
    // No resourceDomains needed if all assets are inlined in html bundle
    // No frameDomains needed if no nested iframes
  },
})
```

**Key rules:**
- Default CSP is `connect-src 'none'` -- the iframe cannot make any network requests unless you declare domains
- Declare only the specific domains your dashboard needs, never use wildcards
- Never add `'unsafe-inline'` or `'unsafe-eval'` to script-src -- the bundled html app should have all scripts inlined at build time, which the sandbox allows by default
- `connectDomains` controls fetch/XHR/WebSocket origins
- `resourceDomains` controls script, image, style, and font origins from CDNs
- `frameDomains` controls nested iframe origins (only needed for embedded content like videos)
- If your dashboard is fully self-contained (no external API calls, all assets inlined), you do not need any CSP declarations
- The host controls the sandbox attribute on the iframe -- your MCP server cannot override sandbox permissions

Reference: [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
