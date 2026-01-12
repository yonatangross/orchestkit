/**
 * Playwright Test Template for SkillForge
 *
 * This template provides base test structures, page objects, and assertions
 * for E2E testing React applications with TypeScript.
 *
 * Stack: Playwright + TypeScript + React Testing Library patterns
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

// ============================================================================
// BASE PAGE OBJECT PATTERN
// ============================================================================

/**
 * Base Page Object - Inherit for all page objects
 * Provides common patterns and utilities
 */
export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to a specific path
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(selector: string): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible' });
  }

  /**
   * Get element by test ID (data-testid)
   */
  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /**
   * Get element by role and name
   */
  getByRole(role: string, options?: { name?: string }): Locator {
    return this.page.getByRole(role as any, options);
  }
}

// ============================================================================
// FORM INTERACTION PATTERNS
// ============================================================================

export class FormHelpers {
  constructor(private page: Page) {}

  /**
   * Fill input field by label text
   */
  async fillByLabel(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Fill input field by test ID
   */
  async fillByTestId(testId: string, value: string): Promise<void> {
    await this.page.getByTestId(testId).fill(value);
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.selectOption(selector, value);
  }

  /**
   * Click button by text
   */
  async clickButton(text: string): Promise<void> {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Submit form and wait for navigation
   */
  async submitAndWait(buttonText: string): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation(),
      this.clickButton(buttonText),
    ]);
  }

  /**
   * Check form validation error
   */
  async expectValidationError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

// ============================================================================
// API MOCKING PATTERNS
// ============================================================================

export class ApiMocker {
  constructor(private page: Page) {}

  /**
   * Mock successful API response
   */
  async mockSuccess(url: string | RegExp, data: any): Promise<void> {
    await this.page.route(url, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    });
  }

  /**
   * Mock API error response
   */
  async mockError(url: string | RegExp, status: number, message: string): Promise<void> {
    await this.page.route(url, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: message }),
      });
    });
  }

  /**
   * Mock SSE (Server-Sent Events) stream
   */
  async mockSSE(url: string | RegExp, events: Array<{ data: any; delay?: number }>): Promise<void> {
    await this.page.route(url, async (route) => {
      const eventStream = events
        .map(({ data }) => `data: ${JSON.stringify(data)}\n\n`)
        .join('');

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: eventStream,
      });
    });
  }

  /**
   * Wait for API call to be made
   */
  async waitForRequest(url: string | RegExp): Promise<void> {
    await this.page.waitForRequest(url);
  }

  /**
   * Wait for API response
   */
  async waitForResponse(url: string | RegExp, status?: number): Promise<void> {
    await this.page.waitForResponse(
      (response) => {
        const urlMatches = typeof url === 'string'
          ? response.url().includes(url)
          : url.test(response.url());
        const statusMatches = status ? response.status() === status : true;
        return urlMatches && statusMatches;
      }
    );
  }
}

// ============================================================================
// ASSERTION PATTERNS
// ============================================================================

export class CustomAssertions {
  constructor(private page: Page) {}

  /**
   * Assert URL contains path
   */
  async expectUrl(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  /**
   * Assert page title
   */
  async expectTitle(title: string): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  /**
   * Assert element is visible
   */
  async expectVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  /**
   * Assert element contains text
   */
  async expectText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  /**
   * Assert element has specific count
   */
  async expectCount(selector: string, count: number): Promise<void> {
    await expect(this.page.locator(selector)).toHaveCount(count);
  }

  /**
   * Assert loading state (spinner/skeleton)
   */
  async expectLoading(isLoading: boolean): Promise<void> {
    const loader = this.page.getByTestId('loading-spinner');
    if (isLoading) {
      await expect(loader).toBeVisible();
    } else {
      await expect(loader).not.toBeVisible();
    }
  }

  /**
   * Assert toast/notification message
   */
  async expectToast(message: string, type?: 'success' | 'error' | 'info'): Promise<void> {
    const toast = this.page.getByRole('alert');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(message);
    if (type) {
      await expect(toast).toHaveAttribute('data-type', type);
    }
  }
}

// ============================================================================
// WAIT PATTERNS
// ============================================================================

export class WaitHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for element to appear and disappear (loading states)
   */
  async waitForTransient(selector: string, timeout = 5000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
    await this.page.waitForSelector(selector, { state: 'hidden', timeout });
  }

  /**
   * Wait for SSE event stream to complete
   */
  async waitForSSEComplete(eventSelector: string, finalText: string): Promise<void> {
    await this.page.waitForSelector(eventSelector);
    await this.page.waitForFunction(
      (args) => {
        const element = document.querySelector(args.selector);
        return element?.textContent?.includes(args.text);
      },
      { selector: eventSelector, text: finalText }
    );
  }

  /**
   * Wait for debounced input (search, autocomplete)
   */
  async waitForDebounce(ms = 500): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Poll for condition with timeout
   */
  async waitForCondition(
    condition: () => Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.page.waitForTimeout(interval);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

export class StorageHelpers {
  constructor(private page: Page) {}

  /**
   * Set localStorage item
   */
  async setLocalStorage(key: string, value: any): Promise<void> {
    await this.page.evaluate(
      ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      { key, value }
    );
  }

  /**
   * Get localStorage item
   */
  async getLocalStorage(key: string): Promise<any> {
    return await this.page.evaluate(
      (key) => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      },
      key
    );
  }

  /**
   * Clear all localStorage
   */
  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
  }

  /**
   * Set authentication token
   */
  async setAuthToken(token: string): Promise<void> {
    await this.setLocalStorage('auth_token', token);
  }
}

// ============================================================================
// EXAMPLE TEST STRUCTURE
// ============================================================================

/**
 * Example: Complete test suite structure
 */
test.describe('Feature Name', () => {
  // Setup and teardown
  test.beforeEach(async ({ page }) => {
    // Navigate to starting point
    await page.goto('/');

    // Set up common state
    const storage = new StorageHelpers(page);
    await storage.clearLocalStorage();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup if needed
  });

  test('should perform basic action', async ({ page }) => {
    // Arrange
    const formHelpers = new FormHelpers(page);
    const assertions = new CustomAssertions(page);

    // Act
    await formHelpers.fillByLabel('Email', 'user@example.com');
    await formHelpers.clickButton('Submit');

    // Assert
    await assertions.expectUrl('/success');
    await assertions.expectToast('Success!', 'success');
  });

  test('should handle error state', async ({ page }) => {
    // Arrange
    const apiMocker = new ApiMocker(page);
    await apiMocker.mockError(/api\/submit/, 400, 'Invalid input');

    // Act
    const formHelpers = new FormHelpers(page);
    await formHelpers.fillByLabel('Email', 'invalid');
    await formHelpers.clickButton('Submit');

    // Assert
    const assertions = new CustomAssertions(page);
    await assertions.expectToast('Invalid input', 'error');
  });

  test('should handle loading state', async ({ page }) => {
    // Arrange
    const apiMocker = new ApiMocker(page);
    const waitHelpers = new WaitHelpers(page);
    const assertions = new CustomAssertions(page);

    // Mock delayed response
    await page.route(/api\/data/, async (route) => {
      await page.waitForTimeout(1000);
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ data: 'test' }),
      });
    });

    // Act
    await page.getByRole('button', { name: 'Load Data' }).click();

    // Assert loading appears
    await assertions.expectLoading(true);

    // Wait for loading to complete
    await waitHelpers.waitForTransient('[data-testid="loading-spinner"]');

    // Assert data loaded
    await assertions.expectVisible('[data-testid="data-display"]');
  });
});

// ============================================================================
// VISUAL REGRESSION TESTING
// ============================================================================

test.describe('Visual Regression', () => {
  test('should match screenshot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Take screenshot and compare
    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match component screenshot', async ({ page }) => {
    await page.goto('/components');

    const button = page.getByTestId('primary-button');
    await expect(button).toHaveScreenshot('primary-button.png');
  });
});

// ============================================================================
// ACCESSIBILITY TESTING
// ============================================================================

test.describe('Accessibility', () => {
  test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/');

    // Using @axe-core/playwright
    // const { injectAxe, checkA11y } = require('axe-playwright');
    // await injectAxe(page);
    // await checkA11y(page, null, {
    //   detailedReport: true,
    //   detailedReportOptions: { html: true },
    // });
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/form');

    // Tab through form
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Name')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();
  });
});
