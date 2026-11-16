import { expect, test } from "@playwright/test";
import { LIBRARY_COUNTS, LIBRARY_STATIONS } from "../lib/generated/library-data";

/**
 * The library list is server HTML: with JavaScript off all 303 items are
 * links, and the station chips filter through CSS :target (ruling 2105).
 */
test.describe("library without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("303 unique hrefs inside the section", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page
      .locator("#library #library-list li a")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs).toHaveLength(LIBRARY_COUNTS.items);
    expect(new Set(hrefs).size).toBe(LIBRARY_COUNTS.items);
  });

  test("a station chip lists only that station", async ({ page }) => {
    await page.goto("/#station-plan");
    const plan = LIBRARY_STATIONS.find((s) => s.key === "plan");
    const visible = page.locator("#library .lib-row:visible");
    await expect(visible).toHaveCount((plan?.skills ?? 0) + (plan?.agents ?? 0) + (plan?.hooks ?? 0));
  });

  test("search is not rendered without JS", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#library [data-lib-search]")).toBeHidden();
  });
});

test.describe("library with JavaScript", () => {
  test("?station= filters the list and the count follows", async ({ page }) => {
    await page.goto("/?station=plan");
    const plan = LIBRARY_STATIONS.find((s) => s.key === "plan");
    const expected = (plan?.skills ?? 0) + (plan?.agents ?? 0) + (plan?.hooks ?? 0);
    await expect(page.locator("#library .lib-row:visible")).toHaveCount(expected);
    await expect(page.locator("#library [data-lib-count]")).toHaveText(
      `${expected} of ${LIBRARY_COUNTS.items}`,
    );
  });

  test("search hides rows and never removes them from the DOM", async ({ page }) => {
    await page.goto("/");
    await page.locator("#library [data-lib-search]").fill("verify");
    await expect(page.locator("#library .lib-row")).toHaveCount(LIBRARY_COUNTS.items);
    await expect(page.locator("#library .lib-row:visible").first()).toBeVisible();
    expect(await page.locator("#library .lib-row:visible").count()).toBeLessThan(LIBRARY_COUNTS.items);
  });
});
