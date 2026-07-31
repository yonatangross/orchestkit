# ork delta: architecture-patterns

House decisions and scars rescued when the vendor-restatement reference files were
retired from src/skills/architecture-patterns (2026-07-31 wrap-plus-delta campaign).
Generic tutorials on these topics are upstream's job; see the "Upstream coverage
(do not restate)" table in SKILL.md. Only the rules below are ours.

## Convert domain exceptions to HTTP responses only at the router boundary
Why: House decision from consolidating backend-architecture-enforcer into architecture-patterns v2.0 (enforcer-skill consolidation; exact PR untraced). The fixed status map is EntityNotFoundError 404, UserAlreadyExistsError 409, InvalidStateError 422, BusinessRuleViolation 400, AuthorizationError 403, anything unmapped 500, registered once via `app.add_exception_handler(DomainException, domain_exception_handler)`. Keeping the map in one handler is what makes the "HTTPException blocked in services/" rule in `rules/backend-layers.md` mechanically enforceable.
Upstream: FastAPI error handling docs, https://fastapi.tiangolo.com/tutorial/handling-errors/ (context7: /tiangolo/fastapi)

## Flag the HTTPException import in services/, not just the raise
Why: Detection rule inherited from backend-architecture-enforcer (enforcer consolidation; PR untraced). Grepping only for `raise HTTPException` misses helper functions that wrap it; `from fastapi import HTTPException` inside services/ is already the violation. Companion greps: `db.add` / `db.execute` / `db.commit` / `db.query` / `session.add` in routers/, and `Service()` / `Repository()` instantiation inside route handlers. The blocking table lives in `rules/backend-layers.md`.
Upstream: FastAPI dependency docs, https://fastapi.tiangolo.com/tutorial/dependencies/ (context7: /tiangolo/fastapi)

## Clear FastAPI dependency overrides in fixture teardown, every time
Why: House testing convention from the enforcer era (enforcer consolidation; PR untraced): the test client fixture yields, then runs `app.dependency_overrides.clear()`. A leaked override silently rewires every later test in the session, which passes file-by-file locally and fails only as a full suite.
Upstream: FastAPI testing dependencies docs, https://fastapi.tiangolo.com/advanced/testing-dependencies/

## Enforce the barrel-file ban with ESLint, not review comments
Why: House blocking rule from project-structure-enforcer (enforcer consolidation; PR untraced). The working config is `no-restricted-imports` with `patterns: ['**/index']`; before the lint gate existed the ban regressed repeatedly in review. The rationale (tree-shaking failure, HMR slowdown, hidden import cycles) is summarized in `rules/structure-folders.md`.
Upstream: ESLint no-restricted-imports rule, https://eslint.org/docs/latest/rules/no-restricted-imports

## Keep test files under tests/ (or __tests__/), never co-located with source
Why: House decision from test-standards-enforcer (enforcer consolidation; PR untraced). Vendor defaults (Vitest, Jest, pytest) all permit co-location; OrchestKit blocks it so coverage omit globs and CI test discovery stay one-pattern simple. `src/**/*.test.ts` and `app/**/test_*.py` are violations; move them to `tests/unit/`, `tests/integration/`, or `__tests__/`.
Upstream: skill ork:testing-unit; pytest good practices, https://docs.pytest.org/en/stable/explanation/goodpractices.html
