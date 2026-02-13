---
title: Architecture Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Clean Architecture (clean) -- HIGH -- 3 rules

SOLID principles, hexagonal architecture, ports and adapters, and DDD tactical patterns.

- `clean-hexagonal-ports-adapters.md` -- Hexagonal architecture, driving/driven ports and adapters, directory structure, dependency rule
- `clean-solid-dependency-rule.md` -- SOLID principles with Python Protocol, dependency inversion, FastAPI DI chain
- `clean-ddd-tactical-patterns.md` -- DDD entities, value objects, aggregate roots, domain events, domain services

## 2. Project Structure (structure) -- HIGH -- 2 rules

Feature-based organization, nesting depth limits, and import direction enforcement.

- `structure-folder-conventions.md` -- React/Next.js and FastAPI folder structures, nesting depth, barrel file rules
- `structure-import-direction.md` -- Unidirectional imports, cross-feature prevention, component/hook location

## 3. Backend Layers (backend) -- HIGH -- 3 rules

FastAPI Clean Architecture with router/service/repository layer separation.

- `backend-layer-separation.md` -- Layer separation rules, forbidden patterns per layer, async consistency
- `backend-dependency-injection.md` -- Dependency injection with Depends(), service chains, blocked DI patterns
- `backend-naming-exceptions.md` -- File naming conventions, domain exceptions, violation detection

## 4. Test Standards (testing) -- MEDIUM -- 3 rules

Testing best practices with AAA pattern, naming conventions, and coverage thresholds.

- `testing-aaa-isolation.md` -- Arrange-Act-Assert pattern, test isolation, parameterized tests
- `testing-naming-conventions.md` -- Descriptive naming conventions for TypeScript and Python tests
- `testing-coverage-location.md` -- Coverage thresholds, fixture best practices, test location rules
