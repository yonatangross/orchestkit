# agent-browser Quick Reference for Content Capture

Commands most relevant to browser content capture workflows. Run `agent-browser --help` for the full 60+ command reference.

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `open <url>` | Navigate to URL | First step of any capture |
| `snapshot -i` | Interactive element tree with refs | Understanding page structure |
| `get text @e#` | Extract element text | Content extraction |
| `get html @e#` | Get element HTML | Structured content |
| `eval "<js>"` | Run custom JavaScript | Complex extraction |
| `click @e#` | Click element | Navigate menus, pagination |
| `fill @e# "value"` | Fill input | Authentication flows |
| `wait --load networkidle` | Wait for network idle | SPA content loading |
| `wait --text "Expected"` | Wait for text to appear | Dynamic content |
| `wait @e#` | Wait for element | Lazy-loaded content |
| `screenshot <path>` | Capture image | Visual verification |
| `state save <file>` | Save cookies/storage | Persist authentication |
| `state load <file>` | Restore session | Reuse authentication |
| `--session <name>` | Named session | Parallel captures |
| `console` | Read JS console | Debug extraction issues |
| `network requests` | Monitor XHR/fetch | Find API endpoints |

**Upstream docs:** [github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
