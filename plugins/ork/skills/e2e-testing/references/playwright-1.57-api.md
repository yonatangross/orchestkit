# Playwright 1.57+ API Reference

## Semantic Locators (2026 Best Practice)

### Locator Priority

1. `getByRole()` - Matches how users/assistive tech see the page
2. `getByLabel()` - For form inputs with labels
3. `getByPlaceholder()` - For inputs with placeholders
4. `getByText()` - For text content
5. `getByTestId()` - When semantic locators aren't possible

### Role-Based Locators

```typescript
// Buttons
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByRole('button', { name: /submit/i }).click(); // Regex

// Links
await page.getByRole('link', { name: 'Home' }).click();

// Headings
await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome');

// Form controls
await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');
await page.getByRole('checkbox', { name: 'Remember me' }).check();
await page.getByRole('combobox', { name: 'Country' }).selectOption('US');

// Lists
await expect(page.getByRole('list')).toContainText('Item 1');
await expect(page.getByRole('listitem')).toHaveCount(3);

// Navigation
await page.getByRole('navigation').getByRole('link', { name: 'About' }).click();
```

### Label-Based Locators

```typescript
// Form inputs with labels
await page.getByLabel('Email').fill('test@example.com');
await page.getByLabel('Password').fill('secret123');
await page.getByLabel('Remember me').check();

// Partial match
await page.getByLabel(/email/i).fill('test@example.com');
```

### Text and Placeholder

```typescript
// Text content
await page.getByText('Welcome back').click();
await page.getByText(/welcome/i).isVisible();

// Placeholder
await page.getByPlaceholder('Enter email').fill('test@example.com');
```

### Test IDs (Fallback)

```typescript
// When semantic locators aren't possible
await page.getByTestId('custom-widget').click();

// Configure test ID attribute
// playwright.config.ts
export default defineConfig({
  use: {
    testIdAttribute: 'data-test-id',
  },
});
```

## New Assertions (1.57+)

```typescript
// Assert individual class names (NEW)
await expect(page.locator('.card')).toContainClass('highlighted');
await expect(page.locator('.card')).toContainClass(['active', 'visible']);

// Visibility
await expect(page.getByRole('button')).toBeVisible();
await expect(page.getByRole('button')).toBeHidden();
await expect(page.getByRole('button')).toBeEnabled();
await expect(page.getByRole('button')).toBeDisabled();

// Text content
await expect(page.getByRole('heading')).toHaveText('Welcome');
await expect(page.getByRole('heading')).toContainText('Welcome');

// Attribute
await expect(page.getByRole('link')).toHaveAttribute('href', '/home');

// Count
await expect(page.getByRole('listitem')).toHaveCount(5);

// Screenshot
await expect(page).toHaveScreenshot('page.png');
await expect(page.locator('.hero')).toHaveScreenshot('hero.png');
```

## AI Agents (1.57+)

### Planner Agent

Explores your app and generates a Markdown test plan:

```bash
# Generate test plan for a user flow
npx playwright agents planner --url http://localhost:3000/checkout

# Output: checkout-test-plan.md with steps, assertions, edge cases
```

### Generator Agent

Transforms the Markdown plan into Playwright test files:

```bash
# Generate tests from plan
npx playwright agents generator --plan checkout-test-plan.md

# Output: checkout.spec.ts with complete test implementation
```

### Healer Agent

Automatically repairs failing tests by analyzing failures:

```bash
# Run healer on failing tests
npx playwright agents healer --test checkout.spec.ts

# Analyzes failures, updates locators, re-runs until passing
```

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    aiAgents: {
      enabled: true,
      model: 'gpt-4o',  // or local Ollama
      autoHeal: true,   // Auto-repair on CI failures
    }
  }
});
```

## Authentication State

### Storage State

```typescript
// Save auth state
await page.context().storageState({ path: 'playwright/.auth/user.json' });

// Use saved state
const context = await browser.newContext({
  storageState: 'playwright/.auth/user.json'
});
```

### IndexedDB Support (1.57+)

```typescript
// Save storage state including IndexedDB
await page.context().storageState({
  path: 'auth.json',
  indexedDB: true  // NEW: Include IndexedDB
});

// Restore with IndexedDB
const context = await browser.newContext({
  storageState: 'auth.json'  // Includes IndexedDB automatically
});
```

### Auth Setup Project

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'logged-in',
      dependencies: ['setup'],
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
});
```

## Flaky Test Detection (1.57+)

```typescript
// playwright.config.ts
export default defineConfig({
  // Fail CI if any flaky tests detected
  failOnFlakyTests: true,

  // Retry configuration
  retries: process.env.CI ? 2 : 0,

  // Web server with regex-based ready detection
  webServer: {
    command: 'npm run dev',
    wait: /ready in \d+ms/,  // Wait for this log pattern
  },
});
```

## Visual Regression

```typescript
test('visual regression', async ({ page }) => {
  await page.goto('/');

  // Full page screenshot
  await expect(page).toHaveScreenshot('homepage.png');

  // Element screenshot
  await expect(page.locator('.hero')).toHaveScreenshot('hero.png');

  // With options
  await expect(page).toHaveScreenshot('page.png', {
    maxDiffPixels: 100,
    threshold: 0.2,
  });
});
```

## Locator Descriptions (1.57+)

```typescript
// Describe locators for trace viewer
const submitBtn = page.getByRole('button', { name: 'Submit' });
submitBtn.describe('Main form submit button');

// Shows in trace viewer for debugging
```

## Chrome for Testing (1.57+)

Playwright 1.57 uses Chrome for Testing builds instead of Chromium:

```bash
# Install browsers (includes Chrome for Testing)
npx playwright install

# No code changes needed - better Chrome compatibility
```

## External Links

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright 1.57 Release Notes](https://playwright.dev/docs/release-notes)
- [Locators Guide](https://playwright.dev/docs/locators)
- [Authentication Guide](https://playwright.dev/docs/auth)
