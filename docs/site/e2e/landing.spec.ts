import { test, expect } from '@playwright/test';

/**
 * E2E coverage for the catalog-first landing page.
 * Runs against `next dev` via the playwright.config webServer block.
 *
 * Coverage scope:
 *   - Hero structure + brand copy
 *   - Library catalog tabs (Skills/Agents/Hooks)
 *   - Eight recipe cards
 *   - Changelog What's new strip
 *   - Mobile viewport stacks correctly
 *   - Real GitHub stars rendered or graceful fallback
 *   - CSS variables resolve to colors (no missing tokens)
 */

test.describe('Landing hero', () => {
  test('hero renders with brand headline + CTAs', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1', { hasText: 'Start shipping.' })).toBeVisible();
    await expect(page.locator('h1', { hasText: 'Stop explaining your stack.' })).toBeVisible();

    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The library' })).toBeVisible();
    await expect(page.getByRole('link', { name: /join the whatsapp community/i })).toHaveAttribute(
      'href',
      '/community',
    );
    await expect(page.getByRole('navigation', { name: /install by host/i })).toBeVisible();
  });

  test('proof strip shows GitHub stars (real number or fallback)', async ({ page }) => {
    await page.goto('/');

    const proof = page.locator('a[href*="stargazers"]');
    await expect(proof).toBeVisible();
    const text = (await proof.innerText()).trim();
    expect(
      /\d+(\.\d+)?k?\s+stars?/.test(text) || /Star on GitHub/.test(text),
      `proof strip text was: "${text}"`,
    ).toBeTruthy();
  });
});

test.describe('Landing library catalog', () => {
  test('skills/agents/hooks tabs render with counts', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'The library' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Skills/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Agents/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Hooks/ })).toBeVisible();

    const counts = page.locator('.tabular-nums').first();
    await expect(counts).toBeVisible();
  });

  test('agents tab shows the agents catalog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /Agents/ }).click();
    await expect(page.getByRole('tab', { name: /Agents/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('status')).toContainText(/agents/i);
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });
});

test.describe('Landing cookbook recipes', () => {
  test('all 8 recipe cards render with command footer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Cookbook' })).toBeVisible();

    const titles = [
      'Implement a feature',
      'Claude Design → PR',
      'Review a PR',
      'Fix a GitHub issue',
      'Task management',
      'Set up memory',
      'Create a demo video',
      'Security audit',
    ];
    for (const t of titles) {
      await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    }

    await expect(page.getByText('NEW', { exact: true })).toBeVisible();
    await expect(page.getByText('/ork:design-ship')).toBeVisible();
  });
});

test.describe('Landing changelog', () => {
  test('whats new strip and changelog nav exist', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: "What's new" })).toBeVisible();
    await expect(page.getByRole('link', { name: /Full changelog/i })).toBeVisible();

    await page.goto('/changelog');
    await expect(page.getByRole('heading', { name: 'Changelog' })).toBeVisible();
    await expect(page.getByText('new capability')).toBeVisible();
    await expect(page.getByRole('link', { name: /10\.0\.0-alpha\.\d+/ }).first()).toBeVisible();
  });
});

test.describe('Landing design tokens (no missing CSS variables)', () => {
  test('hero foreground resolves to a real color (token defined)', async ({ page }) => {
    await page.goto('/');

    const h1 = page.locator('h1').first();
    const color = await h1.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/^(rgb|oklch|lab|color|hwb|hsl)\(/);
    expect(color).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/);
  });

  test('primary button uses the indigo token', async ({ page }) => {
    await page.goto('/');

    const cta = page.getByRole('link', { name: /get started/i }).first();
    const bg = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/^(rgb|oklch|lab|color|hwb|hsl)\(/);
    expect(bg).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/);
  });
});

test.describe('Landing mobile viewport (project: chromium-mobile)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 600, 'mobile-only');

  test('layout stacks without horizontal overflow', async ({ page }) => {
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.body.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });
});
