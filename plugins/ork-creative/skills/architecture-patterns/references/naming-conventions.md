# Test Naming Conventions

Descriptive test names that document expected behavior.

## Implementation

### Python (pytest)

```python
# Pattern: test_<action>_<condition>_<expected_result>

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

### TypeScript (Vitest/Jest)

```typescript
describe('UserService', () => {
  // Pattern: should <expected_behavior> when <condition>
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

## Anti-Patterns (Blocked)

```python
# BLOCKED - Not descriptive
def test_user():
def test_1():
def test_it_works():
def testUser():  # Wrong case

# BLOCKED - Tests implementation, not behavior
def test_calls_repository_save_method():
def test_uses_cache():
```

## Checklist

- [ ] Test name describes expected behavior, not implementation
- [ ] Condition/scenario is clear from the name
- [ ] Expected outcome is explicit
- [ ] Use snake_case for Python, camelCase for TypeScript
- [ ] Names are 3-10 words (not too short, not too long)
- [ ] Avoid generic words: test, check, verify (alone)