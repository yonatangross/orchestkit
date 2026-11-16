import { expect, test } from "@playwright/test";

test.describe("library drawer", () => {
  test("opens from a row, Esc closes it, focus returns to the row link", async ({ page }) => {
    await page.goto("/");
    // Before the client starts, Enter follows the link instead of opening the drawer.
    await expect(page.locator("#library.lib-js")).toHaveCount(1);
    // The terminal lines carry data-lib-item too; the row is the one in the list.
    const link = page.locator('#library-list a[data-lib-item="skill:implement"]');
    await link.scrollIntoViewIfNeeded();
    await link.focus();
    await page.keyboard.press("Enter");

    const drawer = page.locator("#library dialog[data-lib-drawer]");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "implement" })).toBeVisible();
    await expect(drawer.locator("[data-lib-drawer-call-text]")).toHaveText("/ork:implement");
    await expect(drawer.getByRole("link", { name: /Open the page/ })).toHaveAttribute(
      "href",
      "/docs/reference/skills/implement",
    );

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("the section has no unnamed links, buttons or inputs", async ({ page }) => {
    await page.goto("/");
    const unnamed = await page.locator("#library").evaluate((root) => {
      const bad: string[] = [];
      for (const el of root.querySelectorAll("a[href], button, input")) {
        const text = (el.textContent ?? "").trim();
        const label = el.getAttribute("aria-label") ?? "";
        const labelled = el.id && root.querySelector(`label[for="${el.id}"]`);
        if (!text && !label && !labelled) bad.push(el.outerHTML.slice(0, 80));
      }
      return bad;
    });
    expect(unnamed).toEqual([]);
  });
});
