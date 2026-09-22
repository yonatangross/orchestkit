import { afterEach, describe, expect, it, vi } from "vitest";

describe("view-transition-guard", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("isBenignViewTransitionAbort matches the VT abort class Chromium and React use", async () => {
		const { isBenignViewTransitionAbort } = await import(
			"@/lib/view-transition-guard"
		);

		expect(
			isBenignViewTransitionAbort(
				new DOMException(
					"Transition was aborted because of invalid state",
					"InvalidStateError",
				),
			),
		).toBe(true);

		expect(
			isBenignViewTransitionAbort(
				new DOMException(
					"Transition was aborted because of invalid state: Viewport size changed",
					"InvalidStateError",
				),
			),
		).toBe(true);

		expect(
			isBenignViewTransitionAbort(
				new DOMException(
					"Transition was aborted because of invalid state: due to document being hidden",
					"InvalidStateError",
				),
			),
		).toBe(true);

		expect(
			isBenignViewTransitionAbort(
				new DOMException(
					"Transition was skipped. skipTransition() called",
					"AbortError",
				),
			),
		).toBe(true);

		expect(
			isBenignViewTransitionAbort(
				new Error("A ViewTransition was aborted early.", {
					cause: new DOMException(
						"Transition was skipped. skipTransition() called",
						"AbortError",
					),
				}),
			),
		).toBe(true);

		expect(
			isBenignViewTransitionAbort(
				new DOMException("The document is busy", "InvalidStateError"),
			),
		).toBe(false);

		expect(isBenignViewTransitionAbort(new Error("boom"))).toBe(false);
	});

	it("skips an in-flight transition before starting the next", async () => {
		const { installViewTransitionGuard } = await import(
			"@/lib/view-transition-guard"
		);

		const skip = vi.fn();
		const original = vi.fn(
			() =>
				({
					finished: Promise.resolve(),
					ready: Promise.resolve(),
					updateCallbackDone: Promise.resolve(),
					skipTransition: skip,
					types: new Set<string>(),
				}) as unknown as ViewTransition,
		);

		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			writable: true,
			value: original,
		});

		const uninstall = installViewTransitionGuard(document);
		document.startViewTransition(() => {});
		document.startViewTransition(() => {});

		expect(skip).toHaveBeenCalledTimes(1);
		expect(original).toHaveBeenCalledTimes(2);

		uninstall();
	});

	it("calls skipTransition on resize and when the document hides", async () => {
		const { installViewTransitionGuard } = await import(
			"@/lib/view-transition-guard"
		);

		const skip = vi.fn();
		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			writable: true,
			value: () =>
				({
					finished: new Promise(() => {}),
					ready: new Promise(() => {}),
					updateCallbackDone: new Promise(() => {}),
					skipTransition: skip,
					types: new Set<string>(),
				}) as unknown as ViewTransition,
		});

		const uninstall = installViewTransitionGuard(document);
		document.startViewTransition(() => {});

		window.dispatchEvent(new Event("resize"));
		expect(skip).toHaveBeenCalledTimes(1);

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		document.dispatchEvent(new Event("visibilitychange"));
		expect(skip).toHaveBeenCalledTimes(2);

		uninstall();
	});

	it("preventDefault on unhandledrejection for benign VT aborts only", async () => {
		const { installViewTransitionGuard } = await import(
			"@/lib/view-transition-guard"
		);

		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			writable: true,
			value: () =>
				({
					finished: Promise.resolve(),
					ready: Promise.resolve(),
					updateCallbackDone: Promise.resolve(),
					skipTransition() {},
					types: new Set<string>(),
				}) as unknown as ViewTransition,
		});

		const uninstall = installViewTransitionGuard(document);

		const makeRejection = (reason: unknown) => {
			const event = new Event("unhandledrejection") as Event & {
				reason: unknown;
				preventDefault: ReturnType<typeof vi.fn>;
			};
			Object.defineProperty(event, "reason", { value: reason });
			event.preventDefault = vi.fn();
			return event;
		};

		const benign = makeRejection(
			new DOMException(
				"Transition was skipped. skipTransition() called",
				"AbortError",
			),
		);
		window.dispatchEvent(benign);
		expect(benign.preventDefault).toHaveBeenCalled();

		const other = makeRejection(new Error("real failure"));
		window.dispatchEvent(other);
		expect(other.preventDefault).not.toHaveBeenCalled();

		uninstall();
	});
});
