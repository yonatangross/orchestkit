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

  test('hero A art sits beside the copy on desktop and stacks as 4:3 under the install on narrow', async ({ page }) => {
    // Pin the stored theme: emulateMedia is a no-op under defaultTheme "dark".
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
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
    // In flow (grid column 2). Absolute left column 2 empty beside a copy
    // column ~600px taller than the art (operator report 2026-09-25).
    expect(desktop.position).toBe('relative');
    expect(desktop.widthPct).toBeGreaterThanOrEqual(40);
    expect(desktop.widthPct).toBeLessThanOrEqual(75);
    expect(desktop.mask).toMatch(/radial-gradient/);
    // Both layers are cropped to the subject, 840x723 (~1.16). Full-column
    // stretch + cover cropped the conductor (~2x zoom, #4345). Height must
    // track width at that ratio, not the tall copy column.
    expect(desktop.height).toBeGreaterThan(300);
    expect(desktop.height).toBeLessThan(600);
    expect(desktop.aspect).toBeGreaterThan(1.1);
    expect(desktop.aspect).toBeLessThan(1.25);
    const expectedH = desktop.width * (723 / 840);
    expect(Math.abs(desktop.height - expectedH)).toBeLessThan(12);

    // Mockup caps display at 4.25rem so the headline is 3 lines at 1440.
    const h1Lines = await page.locator('#hero-heading').evaluate((el) => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lh) || lh <= 0) return -1;
      return Math.round(el.getBoundingClientRect().height / lh);
    });
    expect(h1Lines).toBe(3);

    // Art sits beside the headline and the install block, and the install box
    // (host chips + that host's command) is inside the copy column, under the
    // headline, so nothing leaves the right side bare.
    const anchor = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)?.getBoundingClientRect();
      const art = box('.home-hero-art');
      const h1 = box('#hero-heading');
      const copy = box('.home-hero-copy');
      const install = box('[data-hero-install]');
      if (!art || !h1 || !copy || !install) return null;
      return { art, h1, copy, install };
    });
    expect(anchor).not.toBeNull();
    const { art: a, h1, copy, install } = anchor!;
    expect(a.top).toBeLessThan(h1.bottom);
    const artMid = (a.top + a.bottom) / 2;
    expect(artMid).toBeGreaterThan(copy.top);
    expect(artMid).toBeLessThan(copy.bottom);
    expect(install.top).toBeGreaterThan(h1.bottom);
    expect(install.bottom).toBeLessThanOrEqual(copy.bottom + 1);

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
    const installBottom = await page.locator('[data-hero-install]').evaluate((el) => el.getBoundingClientRect().bottom);
    expect(mobile.position).toBe('relative');
    // 4:3 band (the art is cropped to its subject; 16:9 cut the outer players).
    expect(mobile.aspect).toBeGreaterThan(1.25);
    expect(mobile.aspect).toBeLessThan(1.45);
    // Phones: install first, art after it (35% of home sessions are mobile,
    // median home scroll 10%, so the command must be on screen one).
    expect(mobile.top).toBeGreaterThan(h1Bottom - 1);
    expect(mobile.top).toBeGreaterThanOrEqual(installBottom - 1);
  });

  for (const width of [1280, 1575, 2000]) {
    test(`hero art sits right beside the copy in dark at ${width}px`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const gap = await page.evaluate(() => {
        const art = document.querySelector('.home-hero-art')!.getBoundingClientRect();
        const copy = document.querySelector('.home-hero-copy')!.getBoundingClientRect();
        return { gap: art.left - copy.right, right: art.right };
      });
      // A source 44% black on the left plus a box that grew with the
      // viewport put the conductor ~490px from the headline at 2000px
      // (operator, 2026-09-25). Now the art starts one column gap after the
      // copy and stays inside the 1180px container.
      expect(gap.gap).toBeGreaterThanOrEqual(0);
      expect(gap.gap).toBeLessThanOrEqual(40);
      expect(gap.right).toBeLessThanOrEqual(width / 2 + 590 + 1);
    });
  }

  test('light theme shows the light art, never the dark night scene', async ({ page }) => {
    // defaultTheme is "dark" (app/layout.tsx), so pick light the way the
    // theme switch does rather than through prefers-color-scheme.
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
    await page.setViewportSize({ width: 1575, height: 900 });
    await page.goto('/');
    // Let the 900ms entrance keyframe finish before reading opacity.
    await page.waitForTimeout(1200);
    const layers = await page.evaluate(() => {
      const op = (s: string) => Number(getComputedStyle(document.querySelector(s)!).opacity);
      const art = getComputedStyle(document.querySelector('.home-hero-art')!);
      return {
        light: op('.home-hero-art-light'),
        dark: op('.home-hero-art-dark'),
        mask: art.maskImage || (art as CSSStyleDeclaration & { webkitMaskImage?: string }).webkitMaskImage || 'none',
      };
    });
    expect(layers.light).toBe(1);
    expect(layers.dark).toBe(0);
    expect(layers.mask).toMatch(/radial-gradient/);
  });

  test('theme switch runs the circle reveal and the art entrance', async ({ page, browserName }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.setViewportSize({ width: 1575, height: 900 });
    await page.goto('/');
    // Wait for hydration (the toggle's handler) and for the page-load entrance
    // to finish, so any hero-art-in seen below comes from the switch itself.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    const clicked = await page.evaluate(() => {
      const button = document.querySelector('[data-theme-toggle] button[aria-label="Light"]') as HTMLButtonElement | null;
      if (!button || typeof document.startViewTransition !== 'function') return false;
      // Record animation starts instead of sampling getAnimations at a fixed
      // time. On a slow CI runner the view transition's ready resolves ~550ms
      // after the click and the reveal starts ~780ms after (measured at 6x CPU
      // throttle), so a 60ms sample saw only hero-art-in (run 36131202725).
      const seen = new Set<string>();
      (window as unknown as { __themeAnims: Set<string> }).__themeAnims = seen;
      document.documentElement.addEventListener('animationstart', (e) => seen.add(e.animationName), true);
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      button.click();
      return true;
    });
    test.skip(!clicked, 'no View Transitions API in this browser');
    // WebKit (the iPhone project) switches the theme but its view-transition
    // pseudo animations are not observable here, so the reveal is asserted in
    // Chromium only.
    const expected = browserName === 'chromium' ? ['hero-art-in', 'theme-reveal'] : ['hero-art-in'];
    await page.waitForFunction(
      (names) => {
        const seen = (window as unknown as { __themeAnims?: Set<string> }).__themeAnims;
        return !!seen && names.every((n) => seen.has(n));
      },
      expected,
      { timeout: 5000 },
    );
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
    // .first(): the legend chip; the release-mix diagram renders the same words
    // asynchronously, which made this a strict-mode race.
    await expect(page.getByText('new capability').first()).toBeVisible();
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

    // Get started is a text link (text-fd-primary). Probe that utility on a
    // throwaway node and require the CTA color to equal it (any other opaque
    // color must fail). The utility, not the raw --color-fd-primary: in dark
    // mode primary TEXT is lightened for contrast (axe, 2026-09-25).
    const cta = page.getByRole('link', { name: /get started/i }).first();
    const { color, primary } = await cta.evaluate((el) => {
      const probe = document.createElement('span');
      probe.className = 'text-fd-primary';
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
