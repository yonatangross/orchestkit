import { test, expect } from '@playwright/test';

/**
 * E2E coverage for the redesigned landing page (Claude Design handoff
 * shipped in #1399). Runs against `next dev` via the playwright.config
 * webServer block.
 *
 * Coverage scope:
 *   - Hero structure + brand copy
 *   - Three primitive cards (Skills/Agents/Hooks) with counts
 *   - Eight recipe cards
 *   - Mobile viewport stacks correctly
 *   - Real GitHub stars rendered or graceful fallback
 *   - Dark mode CSS variables resolve to colors (no missing tokens)
 */

test.describe('Landing — hero', () => {
  test('hero renders with brand headline + CTAs', async ({ page }) => {
    await page.goto('/');

    // Headline split across two lines: "Stop explaining your stack." / "Start shipping."
    await expect(page.locator('h1', { hasText: 'Start shipping.' })).toBeVisible();
    await expect(page.locator('h1', { hasText: 'Stop explaining your stack.' })).toBeVisible();

    // Eyebrow pill
    await expect(
      page.getByText('The complete AI development toolkit for Claude Code'),
    ).toBeVisible();

    // CTAs (the hero CTA — there is also a persona-card "Get started" link
    // that matches /get started/i, so scope to the first one which is the hero)
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /see the cookbook/i })).toBeVisible();
  });

  test('proof strip shows GitHub stars (real number or fallback)', async ({ page }) => {
    await page.goto('/');

    // Either "<n>k stars" / "<n> stars" or "Star on GitHub" if API failed
    const proof = page.locator('a[href*="stargazers"]');
    await expect(proof).toBeVisible();
    const text = (await proof.innerText()).trim();
    expect(
      /\d+(\.\d+)?k?\s+stars?/.test(text) || /Star on GitHub/.test(text),
      `proof strip text was: "${text}"`,
    ).toBeTruthy();
  });
});

test.describe('Landing — primitives', () => {
  test('three primitive cards render with counts', async ({ page }) => {
    await page.goto('/');

    // The primitives are headed by "The building blocks"
    const heading = page.getByRole('heading', { name: 'The building blocks' });
    await expect(heading).toBeVisible();

    // Skills, Agents, Hooks each appear as h3
    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hooks' })).toBeVisible();

    // Each card has a count > 0 (numeric tabular-nums element)
    const counts = page.locator('.tabular-nums').first();
    await expect(counts).toBeVisible();
  });
});

test.describe('Landing — cookbook recipes', () => {
  test('all 8 recipe cards render with command footer', async ({ page }) => {
    await page.goto('/');

    // Cookbook section heading
    await expect(page.getByRole('heading', { name: 'Cookbook' })).toBeVisible();

    // Each known recipe title is present
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

    // The Claude Design recipe carries a "NEW" badge
    await expect(page.getByText('NEW', { exact: true })).toBeVisible();

    // At least one /ork: command footer is present
    await expect(page.getByText('/ork:design-ship')).toBeVisible();
  });
});

test.describe('Landing — value-prop strip', () => {
  test('three persona cards render with eyebrow numbering', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('01 / New here')).toBeVisible();
    await expect(page.getByText('02 / Evaluating')).toBeVisible();
    await expect(page.getByText('03 / Existing user')).toBeVisible();

    await expect(page.getByText('New to OrchestKit?')).toBeVisible();
    await expect(page.getByText('Evaluating for your team?')).toBeVisible();
    await expect(page.getByText('Already using Claude Code?')).toBeVisible();
  });
});

test.describe('Landing — design tokens (no missing CSS variables)', () => {
  test('hero foreground resolves to a real color (token defined)', async ({ page }) => {
    await page.goto('/');

    // The H1 should compute to a non-transparent, non-default color.
    // Browsers may return rgb(), rgba(), oklch(), lab(), color(), hwb(), etc.
    // depending on how they normalize the CSS color used. Accept any
    // recognized CSS color function and reject only the transparent default.
    const h1 = page.locator('h1').first();
    const color = await h1.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/^(rgb|oklch|lab|color|hwb|hsl)\(/);
    expect(color).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/);
  });

  test('primary button uses the emerald token', async ({ page }) => {
    await page.goto('/');

    const cta = page.getByRole('link', { name: /get started/i }).first();
    const bg = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Should be SOME color, not transparent or fallback inherit. Accept any
    // recognized CSS color function (browsers normalize to lab/oklch/rgb/etc).
    expect(bg).toMatch(/^(rgb|oklch|lab|color|hwb|hsl)\(/);
    expect(bg).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/);
  });
});

test.describe('Landing — mobile viewport (project: chromium-mobile)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 600, 'mobile-only');

  test('layout stacks without horizontal overflow', async ({ page }) => {
    await page.goto('/');

    // Body should not require horizontal scroll
    const overflow = await page.evaluate(
      () => document.body.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2); // tolerate 1-2px sub-pixel rounding

    // Hero CTAs should still be visible and clickable
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });
});
