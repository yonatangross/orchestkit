# E2E Test Patterns

## Complete User Flow Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('user can complete purchase', async ({ page }) => {
    // Navigate to product
    await page.goto('/products');
    await page.getByRole('link', { name: 'Premium Widget' }).click();

    // Add to cart
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('alert')).toContainText('Added to cart');

    // Go to checkout
    await page.getByRole('link', { name: 'Cart' }).click();
    await page.getByRole('button', { name: 'Checkout' }).click();

    // Fill shipping info
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Full name').fill('Test User');
    await page.getByLabel('Address').fill('123 Test St');
    await page.getByLabel('City').fill('Test City');
    await page.getByRole('combobox', { name: 'State' }).selectOption('CA');
    await page.getByLabel('ZIP').fill('90210');

    // Fill payment
    await page.getByLabel('Card number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/25');
    await page.getByLabel('CVC').fill('123');

    // Submit order
    await page.getByRole('button', { name: 'Place order' }).click();

    // Verify confirmation
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByText(/order #/i)).toBeVisible();
  });
});
```

## Page Object Model

```typescript
// pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectLoggedIn() {
    await expect(this.page).toHaveURL('/dashboard');
  }
}

// tests/login.spec.ts
import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Login', () => {
  test('successful login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('user@example.com', 'password123');
    await loginPage.expectLoggedIn();
  });

  test('invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('user@example.com', 'wrongpassword');
    await loginPage.expectError('Invalid email or password');
  });
});
```

## Authentication Fixture

```typescript
// fixtures/auth.ts
import { test as base, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('user@example.com', 'password123');
    await use(page);
  },
  
  adminPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'adminpass');
    await use(page);
  },
});

// tests/dashboard.spec.ts
import { test } from '../fixtures/auth';

test('user can view dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  // Already logged in
});

test('admin can access admin panel', async ({ adminPage }) => {
  await adminPage.goto('/admin');
  // Already logged in as admin
});
```

## Visual Regression Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('homepage looks correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('hero section visual', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('[data-testid="hero"]');
    await expect(hero).toHaveScreenshot('hero.png');
  });

  test('responsive design - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-mobile.png');
  });

  test('dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-dark.png');
  });
});
```

## API Mocking in E2E

```typescript
import { test, expect } from '@playwright/test';

test('handles API error gracefully', async ({ page }) => {
  // Mock API to return error
  await page.route('/api/users', (route) => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Server error' }),
    });
  });

  await page.goto('/users');
  await expect(page.getByText('Unable to load users')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('shows loading state', async ({ page }) => {
  // Delay API response
  await page.route('/api/users', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    route.fulfill({
      status: 200,
      body: JSON.stringify([{ id: 1, name: 'User' }]),
    });
  });

  await page.goto('/users');
  await expect(page.getByTestId('loading-skeleton')).toBeVisible();
  await expect(page.getByText('User')).toBeVisible({ timeout: 5000 });
});
```

## Multi-Tab Test

```typescript
import { test, expect } from '@playwright/test';

test('multi-tab checkout flow', async ({ context }) => {
  // Open two tabs
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  // Add item in first tab
  await page1.goto('/products');
  await page1.getByRole('button', { name: 'Add to cart' }).click();

  // Verify cart updated in second tab
  await page2.goto('/cart');
  await expect(page2.getByRole('listitem')).toHaveCount(1);
});
```

## File Upload Test

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

test('user can upload profile photo', async ({ page }) => {
  await page.goto('/settings/profile');

  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/photo.jpg'));

  // Verify preview
  await expect(page.getByAltText('Profile preview')).toBeVisible();

  // Save
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText('Profile updated');
});
```

## Accessibility Test

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('homepage has no a11y violations', async ({ page }) => {
    await page.goto('/');
    
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('login form is accessible', async ({ page }) => {
    await page.goto('/login');
    
    const results = await new AxeBuilder({ page })
      .include('[data-testid="login-form"]')
      .analyze();
    
    expect(results.violations).toEqual([]);
  });
});
```
