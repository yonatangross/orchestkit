---
title: Docstring Standards
impact: LOW
---

# Docstring Standards

## Python

All public functions (no `_` prefix) should have `"""docstring"""` documentation:
- Describe what the function does
- Document parameters and return values
- Skip for trivial getters/setters and test functions

## TypeScript / JavaScript

All exported functions should have `/** JSDoc */` comments:
- Describe purpose and behavior
- Use `@param` and `@returns` tags for complex signatures
- Skip for internal helpers and test utilities
