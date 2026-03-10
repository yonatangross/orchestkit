# Phase 10: Optional Integrations

## Agentation UI Annotation Tool

If frontend UI work detected in Phase 1 scan:

1. Install: `npm install agentation-mcp`
2. MCP config: Add to `.mcp.json`
3. Component scaffold: Wrap target components
4. CSP updates: Allow agentation connections

All steps are idempotent — safe to re-run.

## CC Version-Specific Settings

### CC 2.1.7+
- Turn duration limits
- MCP deferral threshold
- Effective context window size

### CC 2.1.20+
- Task deletion support
- PR enrichment
- Agent permissions
- Monorepo workspace detection
- Team distribution settings

### CC 2.1.23+
- Spinner verb customization

### CC 2.1.72+
- Reasoning effort levels (low/medium/high/auto)
- Plan mode (`/plan`)
- Background agent preservation across `/clear`

Present as toggles — only show settings relevant to detected CC version:

```python
Bash(command="claude --version 2>/dev/null | head -1")
```
