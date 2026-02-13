/**
 * Page Object Template for Playwright
 * 
 * Copy this template when creating new page objects.
 * Replace placeholders with actual locators and methods.
 */

import { Page, Locator, expect } from '@playwright/test';

export class ExamplePage {
  // ==========================================================================
  // Locators
  // ==========================================================================
  
  private readonly heading: Locator;
  private readonly form: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorAlert: Locator;
  private readonly successAlert: Locator;
  private readonly loadingSpinner: Locator;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  constructor(private readonly page: Page) {
    // Use semantic locators (getByRole, getByLabel) as primary strategy
    this.heading = page.getByRole('heading', { name: 'Example Page' });
    this.form = page.getByRole('form');
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.errorAlert = page.getByRole('alert').filter({ hasText: 'Error' });
    this.successAlert = page.getByRole('alert').filter({ hasText: 'Success' });
    this.loadingSpinner = page.getByTestId('loading-spinner');
  }

  // ==========================================================================
  // Navigation
  // ==========================================================================

  async goto() {
    await this.page.goto('/example');
    await this.waitForLoad();
  }

  async waitForLoad() {
    await expect(this.heading).toBeVisible();
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  async fillForm(data: { email: string; password: string }) {
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async fillAndSubmit(data: { email: string; password: string }) {
    await this.fillForm(data);
    await this.submit();
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  async getHeadingText(): Promise<string> {
    return await this.heading.textContent() ?? '';
  }

  async getErrorMessage(): Promise<string> {
    return await this.errorAlert.textContent() ?? '';
  }

  // ==========================================================================
  // Assertions
  // ==========================================================================

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.form).toBeVisible();
  }

  async expectError(message: string) {
    await expect(this.errorAlert).toBeVisible();
    await expect(this.errorAlert).toContainText(message);
  }

  async expectSuccess(message?: string) {
    await expect(this.successAlert).toBeVisible();
    if (message) {
      await expect(this.successAlert).toContainText(message);
    }
  }

  async expectLoading() {
    await expect(this.loadingSpinner).toBeVisible();
  }

  async expectNotLoading() {
    await expect(this.loadingSpinner).not.toBeVisible();
  }

  async expectNavigatedTo(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  async expectFormEmpty() {
    await expect(this.emailInput).toBeEmpty();
    await expect(this.passwordInput).toBeEmpty();
  }

  // ==========================================================================
  // Composite Actions
  // ==========================================================================

  async submitAndWaitForSuccess() {
    await this.submit();
    await this.expectSuccess();
  }

  async submitAndWaitForError(message: string) {
    await this.submit();
    await this.expectError(message);
  }
}

// =============================================================================
// Usage Example
// =============================================================================

/*
import { test } from '@playwright/test';
import { ExamplePage } from '../pages/ExamplePage';

test('user can submit form', async ({ page }) => {
  const examplePage = new ExamplePage(page);
  
  await examplePage.goto();
  await examplePage.fillAndSubmit({
    email: 'test@example.com',
    password: 'password123',
  });
  await examplePage.expectSuccess('Form submitted');
});

test('shows validation error', async ({ page }) => {
  const examplePage = new ExamplePage(page);
  
  await examplePage.goto();
  await examplePage.fillAndSubmit({
    email: 'invalid-email',
    password: 'short',
  });
  await examplePage.expectError('Invalid email format');
});
*/
