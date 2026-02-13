---
title: Architecture Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Clean Architecture (clean) — HIGH — 3 rules

SOLID principles, hexagonal architecture, ports and adapters, and DDD tactical patterns.

- `clean-hexagonal.md` — Hexagonal architecture, driving/driven ports, layer structure
- `clean-dependency-rule.md` — Dependency inversion, Protocol-based interfaces, FastAPI DI
- `clean-ports-adapters.md` — Ports and adapters implementation, adapter patterns

## 2. Project Structure (structure) — HIGH — 2 rules

Feature-based organization, max nesting depth, unidirectional imports, and barrel file prevention.

- `structure-folders.md` — React/Next.js and FastAPI layouts, 4-level max nesting, barrel file rules
- `structure-conventions.md` — Unidirectional imports, cross-feature prevention, component/hook placement

## 3. Backend Layers (backend) — HIGH — 3 rules

FastAPI Clean Architecture with router/service/repository layer separation and blocking validation.

- `backend-layers.md` — Router/service/repository boundaries, forbidden patterns, async rules
- `backend-di.md` — Depends() chains, auth patterns, testing with DI overrides
- `backend-repository.md` — Repository pattern, naming conventions, domain exceptions

## 4. Test Standards (testing) — MEDIUM — 3 rules

Testing best practices with AAA pattern, naming conventions, isolation, and coverage thresholds.

- `testing-aaa.md` — Arrange-Act-Assert, test isolation, parameterized tests
- `testing-naming.md` — Descriptive behavior-focused names for Python and TypeScript
- `testing-coverage.md` — Coverage thresholds, fixture scopes, test file placement rules

## 5. Right-Sizing (right-sizing) — HIGH — 2 rules

Context-aware backend architecture sizing. Prevents over-engineering for interviews and MVPs, ensures proper structure for enterprise.

- `right-sizing-tiers.md` — Interview/MVP/production/enterprise sizing matrix, LOC estimates, detection signals
- `right-sizing-decision.md` — ORM, auth, error handling, testing recommendations per tier, over-engineering tax
