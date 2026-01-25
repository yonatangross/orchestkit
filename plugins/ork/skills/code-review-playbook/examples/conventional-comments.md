# Conventional Comments Examples

Real-world examples of conventional comments for different scenarios.

## Comment Format

```
<label> (<category>): <subject>

<discussion>
```

## Labels & When to Use

### 🔴 `issue` - Must Fix (Blocking)

**Security vulnerability:**
```
issue (security): SQL injection vulnerability in user lookup.

The `user_id` parameter is concatenated directly into the query.

Instead of:
  cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

Use parameterized queries:
  cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

**Breaking bug:**
```
issue (bug): This will crash when `items` is empty.

`items[0]` throws IndexError. Add a guard:
  if not items:
      return default_value
```

### 🟡 `suggestion` - Should Consider

**Better approach:**
```
suggestion (performance): Consider using `dict.get()` for O(1) lookup.

Current loop is O(n) for each check:
  for item in items:
      if item['id'] == target_id: ...

With a dict:
  items_by_id = {item['id']: item for item in items}
  result = items_by_id.get(target_id)
```

**Readability improvement:**
```
suggestion (readability): Extract this into a well-named function.

This 15-line block calculates shipping cost. A function like
`calculate_shipping_cost(order, destination)` would make the
caller's intent clearer and enable reuse.
```

### ⚪ `nitpick` - Non-blocking Polish

**Style:**
```
nitpick (style): Prefer `is None` over `== None` per PEP 8.

  if value is None:  # ✓
  if value == None:  # ✗
```

**Naming:**
```
nitpick (naming): `data` is generic. Consider `user_profile` or `response_payload`.
```

### 🟢 `praise` - Positive Reinforcement

```
praise: Excellent test coverage! These edge cases would have caught
real bugs. The property-based test for serialization roundtrips is
particularly clever.
```

```
praise: This refactor reduced complexity from 15 to 4. Much easier
to reason about now. Great work!
```

### 🔵 `question` - Clarification Needed

```
question (design): Why did we choose Redis over PostgreSQL for sessions?

Not blocking, just want to understand the tradeoff for the ADR.
```

```
question: Is `timeout=30` intentional? Other endpoints use 60s.
```

### 📝 `thought` - Non-blocking Observation

```
thought: We might want to add rate limiting here eventually.
Not for this PR, but worth a follow-up issue.
```

## Anti-Patterns to Avoid

❌ **Vague criticism:**
```
This code is bad.
```

✅ **Specific and actionable:**
```
issue (complexity): This function has 6 levels of nesting.
Consider early returns or extracting helper functions.
```

❌ **Demanding tone:**
```
You need to fix this. This is wrong.
```

✅ **Collaborative tone:**
```
suggestion: Consider using X because Y. What do you think?
```
