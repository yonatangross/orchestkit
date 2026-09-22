import { test, expect } from "@playwright/test";

/**
 * Repro + regression for PostHog InvalidStateError on View Transitions:
 *   - overlapping startViewTransition (in-flight)
 *   - viewport resize mid-transition
 *   - document hidden mid-transition
 *
 * Issues: 01a0a900, 01a094ab, 01a0b835 (project 236036).
 */

test.describe("View transition abort guard", () => {
	test("overlapping nav, resize, and hide do not surface VT abort errors", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const aborts: string[] = [];

		page.on("pageerror", (err) => {
			if (/Transition was (?:aborted|skipped)|ViewTransition was aborted/i.test(err.message)) {
				aborts.push(`pageerror:${err.message}`);
			}
		});
		page.on("console", (msg) => {
			if (msg.type() !== "error") return;
			const text = msg.text();
			if (/Transition was (?:aborted|skipped)|ViewTransition was aborted/i.test(text)) {
				aborts.push(`console:${text}`);
			}
		});
		await page.addInitScript(() => {
			window.addEventListener("unhandledrejection", (event) => {
				const reason = event.reason;
				const message =
					reason instanceof Error
						? reason.message
						: typeof reason === "string"
							? reason
							: String(reason);
				if (
					/Transition was (?:aborted|skipped)|ViewTransition was aborted/i.test(
						message,
					)
				) {
					const w = window as unknown as { __orkVtAborts?: string[] };
					w.__orkVtAborts ??= [];
					w.__orkVtAborts.push(message);
				}
			});
		});

		await page.goto("/");
		await expect(page.locator("h1").first()).toBeVisible();

		// Confirm the guard installed (instrumentation-client runs before hydration).
		const guarded = await page.evaluate(
			() =>
				Boolean(
					(document as Document & { __orkViewTransitionGuard?: boolean })
						.__orkViewTransitionGuard,
				),
		);
		expect(guarded).toBe(true);

		const evaluateAborts = await page.evaluate(async () => {
			const start = document.startViewTransition?.bind(document);
			if (!start) return [] as string[];

			const seen: string[] = [];
			const onReject = (event: PromiseRejectionEvent) => {
				const reason = event.reason;
				const message =
					reason instanceof Error ? reason.message : String(reason);
				if (/Transition was (?:aborted|skipped)/i.test(message)) {
					seen.push(message);
				}
			};
			window.addEventListener("unhandledrejection", onReject);

			const sleep = (ms: number) =>
				new Promise<void>((r) => setTimeout(r, ms));

			start(() => sleep(200));
			start(() => sleep(50));

			start(() => sleep(300));
			window.dispatchEvent(new Event("resize"));

			start(() => sleep(300));
			const visibilityDesc = Object.getOwnPropertyDescriptor(
				Document.prototype,
				"visibilityState",
			);
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				get: () => "hidden",
			});
			document.dispatchEvent(new Event("visibilitychange"));
			await sleep(50);
			if (visibilityDesc) {
				Object.defineProperty(document, "visibilityState", visibilityDesc);
			} else {
				Reflect.deleteProperty(
					document as Document & { visibilityState?: string },
					"visibilityState",
				);
			}
			document.dispatchEvent(new Event("visibilitychange"));

			await sleep(500);
			window.removeEventListener("unhandledrejection", onReject);
			return seen;
		});

		expect(evaluateAborts, `evaluate aborts: ${evaluateAborts.join(" | ")}`).toEqual(
			[],
		);

		// Same-route catalog swap (SameRouteFade / ViewTransition) plus resize.
		const agentsTab = page.getByRole("tab", { name: /Agents/ });
		if (await agentsTab.isVisible().catch(() => false)) {
			await agentsTab.click();
			await expect(agentsTab).toHaveAttribute("aria-selected", "true");
		}

		await page.setViewportSize({ width: 390, height: 844 });
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.waitForTimeout(400);

		const pageAborts = await page.evaluate(
			() =>
				(window as unknown as { __orkVtAborts?: string[] }).__orkVtAborts ?? [],
		);
		aborts.push(...pageAborts.map((m) => `unhandledrejection:${m}`));

		expect(aborts, `unexpected VT aborts: ${aborts.join(" | ")}`).toEqual([]);
	});
});
