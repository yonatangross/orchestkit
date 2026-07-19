# Phase 10: Optional Integrations

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
