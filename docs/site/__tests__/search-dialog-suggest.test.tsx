// Renders the REAL ⌘K dialog and asserts the two things about the Jev
// suggestion re-rank that only a render can prove: it fires on a typing PAUSE
// rather than per keystroke, and nothing on screen waits for it.
//
// The pure policy (which order wins, and when a late answer is discarded)
// lives in lib/suggest-rerank-client and is covered by
// __tests__/suggest-rerank-client.test.ts. This file covers the wiring.
//
// Prod measurement 2026-09-21: the old build called on every 200 ms debounce
// and discarded all 72 calls, because raw Jev p50 is 760.5 ms.

import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUGGEST_PAUSE_MS } from "@/lib/suggest-rerank-client";

// The dialog drives its own input through fumadocs' hook, so the mock holds
// real React state and the test types by calling setSearch.
let setSearchImpl: (v: string) => void = () => {};
vi.mock("fumadocs-core/search/client", () => ({
	useDocsSearch: () => {
		const [search, setSearch] = React.useState("");
		setSearchImpl = setSearch;
		// `data: undefined` is fumadocs' "no search has run" state. An empty
		// ARRAY would instead be a zero-result set, which fires the analytics
		// beacon on a timer and leaks a real fetch past the test.
		return { search, setSearch, query: { data: undefined, isLoading: false } };
	},
}));

/**
 * Renders the dialog with the build-time flag set to `flag`. The component
 * reads process.env.ORK_SITE_JEV_SUGGEST at module scope so Next can inline
 * it, so the stub has to be in place before the import, which means a module
 * registry reset. FrameworkProvider must come from the SAME post-reset
 * registry or the dialog reads a different React context and throws.
 */
async function renderDialog(flag: string) {
	vi.resetModules();
	vi.stubEnv("ORK_SITE_JEV_SUGGEST", flag);
	const Dialog = (await import("@/components/search-dialog")).default;
	const { FrameworkProvider } = await import("fumadocs-core/framework");
	return render(
		<FrameworkProvider
			usePathname={() => "/docs"}
			useParams={() => ({})}
			useRouter={() => ({ push: () => {}, refresh: () => {} })}
			Link={({ prefetch: _prefetch, ...props }) => <a {...props} />}
		>
			<Dialog open onOpenChange={() => {}} />
		</FrameworkProvider>,
	);
}

/** Lets the lazily imported suggest index and any settled fetch land. */
async function flush() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	fetchSpy = vi.fn(async () => ({
		ok: true,
		json: async () => ({ items: [], estCostUsd: 0.0001, fellBack: true }),
	}));
	vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("search dialog suggestion re-rank", () => {
	it("shows deterministic suggestions before any request goes out", async () => {
		await renderDialog("1");

		await act(async () => setSearchImpl("mcp"));
		await flush();

		// Rendered from the local index, with the network untouched.
		expect(await screen.findByText("Suggestions")).toBeTruthy();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("does not call while the user is still typing", async () => {
		await renderDialog("1");

		// Three keystrokes inside one pause window, spaced like real typing.
		// The 300 ms gap is a literal on purpose: it is longer than the old
		// 200 ms keystroke debounce, so reverting to that would fire here.
		for (const q of ["mc", "mcp", "mcp s"]) {
			await act(async () => setSearchImpl(q));
			await flush();
			await act(async () => {
				vi.advanceTimersByTime(300);
			});
		}
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("calls exactly once after the typing pause, for the final query", async () => {
		await renderDialog("1");

		for (const q of ["mc", "mcp", "mcp s"]) {
			await act(async () => setSearchImpl(q));
			await flush();
			await act(async () => {
				vi.advanceTimersByTime(300);
			});
		}
		await act(async () => {
			vi.advanceTimersByTime(SUGGEST_PAUSE_MS);
		});
		await flush();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const url = String(fetchSpy.mock.calls[0][0]);
		expect(url).toContain(`query=${encodeURIComponent("mcp s")}`);
		// The browser cache must not replay a body whose cost accounting
		// describes a call that did not happen.
		expect(fetchSpy.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
	});

	it("makes no request at all when the flag is off at build time", async () => {
		await renderDialog("");

		await act(async () => setSearchImpl("mcp"));
		await flush();
		await act(async () => {
			vi.advanceTimersByTime(SUGGEST_PAUSE_MS * 4);
		});
		await flush();

		expect(await screen.findByText("Suggestions")).toBeTruthy();
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
