# Optional Integrations

## Agentation (UI Annotation Tool)

```
Enable Agentation UI annotation tool? [y/N]: y
```

[Agentation](https://agentation.dev) lets you annotate your app's UI in the browser and have Claude pick up the feedback automatically.

**When enabled, perform these steps (idempotent — skip any step already done):**

1. **Install dependencies** (check `package.json` first):
   ```bash
   npm install -D agentation agentation-mcp
   ```

2. **Add MCP server to `.mcp.json`** (skip if `agentation` key already exists):
   ```json
   {
     "mcpServers": {
       "agentation": {
         "command": "npx",
         "args": ["-y", "agentation-mcp", "server"],
         "disabled": false
       }
     }
   }
   ```

3. **Enable MCP server in Claude Code settings** — add `"agentation"` to the `enabledMcpjsonServers` array in `.claude/settings.local.json` (create file if missing, skip if already listed):
   ```json
   {
     "enabledMcpjsonServers": ["agentation"]
   }
   ```

4. **Scaffold wrapper component** — create a dev-only client component (skip if file already exists). Use the project's component directory (e.g. `src/components/`, `components/`, or `app/components/`):
   ```tsx
   // agentation-wrapper.tsx
   "use client";

   import { Agentation } from "agentation";

   export function AgentationWrapper() {
     if (process.env.NODE_ENV !== "development") return null;
     return <Agentation endpoint="http://localhost:4747" webhookUrl="http://localhost:4747" />;
   }
   ```
   Then instruct the user to add `<AgentationWrapper />` to their root layout.

5. **CSP update** (only if the project has a Content-Security-Policy): add `http://localhost:4747` to the `connect-src` directive for development mode only.
