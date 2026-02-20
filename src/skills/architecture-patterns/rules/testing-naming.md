---
title: Name tests descriptively so they serve as documentation and aid debugging
category: testing
impact: MEDIUM
impactDescription: Descriptive test names serve as documentation and aid debugging
tags: [testing, naming, conventions, descriptive, behavior-focused]
---

# Test Naming Conventions

## TypeScript/JavaScript

```typescript
// GOOD - Descriptive, behavior-focused
test('should return empty array when no items exist', () => {});
test('throws ValidationError when email is invalid', () => {});
it('renders loading spinner while fetching', () => {});

// BLOCKED - Too short, not descriptive
test('test1', () => {});
test('works', () => {});
it('test', () => {});
```

## Python

```python
# GOOD - snake_case, descriptive
def test_should_return_user_when_id_exists():
def test_raises_not_found_when_user_missing():

# BLOCKED - Not descriptive, wrong case
def testUser():      # camelCase
def test_1():        # Not descriptive
```

## File Location Rules

```
ALLOWED:
  tests/unit/user.test.ts
  tests/integration/api.test.ts
  __tests__/components/Button.test.tsx
  app/tests/test_users.py

BLOCKED:
  src/utils/helper.test.ts      # Tests in src/
  components/Button.test.tsx    # Tests outside test dir
  app/routers/test_routes.py    # Tests mixed with source
```

## Key Principles

- Test names describe **behavior**, not implementation
- Names should read as specifications
- Use "should" or "when" patterns for clarity
- Place all tests in dedicated test directories

**Incorrect — vague test name provides no context:**
```typescript
test('works', () => {
    const result = calculateTotal([10, 20]);
    expect(result).toBe(30);
});
```

**Correct — descriptive name documents behavior:**
```typescript
test('should sum all item prices when calculating order total', () => {
    const result = calculateTotal([10, 20]);
    expect(result).toBe(30);
});
```
