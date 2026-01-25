# Similar Issue Search

Find related past issues to leverage previous solutions and detect regressions.

## GitHub Issue Search Patterns

```bash
# Search by error message
gh issue list --search "TypeError: Cannot read property" --state all

# Search by component/file
gh issue list --search "UserService" --state all --json number,title,state

# Search by label
gh issue list --label "bug" --state closed --limit 20

# Combined search
gh issue list --search "auth login 401" --state all --json number,title,closedAt
```

## Memory/Knowledge Graph Queries

```python
# Search for past fixes
mcp__memory__search_nodes(query="fix authentication error")

# Search by error type
mcp__memory__search_nodes(query="TypeError resolution")

# Search by component
mcp__memory__search_nodes(query="UserService bug")
```

## Stack Trace Similarity Matching

Match by:
1. **Exception type** - Same error class
2. **File/line** - Same code location
3. **Call stack depth** - Similar execution path
4. **Error message pattern** - Regex match on message

## Similarity Assessment Criteria

| Factor | Weight | High Match |
|--------|--------|------------|
| Same exception type | 30% | Exact match |
| Same file | 25% | Same file involved |
| Similar error message | 20% | >80% string similarity |
| Same component | 15% | Same service/module |
| Recent (< 30 days) | 10% | Recently resolved |

## When to Reuse vs Investigate Fresh

**Reuse Previous Solution When:**
- Similarity > 80%
- Same root cause confirmed
- Fix is still applicable
- No code changes since fix

**Investigate Fresh When:**
- Similarity < 60%
- Context has changed significantly
- Previous fix may be incomplete
- New dependencies involved

## Issue Classification

| Type | Action |
|------|--------|
| **Regression** | Same issue, fix reverted or bypassed |
| **Variant** | Similar pattern, different trigger |
| **New** | No similar issues found |
