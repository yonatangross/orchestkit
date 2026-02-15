# Task Metrics Template (CC 2.1.30)

Task tool results now include efficiency metrics. After parallel agents complete, report:

```markdown
## Review Efficiency
| Agent | Tokens | Tools | Duration |
|-------|--------|-------|----------|
| code-quality-reviewer | 450 | 8 | 12s |
| security-auditor | 620 | 12 | 18s |
| test-generator | 380 | 6 | 10s |

**Total:** 1,450 tokens, 26 tool calls
```

Use metrics to:
- Identify slow or expensive agents
- Track review efficiency over time
- Optimize agent prompts based on token usage
