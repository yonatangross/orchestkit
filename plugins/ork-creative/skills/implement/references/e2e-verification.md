# E2E Verification Guide

Concrete steps for Phase 8 end-to-end verification.

## Browser Testing (UI features)

```python
# Use agent-browser CLI for visual verification
Bash("agent-browser open http://localhost:3000/{route}")
Bash("agent-browser snapshot")  # Capture DOM state
Bash("agent-browser screenshot /tmp/e2e-{feature}.png")
Read("/tmp/e2e-{feature}.png")  # Visual inspection
```

## API Testing (Backend features)

```bash
# Verify endpoints return expected responses
curl -s http://localhost:8000/api/{endpoint} | jq .

# Run integration test suite against running server
pytest tests/integration/ -v --tb=short

# If docker-compose exists, test against real services
docker-compose -f docker-compose.test.yml up -d
pytest tests/integration/ -v
docker-compose -f docker-compose.test.yml down
```

## Full-Stack Verification

1. Start backend: verify API responses with curl/httpie
2. Start frontend: verify pages render with agent-browser
3. Test critical user flows end-to-end
4. Verify error states (invalid input, network failure, auth failure)

## What to Check

| Aspect | How |
|--------|-----|
| Happy path | Complete the primary user flow |
| Error handling | Submit invalid data, check error messages |
| Auth boundaries | Access protected routes without auth |
| Data persistence | Create → Read → Update → Delete cycle |
| Performance | Page load under 3s, API response under 500ms |

## When to Skip

- **Tier 1-2 (Interview/Hackathon):** Skip browser E2E, manual verification sufficient
- **No UI changes:** Skip browser testing, API tests only
- **Config-only changes:** Skip E2E entirely
