import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("view-transition-guard", () => {
	let startViewTransitionDesc: PropertyDescriptor | undefined;
	let visibilityStateDesc: PropertyDescriptor | undefined;

	beforeEach(() => {
		startViewTransitionDesc = Object.getOwnPropertyDescriptor(
			document,
			"startViewTransition",
		);
		visibilityStateDesc = Object.getOwnPropertyDescriptor(
			document,
			"visibilityState",
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		if (startViewTransitionDesc) {
			Object.defineProperty(
				document,
				"startViewTransition",
				startViewTransitionDesc,
			);
		} else {
			Reflect.deleteProperty(
				document as Document & { startViewTransition?: unknown },
				"startViewTransition",
			);
		}
		if (visibilityStateDesc) {
			Object.defineProperty(document, "visibilityState", visibilityStateDesc);
		} else {
			Reflect.deleteProperty(
				document as Document & { visibilityState?: string },
				"visibilityState",
			);
		}
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

	it("emits exactly one unhandledrejection when ready rejects non-benign (finished handled once)", async () => {
		const { installViewTransitionGuard } = await import(
			"@/lib/view-transition-guard"
		);

		const failure = new Error("update callback failed");
		let rejectFinished!: (reason: unknown) => void;
		let rejectReady!: (reason: unknown) => void;
		const finished = new Promise<void>((_resolve, reject) => {
			rejectFinished = reject;
		});
		const ready = new Promise<void>((_resolve, reject) => {
			rejectReady = reject;
		});

		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			writable: true,
			value: () =>
				({
					finished,
					ready,
					// Keep updateCallbackDone fulfilled so this test isolates
					// finished/ready handling (the finally() duplicate class).
					updateCallbackDone: Promise.resolve(),
					skipTransition() {},
					types: new Set<string>(),
				}) as unknown as ViewTransition,
		});

		const reasons: unknown[] = [];
		const onWindowReject = (event: Event) => {
			const rejection = event as Event & { reason?: unknown };
			reasons.push(rejection.reason);
			if (typeof rejection.preventDefault === "function") {
				rejection.preventDefault();
			}
		};
		const onProcessReject = (reason: unknown) => {
			reasons.push(reason);
		};
		window.addEventListener("unhandledrejection", onWindowReject);
		process.on("unhandledRejection", onProcessReject);

		const uninstall = installViewTransitionGuard(document);
		document.startViewTransition(() => {});

		// Reject after the guard has attached .then / .catch handlers.
		rejectFinished(failure);
		rejectReady(failure);

		await vi.waitFor(() => {
			expect(reasons.length).toBeGreaterThanOrEqual(1);
		});
		// Drain turns so a duplicate from finished.finally() would appear.
		await Promise.resolve();
		await Promise.resolve();
		await new Promise((r) => setTimeout(r, 0));

		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toBe(failure);

		uninstall();
		window.removeEventListener("unhandledrejection", onWindowReject);
		process.off("unhandledRejection", onProcessReject);
	});

	it("emits no unhandledrejection for a benign finished/ready abort", async () => {
		const { installViewTransitionGuard } = await import(
			"@/lib/view-transition-guard"
		);

		const abort = new DOMException(
			"Transition was skipped. skipTransition() called",
			"AbortError",
		);
		let rejectFinished!: (reason: unknown) => void;
		let rejectReady!: (reason: unknown) => void;
		const finished = new Promise<void>((_resolve, reject) => {
			rejectFinished = reject;
		});
		const ready = new Promise<void>((_resolve, reject) => {
			rejectReady = reject;
		});

		Object.defineProperty(document, "startViewTransition", {
			configurable: true,
			writable: true,
			value: () =>
				({
					finished,
					ready,
					updateCallbackDone: Promise.resolve(),
					skipTransition() {},
					types: new Set<string>(),
				}) as unknown as ViewTransition,
		});

		const reasons: unknown[] = [];
		const onWindowReject = (event: Event) => {
			const rejection = event as Event & { reason?: unknown };
			reasons.push(rejection.reason);
			if (typeof rejection.preventDefault === "function") {
				rejection.preventDefault();
			}
		};
		const onProcessReject = (reason: unknown) => {
			reasons.push(reason);
		};
		window.addEventListener("unhandledrejection", onWindowReject);
		process.on("unhandledRejection", onProcessReject);

		const uninstall = installViewTransitionGuard(document);
		document.startViewTransition(() => {});

		rejectFinished(abort);
		rejectReady(abort);

		await Promise.resolve();
		await Promise.resolve();
		await new Promise((r) => setTimeout(r, 0));

		expect(reasons).toHaveLength(0);

		uninstall();
		window.removeEventListener("unhandledrejection", onWindowReject);
		process.off("unhandledRejection", onProcessReject);
	});
});
