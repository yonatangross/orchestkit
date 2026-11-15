import { expect, test } from "@playwright/test";

const DONE = "Done. 20 library items took part in this run.";

test.describe("library terminal", () => {
  test("reduced motion: the finished run is there at load, nothing typed", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html.term-anim")).toHaveCount(0);
    await expect(page.locator("#library [data-term-line]:visible")).toHaveCount(20);
    await expect(page.locator("#library [data-term-done]")).toBeVisible();
    await expect(page.locator("#library [data-term-done]")).toContainText(DONE);
    await context.close();
  });

  test("a full run announces the done line once", async ({ page }) => {
    await page.goto("/");
    await page.locator("#library .term-box").scrollIntoViewIfNeeded();
    const live = page.locator("#library [data-term-live]");
    await expect(live).toHaveText("");
    await page.getByRole("button", { name: "Skip to end" }).click();
    await expect(live).toHaveText(DONE);
    await expect(page.getByRole("button", { name: "Pause" })).toBeDisabled();
    await expect(page.locator("#library [data-term-line]:visible")).toHaveCount(20);
  });

  test("Replay starts a new run", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Skip to end" }).click();
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(page.locator("#library [data-term-live]")).toHaveText("");
  });

  for (const width of [1440, 390]) {
    test(`${width}: no sideways scroll, controls at least 44 px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto("/");
      await page.locator("#library").scrollIntoViewIfNeeded();
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll).toBe(overflow.client);
      const small = await page
        .locator("#library .term-ctl button, #library .lib-rail-btn, #library .lib-seg, #library .lib-chip")
        .evaluateAll((els) =>
          els
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0 && (r.height < 44 || r.width < 44))
            .length,
        );
      expect(small).toBe(0);
    });
  }
});
