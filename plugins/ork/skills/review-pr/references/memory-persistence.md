# Memory Persistence (manual fallback)

The Phase 8c verdict writeback script (`scripts/verdict_writeback.py`) handles this automatically when `yg-mcp-core>=0.3.0` is installed. Use the manual pattern below when running an interactive review on a host that does NOT have yg-mcp-core (the script will skip cleanly in that case and you can fall back to direct memory MCP calls).

## Pattern

```python
# Persist review findings for cross-session learning
mcp__memory__create_entities(entities=[{
    "name": "PR-{number}-Review",
    "entityType": "code-review",
    "observations": [
        "<summary>",
        "<critical findings>",
        "<patterns discovered>",
    ],
}])

# Update known-weaknesses entity if new patterns found
mcp__memory__add_observations(observations=[{
    "entityName": "review-known-weaknesses",
    "contents": ["<new pattern from this review>"],
}])
```

## When to use this vs Phase 8c

| Context | Use |
|---------|-----|
| HQ environment, `yg-mcp-core` installed | Phase 8c (automatic) |
| Public fork, `yg-mcp-core` not installed | This manual pattern (interactive) |
| Headless CI without HQ creds | Skip both — Phase 8c exits 0 |

The two paths produce the same KG shape (entity name `PR-{number}-Review`, entityType `code-review`). Either path is safe; don't run both.
