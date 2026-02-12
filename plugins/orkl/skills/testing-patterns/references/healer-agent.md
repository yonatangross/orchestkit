# Healer Agent

Automatically fixes failing tests.

## What It Does

1. **Replays failing test** - Identifies failure point
2. **Inspects current UI** - Finds equivalent elements
3. **Suggests patch** - Updates locators/waits
4. **Retries test** - Validates fix

## Common Fixes

### 1. Updated Selectors
```typescript
// Before (broken after UI change)
await page.getByRole('button', { name: 'Submit' });

// After (healed)
await page.getByRole('button', { name: 'Submit Order' });  // Button text changed
```

### 2. Added Waits
```typescript
// Before (flaky)
await page.click('button');
await expect(page.getByText('Success')).toBeVisible();

// After (healed)
await page.click('button');
await page.waitForLoadState('networkidle');  // Wait for API call
await expect(page.getByText('Success')).toBeVisible();
```

### 3. Dynamic Content
```typescript
// Before (fails with changing data)
await expect(page.getByText('Total: $45.00')).toBeVisible();

// After (healed)
await expect(page.getByText(/Total: \$\d+\.\d{2}/)).toBeVisible();  // Regex match
```

## How It Works

```
Test fails ─▶ Healer replays ─▶ Inspects DOM ─▶ Suggests fix ─▶ Retries
                                     │                              │
                                     │                              ▼
                                     └────────────────────── Still fails? ─▶ Manual review
```

## Safety Limits

- Maximum 3 healing attempts per test
- Won't change test logic (only locators/waits)
- Logs all changes for review

## Best Practices

1. **Review healed tests** - Ensure semantics unchanged
2. **Update test plan** - If UI intentionally changed
3. **Add regression tests** - For fixed issues

## Limitations

Healer can't fix:
- ❌ Changed business logic
- ❌ Removed features
- ❌ Backend API changes
- ❌ Auth/permission issues

These require manual intervention.
