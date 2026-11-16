import { expect, test } from '@playwright/test';

// First visit: no stored choice, so the analytics consent banner shows. It must
// not take over the first screen (Yonatan, 16.11.2026: at 1440 it covered the
// lower third of the library terminal, at 390 about half the screen). The
// approved look stays: a solid card, Decline and Allow equally easy, the
// "Privacy notice" link, no overlay (approved-design/consent-banner-*.txt).
test.describe('Landing consent banner, first visit', () => {
  for (const vp of [
    { width: 1440, height: 900, maxHeight: 80 },
    { width: 390, height: 844, maxHeight: Math.round(844 * 0.24) },
  ]) {
    test(`${vp.width}: a slim card that leaves the first screen readable`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      const card = page.getByTestId('analytics-consent-card');
      await expect(card).toBeVisible();

      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeLessThanOrEqual(vp.maxHeight);

      // Decline and Allow stay the same size, so declining is as easy as allowing.
      const decline = await page.getByRole('button', { name: 'Decline' }).boundingBox();
      const allow = await page.getByRole('button', { name: 'Allow analytics' }).boundingBox();
      expect(decline).not.toBeNull();
      expect(allow).not.toBeNull();
      expect(Math.abs(decline!.height - allow!.height)).toBeLessThanOrEqual(1);
      expect(decline!.height).toBeGreaterThanOrEqual(vp.width < 640 ? 44 : 40);
      await expect(page.getByRole('link', { name: 'Privacy notice' })).toBeVisible();

      // Non-modal: the page outside the card is still clickable.
      await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    });
  }
});
