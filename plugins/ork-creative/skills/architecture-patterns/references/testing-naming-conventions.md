---
title: "Test Standards: Naming Conventions"
category: test-standards
impact: MEDIUM
---

# Test Naming Conventions

Descriptive test names that document expected behavior for both Python and TypeScript.

## Python Naming Pattern

Pattern: `test_<action>_<condition>_<expected_result>`

```python
class TestUserRegistration:
    def test_creates_user_when_valid_email_provided(self):
        """Register with valid email succeeds."""
        ...

    def test_raises_validation_error_when_email_already_exists(self):
        """Duplicate email registration fails."""
        ...

    def test_sends_welcome_email_after_successful_registration(self):
        """New user receives welcome email."""
        ...

    def test_returns_none_when_user_not_found_by_id(self):
        """Missing user returns None, not exception."""
        ...


class TestOrderCalculation:
    def test_applies_bulk_discount_when_quantity_exceeds_threshold(self):
        ...

    def test_skips_discount_when_quantity_below_minimum(self):
        ...

    def test_calculates_tax_after_discount_applied(self):
        ...
```

## TypeScript Naming Pattern

Pattern: `should <expected_behavior> when <condition>`

```typescript
describe('UserService', () => {
  test('should create user when valid email provided', () => {});
  test('should throw ValidationError when email already exists', () => {});
  test('should send welcome email after successful registration', () => {});
  test('should return null when user not found by id', () => {});
});

describe('OrderCalculation', () => {
  test('should apply bulk discount when quantity exceeds threshold', () => {});
  test('should skip discount when quantity below minimum', () => {});
  test('should calculate tax after discount applied', () => {});
});
```

## Blocked Naming Patterns

```python
# BLOCKED - Not descriptive
def test_user():           # What about user?
def test_1():              # Meaningless number
def test_it_works():       # What works?
def testUser():            # Wrong case (camelCase)

# BLOCKED - Tests implementation, not behavior
def test_calls_repository_save_method():   # Implementation detail
def test_uses_cache():                     # Implementation detail
```

```typescript
// BLOCKED - Not descriptive
test('test1', () => {});           // Meaningless
test('works', () => {});           // What works?
test('test', () => {});            // Says nothing
it('test', () => {});              // Says nothing
```

## Naming Checklist

- Test name describes expected behavior, not implementation
- Condition/scenario is clear from the name
- Expected outcome is explicit
- Use `snake_case` for Python, descriptive strings for TypeScript
- Names are 3-10 words (not too short, not too long)
- Avoid generic words alone: test, check, verify

## Describe Block Naming (TypeScript)

```typescript
// GOOD - Named after the unit being tested
describe('UserService', () => {
  describe('createUser', () => {
    test('should hash password before saving', () => {});
    test('should throw when email is taken', () => {});
  });

  describe('deleteUser', () => {
    test('should soft delete by setting is_active to false', () => {});
    test('should throw when user not found', () => {});
  });
});

// BAD - Vague describe blocks
describe('tests', () => {
  describe('user', () => {
    test('test1', () => {});
    test('test2', () => {});
  });
});
```

## Test Class Naming (Python)

```python
# GOOD - Named after the feature/unit
class TestUserRegistration:
    ...

class TestOrderCalculation:
    ...

class TestPaymentProcessing:
    ...

# BAD - Vague class names
class TestUtils:
    ...

class TestMisc:
    ...
```
