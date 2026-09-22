/**
 * Guard document.startViewTransition so React <ViewTransition> (and any
 * other caller) does not leak benign abort rejections into PostHog.
 *
 * Chromium rejects ViewTransition.ready with AbortError/InvalidStateError when
 * a transition is skipped for viewport resize, document hidden, or another
 * transition starting. React's customizeViewTransitionError only nulls a few
 * exact messages and misses the suffixed Chromium forms PostHog records.
 *
 * We:
 *   1. Serialize starts: skip an in-flight transition before starting the next
 *   2. Proactively skipTransition on visibilitychange (hidden) and resize
 *   3. preventDefault on unhandledrejection only for the VT abort class
 *      (never a blanket catch of unrelated errors)
 */

type StartViewTransition = Document["startViewTransition"];

const VT_ABORT_MESSAGE =
	/Transition was (?:aborted|skipped)|Skipping view transition|View transition was skipped|viewport size changed|document (?:visibility state )?(?:being )?hidden|visibility state (?:has become |is )?hidden/i;

/** True for the View Transitions abort class Chromium (and React wrappers) surface. */
export function isBenignViewTransitionAbort(error: unknown): boolean {
	const candidates: unknown[] = [error];
	if (error instanceof Error && error.cause != null) {
		candidates.push(error.cause);
	}

	for (const candidate of candidates) {
		if (candidate instanceof DOMException) {
			if (
				candidate.name !== "InvalidStateError" &&
				candidate.name !== "AbortError"
			) {
				continue;
			}
			if (VT_ABORT_MESSAGE.test(candidate.message)) return true;
			continue;
		}
		if (candidate instanceof Error) {
			// React wraps AbortError as "A ViewTransition was aborted early…"
			if (/ViewTransition was aborted early/i.test(candidate.message)) {
				return true;
			}
			if (
				(candidate.name === "InvalidStateError" ||
					candidate.name === "AbortError") &&
				VT_ABORT_MESSAGE.test(candidate.message)
			) {
				return true;
			}
		}
	}
	return false;
}

function swallowBenignReady(transition: ViewTransition): void {
	// Handle .ready so the abort never becomes unhandledrejection (PostHog
	// capture_exceptions listens for that). Non-benign errors are re-rejected
	// on the catch chain so they still surface.
	void transition.ready.catch((error: unknown) => {
		if (isBenignViewTransitionAbort(error)) return;
		return Promise.reject(error);
	});
}

function safeSkip(transition: ViewTransition | null): void {
	if (!transition) return;
	try {
		transition.skipTransition();
	} catch {
		// Already finished or already skipped.
	}
}

/**
 * Patch document.startViewTransition and attach resize/visibility skip hooks.
 * Idempotent. Returns an uninstall function for tests.
 */
export function installViewTransitionGuard(
	doc: Document = document,
): () => void {
	const start = doc.startViewTransition;
	if (typeof start !== "function") {
		return () => {};
	}

	const flagged = doc as Document & {
		__orkViewTransitionGuard?: boolean;
	};
	if (flagged.__orkViewTransitionGuard) {
		return () => {};
	}
	flagged.__orkViewTransitionGuard = true;

	const original = start.bind(doc) as StartViewTransition;
	let active: ViewTransition | null = null;
	const win = doc.defaultView;

	const clearIf = (transition: ViewTransition) => {
		if (active === transition) active = null;
	};

	doc.startViewTransition = ((
		...args: Parameters<StartViewTransition>
	): ViewTransition => {
		if (active) {
			safeSkip(active);
			active = null;
		}

		let transition: ViewTransition;
		try {
			transition = original(...args);
		} catch (error) {
			// Sync throw of the same abort class (rare; older engines).
			if (isBenignViewTransitionAbort(error)) {
				const callback = args[0];
				if (typeof callback === "function") {
					void callback();
				} else if (
					callback &&
					typeof callback === "object" &&
					"update" in callback &&
					typeof (callback as { update?: unknown }).update === "function"
				) {
					void (callback as { update: () => void }).update();
				}
				const stub = {
					finished: Promise.resolve(),
					ready: Promise.resolve(),
					updateCallbackDone: Promise.resolve(),
					skipTransition() {},
					types: new Set<string>(),
				} as unknown as ViewTransition;
				return stub;
			}
			throw error;
		}

		active = transition;
		swallowBenignReady(transition);
		void transition.finished.finally(() => clearIf(transition));
		return transition;
	}) as StartViewTransition;

	const onVisibility = () => {
		if (doc.visibilityState !== "hidden") return;
		safeSkip(active);
	};

	const onResize = () => {
		safeSkip(active);
	};

	const onUnhandledRejection = (event: PromiseRejectionEvent) => {
		if (!isBenignViewTransitionAbort(event.reason)) return;
		event.preventDefault();
	};

	doc.addEventListener("visibilitychange", onVisibility);
	win?.addEventListener("resize", onResize);
	win?.addEventListener("unhandledrejection", onUnhandledRejection);

	return () => {
		doc.startViewTransition = original;
		doc.removeEventListener("visibilitychange", onVisibility);
		win?.removeEventListener("resize", onResize);
		win?.removeEventListener("unhandledrejection", onUnhandledRejection);
		active = null;
		delete flagged.__orkViewTransitionGuard;
	};
}
