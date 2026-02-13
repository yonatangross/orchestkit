---
title: "Unit: Parametrized Tests"
category: unit
impact: CRITICAL
---

# Parametrized Tests

## TypeScript (test.each)

```typescript
describe('isValidEmail', () => {
  test.each([
    ['test@example.com', true],
    ['invalid', false],
    ['@missing.com', false],
    ['user@domain.co.uk', true],
  ])('isValidEmail(%s) returns %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
```

## Python (@pytest.mark.parametrize)

```python
@pytest.mark.parametrize("total,expected", [
    (100, 0),
    (101, 10.1),
    (200, 20),
])
def test_discount_thresholds(self, total, expected):
    order = Order(total=total)
    assert calculate_discount(order) == expected
```

## Indirect Parametrization

```python
@pytest.fixture
def user(request):
    role = request.param
    return UserFactory(role=role)

@pytest.mark.parametrize("user", ["admin", "moderator", "viewer"], indirect=True)
def test_permissions(user):
    assert user.can_access("/dashboard") == (user.role in ["admin", "moderator"])
```

## Combinatorial Testing

```python
@pytest.mark.parametrize("role", ["admin", "user"])
@pytest.mark.parametrize("status", ["active", "suspended"])
def test_access_matrix(role, status):
    """Runs 4 tests: admin/active, admin/suspended, user/active, user/suspended"""
    user = User(role=role, status=status)
    expected = (role == "admin" and status == "active")
    assert user.can_modify() == expected
```
