# Interview & Take-Home Guide (Tiers 1-2)

Guidance for interview assignments, take-home projects, hackathons, and prototypes.

## Tier 1: Interview / Take-Home

### Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Files | 8-15 | > 25 |
| LOC | 200-600 | > 1,500 |
| Tests | 8-15 focused | > 40 |
| Dependencies | 3-8 | > 15 |
| Layers | 1-2 | > 3 |
| Config files | 2-3 | > 8 |

### What Interviewers Actually Evaluate

1. **Clean, readable code** — not architectural patterns
2. **Working solution** — not infrastructure
3. **Good naming and structure** — not abstractions
4. **Thoughtful trade-offs** — documented, not implemented
5. **Tests for critical paths** — not 100% coverage

### Architecture Pattern

```
src/
├── app.ts              # Entry point + routes
├── handlers/           # Request handlers (thin)
├── services/           # Business logic (1-2 files)
├── types.ts            # Shared types
└── __tests__/          # Co-located tests
```

No repository pattern. No DI. No separate DTO layers. No middleware chain.

### Highest-Leverage Technique

Add a "What I Would Change for Production" section to README:

```markdown
## What I Would Change for Production

- **Database**: Replace SQLite with Postgres + connection pooling
- **Auth**: Integrate Clerk/Auth0 instead of basic token
- **Error handling**: Add structured error responses (RFC 9457)
- **Monitoring**: Add OpenTelemetry tracing
- **Testing**: Add integration tests with testcontainers
- **CI/CD**: Add GitHub Actions with lint, test, build stages
```

This shows awareness WITHOUT building it. Interviewers value judgment over implementation.

### Common Over-Engineering Mistakes

| Mistake | Why It Hurts |
|---------|-------------|
| Hexagonal architecture | 3x more files, evaluator can't find the logic |
| Docker + docker-compose | Adds setup friction, not required |
| OpenAPI spec generation | Time spent on tooling, not business logic |
| Custom error hierarchy | 5 error classes for 3 endpoints |
| Event-driven patterns | Async complexity for sync workflows |
| Repository + Unit of Work | 4 files to wrap a 2-line query |

### What TO Build

- Clear input validation with helpful error messages
- One integration test that proves the happy path works
- A few unit tests for edge cases in business logic
- Clean README with setup instructions (< 5 steps)

---

## Tier 2: Hackathon / Prototype

### Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Files | 1-5 | > 10 |
| LOC | 50-300 | > 800 |
| Tests | 0 | Any |
| Time to demo | < 4 hours | > 8 hours |

### Architecture Pattern

Single file if possible. Maximum one level of extraction.

```
app.ts          # Everything
# OR
app.ts          # Routes + handlers
db.ts           # Data access
```

### Principles

- **Ship the demo.** Nothing else matters.
- **Hardcode everything.** Config is waste.
- **No tests.** Prototype will be thrown away.
- **Use the highest-level abstractions available.** ORMs, UI kits, SaaS APIs.
- **Copy-paste is fine.** DRY is for production code.

### Technology Choices

- **Framework**: Whatever you know best
- **Database**: SQLite, JSON file, or in-memory
- **Deployment**: Vercel, Railway, or localhost
- **Auth**: Hardcoded user or none
- **UI**: Tailwind + shadcn/ui (fastest to good-looking)
