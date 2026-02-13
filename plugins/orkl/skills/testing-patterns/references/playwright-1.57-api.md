# Playwright 1.58+ API Reference

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

## Breaking Changes (1.58)

### Removed Features

| Feature | Status | Migration |
|---------|--------|-----------|
| `_react` selector | Removed | Use `getByRole()` or `getByTestId()` |
| `_vue` selector | Removed | Use `getByRole()` or `getByTestId()` |
| `:light` selector suffix | Removed | Use standard CSS selectors |
| `devtools` launch option | Removed | Use `args: ['--auto-open-devtools-for-tabs']` |
| macOS 13 WebKit | Removed | Upgrade to macOS 14+ |

### Migration Examples

```typescript
// React/Vue component selectors - Before
await page.locator('_react=MyComponent').click();
await page.locator('_vue=MyComponent').click();

// After - Use semantic locators or test IDs
await page.getByRole('button', { name: 'My Component' }).click();
await page.getByTestId('my-component').click();

// :light selector - Before
await page.locator('.card:light').click();

// After - Just use the selector directly
await page.locator('.card').click();

// DevTools option - Before
const browser = await chromium.launch({ devtools: true });

// After - Use args
const browser = await chromium.launch({
  args: ['--auto-open-devtools-for-tabs']
});
```

## New Features (1.58+)

### connectOverCDP with isLocal

```typescript
// Optimized CDP connection for local debugging
const browser = await chromium.connectOverCDP({
  endpointURL: 'http://localhost:9222',
  isLocal: true  // NEW: Optimizes for local connections
});

// Use for connecting to locally running Chrome instances
// Reduces latency and improves reliability
```

### Timeline in Speedboard HTML Reports

HTML reports now include an interactive timeline:

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [['html', { open: 'never' }]],
});

// The HTML report shows:
// - Test execution sequence
// - Parallel test distribution
// - Time spent in each test phase
// - Performance bottlenecks
```

### New Assertions (1.57+)

```typescript
// Assert individual class names (1.57+)
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

## AI Agents (1.58+)

### Initialize AI Agents

```bash
# Initialize agents for your preferred AI tool
npx playwright init-agents --loop=claude    # For Claude Code
npx playwright init-agents --loop=vscode    # For VS Code (requires v1.105+)
npx playwright init-agents --loop=opencode  # For OpenCode
```

### Generated Structure

| Directory/File | Purpose |
|----------------|---------|
| `.github/` | Agent definitions and configuration |
| `specs/` | Test plans in Markdown format |
| `tests/seed.spec.ts` | Seed file for AI agents to reference |

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    aiAgents: {
      enabled: true,
      model: 'claude-3.5-sonnet',  // or local Ollama
      autoHeal: true,              // Auto-repair on CI failures
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
  indexedDB: true  // Include IndexedDB in storage state
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

Playwright uses Chrome for Testing builds instead of Chromium:

```bash
# Install browsers (includes Chrome for Testing)
npx playwright install

# No code changes needed - better Chrome compatibility
```

## External Links

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright 1.58 Release Notes](https://playwright.dev/docs/release-notes)
- [Locators Guide](https://playwright.dev/docs/locators)
- [Authentication Guide](https://playwright.dev/docs/auth)
