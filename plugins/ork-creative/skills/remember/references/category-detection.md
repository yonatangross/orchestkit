# Category Detection Reference

Auto-detection logic for categorizing memories.

## Detection Rules (Priority Order)

```bash
# 1. Pagination patterns
pagination|cursor|offset|page|limit → pagination

# 2. Database patterns
database|sql|postgres|mysql|mongo|query|migration|alembic → database

# 3. Authentication patterns
auth|jwt|oauth|token|session|login|password → authentication

# 4. API patterns
api|endpoint|rest|graphql|grpc → api

# 5. Frontend patterns
react|vue|angular|component|frontend|ui|css|tailwind → frontend

# 6. Performance patterns
performance|slow|fast|cache|optimize|latency|throughput → performance

# 7. Architecture patterns
architecture|design|system|microservice|monolith → architecture

# 8. Pattern/Convention
pattern|convention|style|standard → pattern

# 9. Blockers/Issues
blocked|issue|bug|workaround|error|fix → blocker

# 10. Constraints
must|cannot|required|constraint|limitation → constraint

# 11. Default
<anything else> → decision
```

## Case Insensitive Matching

All pattern matching is case-insensitive. Both "PostgreSQL" and "postgresql" match the database category.

## Multiple Matches

If text matches multiple categories, the first match in priority order wins.

Example: "JWT authentication API endpoint" matches:
1. authentication (jwt, auth) - wins
2. api (endpoint)