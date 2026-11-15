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

  test("first paint: lines 1 to 9 are shown at load, lines 10 to 20 and the done line are not", async ({ page }) => {
    // A short viewport keeps the terminal under half visible, so nothing types yet.
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto("/");
    await expect(page.locator("#library .lib-js, #library.lib-js")).toHaveCount(1);
    const state = await page.locator("#library [data-term-line]").evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).visibility),
    );
    expect(state.slice(0, 9)).toEqual(Array(9).fill("visible"));
    expect(state.slice(9)).toEqual(Array(11).fill("hidden"));
    await expect(page.locator("#library [data-term-done]")).toHaveCSS("visibility", "hidden");
    // The space of the hidden lines is kept: no layout jump when they type in.
    const box = await page.locator("#library .term-lines").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(20 * 40);
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
