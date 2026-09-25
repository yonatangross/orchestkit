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

  test('hero A art bleeds on desktop and stacks as 16:9 under copy on narrow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const art = page.locator('.home-hero-art');
    await expect(art).toBeVisible();
    const desktop = await art.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        position: cs.position,
        widthPct: Math.round((r.width / window.innerWidth) * 100),
        width: r.width,
        height: r.height,
        aspect: r.height > 0 ? Number((r.width / r.height).toFixed(2)) : 0,
        mask: cs.maskImage || (cs as CSSStyleDeclaration & { webkitMaskImage?: string }).webkitMaskImage || '',
      };
    });
    expect(desktop.position).toBe('absolute');
    expect(desktop.widthPct).toBeGreaterThanOrEqual(40);
    expect(desktop.widthPct).toBeLessThanOrEqual(75);
    expect(desktop.mask).toMatch(/linear-gradient/);
    // Source is 1280x723 (~1.77). Full-column stretch + cover cropped the
    // conductor (~2x zoom). Height must track width at that ratio, not the
    // tall copy column (picker/search/proof).
    expect(desktop.height).toBeGreaterThan(200);
    expect(desktop.height).toBeLessThan(480);
    expect(desktop.aspect).toBeGreaterThan(1.6);
    expect(desktop.aspect).toBeLessThan(2.0);
    const expectedH = desktop.width * (723 / 1280);
    expect(Math.abs(desktop.height - expectedH)).toBeLessThan(12);

    // Mockup caps display at 4.25rem so the headline is 3 lines at 1440.
    const h1Lines = await page.locator('#hero-heading').evaluate((el) => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lh) || lh <= 0) return -1;
      return Math.round(el.getBoundingClientRect().height / lh);
    });
    expect(h1Lines).toBe(3);

    // Art must sit beside the headline, not vertically centred on the full
    // copy column. Compare artTop to h1.top (not h1.bottom): a centered
    // 16:9 box can still clear h1.bottom at 1440x900 (CodeRabbit).
    const anchor = await page.evaluate(() => {
      const art = document.querySelector('.home-hero-art')?.getBoundingClientRect();
      const h1 = document.querySelector('#hero-heading')?.getBoundingClientRect();
      if (!art || !h1) return null;
      return { artTop: art.top, h1Top: h1.top };
    });
    expect(anchor).not.toBeNull();
    expect(anchor!.artTop).toBeLessThan(anchor!.h1Top);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await art.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        position: cs.position,
        aspect: r.width > 0 ? Number((r.width / r.height).toFixed(2)) : 0,
        top: r.top,
        bottom: r.bottom,
      };
    });
    const h1Bottom = await page.locator('#hero-heading').evaluate((el) => el.getBoundingClientRect().bottom);
    const installTop = await page.locator('[data-hero-install]').evaluate((el) => el.getBoundingClientRect().top);
    expect(mobile.position).toBe('relative');
    expect(mobile.aspect).toBeGreaterThan(1.6);
    expect(mobile.aspect).toBeLessThan(2.0);
    expect(mobile.top).toBeGreaterThan(h1Bottom - 1);
    expect(mobile.bottom).toBeLessThanOrEqual(installTop + 1);
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
    // Scope to the library tabpanel: the hero CopyInstallButton also owns a
    // live region (role=status, sr-only), so a page-wide getByRole('status')
    // is ambiguous (strict mode: 2 matches).
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('status')).toContainText(/agents/i);
    await expect(panel).toBeVisible();
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
    // exact: the lazily loaded skill browser also renders design-import's description, which mentions /ork:design-ship
    await expect(page.getByText('/ork:design-ship', { exact: true })).toBeVisible();
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
    // Releases are 10.0.0-beta.N now; RecentVersions links those anchors.
    await expect(page.getByRole('link', { name: /10\.0\.0-beta\.\d+/ }).first()).toBeVisible();
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

  test('Get started CTA uses the primary text color', async ({ page }) => {
    await page.goto('/');

    // Hero option A: Get started is a text link (text-fd-primary), which maps
    // to --color-fd-primary. Probe that token on a throwaway node and require
    // the CTA color to equal it (any other opaque color must fail).
    const cta = page.getByRole('link', { name: /get started/i }).first();
    const { color, primary } = await cta.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-fd-primary)';
      document.body.appendChild(probe);
      const primaryColor = getComputedStyle(probe).color;
      probe.remove();
      return { color: getComputedStyle(el).color, primary: primaryColor };
    });
    expect(primary).toMatch(/^(rgb|oklch|lab|color|hwb|hsl)\(/);
    expect(primary).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/);
    expect(color).toBe(primary);
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
