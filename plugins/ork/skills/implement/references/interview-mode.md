# Interview / Take-Home Mode

When project tier is detected as **Interview** (STEP 0), apply these constraints:

## Constraints

| Constraint | Value |
|-----------|-------|
| Max files | 8-15 |
| Max LOC | 200-600 |
| Architecture | Flat (no layers) |
| Skip phases | 2 (Micro-Planning), 3 (Worktree), 7 (Scope Creep), 8 (E2E Browser), 10 (Reflection) |
| Agents | Max 2 (1 backend + 1 frontend, or 1 full-stack) |
| CI/Observability | Skip entirely |

## README Template

Include a "What I Would Change for Production" section:
- **Database:** would add migrations, connection pooling
- **Auth:** would add OAuth/JWT instead of basic auth
- **Testing:** would add integration + e2e tests
- **Monitoring:** would add structured logging, health checks

> This section demonstrates production awareness without over-engineering the take-home. Reviewers value this signal.
