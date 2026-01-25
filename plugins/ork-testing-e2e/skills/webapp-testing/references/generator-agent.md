# Generator Agent

Transforms Markdown test plans into executable Playwright tests.

## What It Does

1. **Reads specs/** - Loads Markdown test plans from Planner
2. **Actively validates** - Interacts with live app to verify selectors
3. **Generates tests/** - Outputs Playwright code with best practices

**Key Differentiator:** Generator doesn't just "translate" Markdown to code. It **actively performs scenarios** against your running app to ensure selectors work and assertions make sense.

## Best Practices Used

### 1. Semantic Locators
```typescript
// ✅ GOOD: User-facing text
await page.getByRole('button', { name: 'Submit' });
await page.getByLabel('Email');

// ❌ BAD: Implementation details
await page.click('#btn-submit-form-id-123');
```

### 2. Proper Waiting
```typescript
// ✅ GOOD: Wait for element to be visible
await expect(page.getByText('Success')).toBeVisible();

// ❌ BAD: Arbitrary timeout
await page.waitForTimeout(3000);
```

### 3. Assertions
```typescript
// ✅ GOOD: Multiple assertions
await expect(page).toHaveURL(/\/success/);
await expect(page.getByText('Order #')).toBeVisible();

// ❌ BAD: No verification
await page.click('button');  // Did it work?
```

## Workflow: specs/ → tests/

```
1. Planner creates:     specs/checkout.md
                            ↓
2. Generator reads spec and tests live app
                            ↓
3. Generator outputs:   tests/checkout.spec.ts
```

## How to Use

In Claude Code:
```
Generate tests from specs/checkout.md
```

Generator will:
1. Parse the Markdown test plan
2. Start your app (uses baseURL from playwright.config.ts)
3. Execute each scenario step-by-step
4. Verify selectors exist and work
5. Write test file to `tests/checkout.spec.ts`

## Example: Input Spec

From `specs/checkout.md`:
```markdown
## Test Scenario: Complete Guest Purchase

### Steps:
1. Navigate to product page
2. Click "Add to Cart"
3. Navigate to cart
4. Fill shipping form:
   - Full Name: "John Doe"
   - Email: "john@example.com"
5. Click "Place Order"
6. Verify URL contains "/order-confirmation"
```

## Example: Generated Test

Generator outputs `tests/checkout.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Guest Checkout Flow', () => {
  test('complete guest purchase', async ({ page }) => {
    // Step 1: Navigate to product page
    await page.goto('/products/laptop');
    await expect(page.getByRole('heading', { name: /MacBook Pro/i })).toBeVisible();

    // Step 2: Click "Add to Cart" - Generator verified this selector works!
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Cart (1)')).toBeVisible();

    // Step 3: Navigate to cart
    await page.getByRole('link', { name: 'Cart' }).click();
    await expect(page).toHaveURL(/\/cart/);

    // Step 4: Fill shipping form - Generator tested these labels exist!
    await page.getByLabel('Full Name').fill('John Doe');
    await page.getByLabel('Email').fill('john@example.com');
    await page.getByLabel('Address').fill('123 Main St');
    await page.getByLabel('City').fill('Seattle');
    await page.getByLabel('ZIP').fill('98101');

    // Step 5: Click "Place Order"
    await page.getByRole('button', { name: 'Place Order' }).click();

    // Wait for navigation
    await page.waitForURL(/\/order-confirmation/);

    // Step 6: Verify confirmation
    await expect(page).toHaveURL(/\/order-confirmation/);
    await expect(page.getByText(/Order #\d+/)).toBeVisible();
    await expect(page.getByText('Thank you for your purchase')).toBeVisible();
  });
});
```

## What Generator Adds (Not in Spec)

Generator enhances specs with:

### 1. Visibility Assertions
```typescript
// Waits for element before interacting
await expect(page.getByRole('heading')).toBeVisible();
```

### 2. Navigation Waits
```typescript
// Waits for URL change to complete
await page.waitForURL(/\/order-confirmation/);
```

### 3. Error Context
```typescript
// Adds specific error messages for debugging
await expect(page.getByText('Thank you')).toBeVisible({
  timeout: 5000,
});
```

### 4. Semantic Locators
Generator prefers (in order):
1. `getByRole()` - accessibility-focused
2. `getByLabel()` - form labels
3. `getByText()` - visible text
4. `getByTestId()` - last resort

## Handling Initial Errors

Generator may produce tests with errors initially (e.g., selector not found). This is NORMAL.

**Why?**
- App might be down when generating
- Elements might be behind authentication
- Dynamic content may not be visible yet

**Solution:** Healer agent automatically fixes these after first test run.

## Best Practices Generator Follows

✅ **Uses semantic locators** (role, label, text)
✅ **Adds explicit waits** (waitForURL, waitForLoadState)
✅ **Multiple assertions** per scenario (not just one)
✅ **Descriptive test names** matching spec scenarios
✅ **Proper test structure** (Arrange-Act-Assert)

## Generated File Structure

```
tests/
├── checkout.spec.ts       ← Generated from specs/checkout.md
│   └── describe: "Guest Checkout Flow"
│       ├── test: "complete guest purchase"
│       ├── test: "empty cart shows message"
│       └── test: "invalid card shows error"
├── login.spec.ts          ← Generated from specs/login.md
└── search.spec.ts         ← Generated from specs/search.md
```

## Verification After Generation

```bash
# Run generated tests
npx playwright test tests/checkout.spec.ts

# If any fail, Healer agent will fix them automatically
```

## Common Generation Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Selector not found | Element doesn't exist yet | Run test, let Healer fix |
| Timing issues | No wait for navigation | Generator adds waits, or Healer fixes |
| Assertion fails | Spec expects wrong text | Update spec and regenerate |

See `references/healer-agent.md` for automatic test repair.
