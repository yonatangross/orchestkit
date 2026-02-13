# Planner Agent

Explores your app and produces Markdown test plans for user flows.

## What It Does

1. **Executes seed.spec.ts** - Learns initialization, fixtures, hooks
2. **Explores app** - Navigates pages, identifies user paths
3. **Identifies scenarios** - Critical flows, edge cases, error states
4. **Outputs Markdown** - Human-readable test plan in `specs/` directory

## Required: seed.spec.ts

**The Planner REQUIRES a seed test** to understand your app setup:

```typescript
// tests/seed.spec.ts - Planner runs this first
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000');

  // If authentication required:
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL('/dashboard');
});

test('seed - app is ready', async ({ page }) => {
  await expect(page.getByRole('navigation')).toBeVisible();
});
```

**Why seed.spec.ts?** Planner executes this to learn:
- Environment variables needed
- Authentication flow
- Fixtures and test hooks
- Page object patterns
- Available UI elements

## How to Use

### Option 1: Natural Language Request

In Claude Code:
```
Generate a test plan for the guest checkout flow
```

### Option 2: With PRD Context

Provide a Product Requirements Document:
```markdown
# Checkout Feature PRD

## User Story
As a guest user, I want to complete checkout without creating an account.

## Acceptance Criteria
- User can add items to cart
- User can enter shipping info without login
- User can pay with credit card
- User receives order confirmation
```

Then:
```
Generate test plan from this PRD
```

## Example Output

Planner creates `specs/checkout.md`:

```markdown
# Test Plan: Guest Checkout Flow

## Test Scenario 1: Happy Path - Complete Guest Purchase

**Given:** User is not logged in
**When:** User completes checkout as guest
**Then:** Order is placed successfully

### Steps:
1. Navigate to product page
2. Click "Add to Cart"
3. Navigate to cart
4. Click "Checkout as Guest"
5. Fill shipping form:
   - Full Name: "John Doe"
   - Email: "john@example.com"
   - Address: "123 Main St"
   - City: "Seattle"
   - ZIP: "98101"
6. Click "Continue to Payment"
7. Enter credit card:
   - Number: "4242424242424242" (test card)
   - Expiry: "12/25"
   - CVC: "123"
8. Click "Place Order"
9. Verify:
   - URL contains "/order-confirmation"
   - Page displays "Order #" with order number
   - Email confirmation message shown

## Test Scenario 2: Edge Case - Empty Cart Checkout

**Given:** User has empty cart
**When:** User attempts checkout
**Then:** Checkout button is disabled

### Steps:
1. Navigate to cart
2. Verify message "Your cart is empty"
3. Verify "Checkout" button has `disabled` attribute
4. Verify button is grayed out visually

## Test Scenario 3: Error Handling - Invalid Credit Card

**Given:** User completes shipping info
**When:** User enters invalid credit card
**Then:** Error message is displayed

### Steps:
1-6. (Same as Scenario 1)
7. Enter invalid card: "1111222233334444"
8. Click "Place Order"
9. Verify:
   - Error message "Invalid card number"
   - Form stays on payment page
   - No order created in system
```

## Planner Capabilities

**It can:**
- ✅ Navigate complex multi-page flows
- ✅ Identify edge cases (empty states, errors)
- ✅ Suggest accessibility tests (keyboard navigation, screen readers)
- ✅ Include performance assertions (load times)
- ✅ Detect flaky scenarios (race conditions, timing issues)

**It cannot:**
- ❌ Test backend logic directly (but can verify API responses)
- ❌ Generate load/stress tests (only functional tests)
- ❌ Test external integrations (payment gateways, unless mocked)

## Best Practices

1. **Review plans before generation** - Planner may miss business logic nuances
2. **Add domain-specific scenarios** - E.g., "Test with expired credit card"
3. **Prioritize by risk** - Test critical paths first (payment, auth, data loss)
4. **Include happy + sad paths** - Not just success cases
5. **Reference PRDs** - Give Planner product context for better plans

## Directory Structure

```
specs/
├── checkout.md          ← Planner output
├── login.md             ← Planner output
└── product-search.md    ← Planner output
```

## Next Step

Once you have `specs/*.md`, use Generator agent to create executable tests.

See `references/generator-agent.md` for code generation workflow.
