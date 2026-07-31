// Renders the REAL ⌘K dialog and pins its two analytics behaviours:
//   1. search:performed fires ONCE per settled search, after the debounce,
//      not once per keystroke (fumadocs' own delay is 100ms).
//   2. search:result-clicked carries the ZERO-BASED position of the item AS
//      RENDERED, which is the property the ranking work is graded on.
//
// The beacon module is mocked; its wire format is pinned in search-beacon.test.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable so a test can drive the hook the way typing drives it in the browser.
const state = vi.hoisted(() => ({
	search: "",
	isLoading: false,
	data: null as unknown,
}));

vi.mock("fumadocs-core/search/client", () => ({
	useDocsSearch: () => ({
		search: state.search,
		setSearch: (v: string) => {
			state.search = v;
		},
		query: { data: state.data, isLoading: state.isLoading },
	}),
}));

const reportSearchPerformed = vi.fn();
const reportSearchResultClicked = vi.fn();
vi.mock("@/lib/search-beacon", () => ({
	reportZeroResultQuery: vi.fn(),
	reportSearchPerformed: (...args: unknown[]) => reportSearchPerformed(...args),
	reportSearchResultClicked: (...args: unknown[]) =>
		reportSearchResultClicked(...args),
}));

import { FrameworkProvider } from "fumadocs-core/framework";
import CustomSearchDialog from "@/components/search-dialog";

// Two page blocks, the first with one matched excerpt. The rendered flat list
// is therefore [page A, excerpt A, page B], so page B sits at index 2, NOT at
// index 1. That gap between "page rank" and "rendered position" is exactly what
// this test exists to pin.
const ROWS = [
	{
		id: "/docs/a",
		url: "https://orchestkit.yonyon.ai/docs/a",
		type: "page",
		content: "Alpha Page",
	},
	{
		id: "/docs/a-1",
		url: "https://orchestkit.yonyon.ai/docs/a#why",
		type: "text",
		content: "matched excerpt",
	},
	{
		id: "/docs/b",
		url: "https://orchestkit.yonyon.ai/docs/b",
		type: "page",
		content: "Bravo Page",
	},
];

// See search-dialog.test.tsx: the GENERIC provider with stub bindings, because
// NextProvider's useRouter throws under a test DOM.
function renderDialog() {
	return render(
		<FrameworkProvider
			usePathname={() => "/docs"}
			useParams={() => ({})}
			useRouter={() => ({ push: () => {}, refresh: () => {} })}
			Link={({ prefetch: _prefetch, ...props }) => <a {...props} />}
		>
			<CustomSearchDialog open onOpenChange={() => {}} />
		</FrameworkProvider>,
	);
}

describe("⌘K dialog analytics", () => {
	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.stubEnv("NODE_ENV", "production");
		reportSearchPerformed.mockReset();
		reportSearchResultClicked.mockReset();
		state.search = "alpha";
		state.isLoading = false;
		state.data = ROWS;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	it("reports one search:performed per settled query, after the debounce", async () => {
		renderDialog();
		await screen.findByText("Alpha Page");

		// Nothing yet: a mid-typing state must not reach the sink.
		expect(reportSearchPerformed).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1500);

		expect(reportSearchPerformed).toHaveBeenCalledTimes(1);
		expect(reportSearchPerformed).toHaveBeenCalledWith({
			query: "alpha",
			// Page BLOCKS, not rendered rows: 3 rows, 2 pages.
			resultCount: 2,
			tag: "all",
		});
	});

	it("does not fire per keystroke", async () => {
		const { rerender } = renderDialog();
		await screen.findByText("Alpha Page");

		// Each "keystroke" lands well inside the debounce window and cancels the
		// pending timer, exactly as fast typing does.
		for (const q of ["al", "alp", "alph"]) {
			state.search = q;
			vi.advanceTimersByTime(300);
			rerender(
				<FrameworkProvider
					usePathname={() => "/docs"}
					useParams={() => ({})}
					useRouter={() => ({ push: () => {}, refresh: () => {} })}
					Link={({ prefetch: _prefetch, ...props }) => <a {...props} />}
				>
					<CustomSearchDialog open onOpenChange={() => {}} />
				</FrameworkProvider>,
			);
		}
		expect(reportSearchPerformed).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1500);
		expect(reportSearchPerformed).toHaveBeenCalledTimes(1);
		expect(reportSearchPerformed.mock.calls[0][0]).toMatchObject({
			query: "alph",
		});
	});

	it("does not report while the query is still in flight", async () => {
		state.isLoading = true;
		state.data = null;
		renderDialog();

		vi.advanceTimersByTime(5000);
		expect(reportSearchPerformed).not.toHaveBeenCalled();
	});

	it("reports the ZERO-BASED rendered position of a clicked result", async () => {
		renderDialog();
		fireEvent.click(await screen.findByText("Bravo Page"));

		expect(reportSearchResultClicked).toHaveBeenCalledTimes(1);
		expect(reportSearchResultClicked).toHaveBeenCalledWith({
			query: "alpha",
			// Origin stripped: a path, never a full URL.
			url: "/docs/b",
			// [page A, excerpt A, page B]: index 2, not "the second page".
			position: 2,
			resultType: "page",
			tag: "all",
		});
	});

	it("reports position 0 for the top result", async () => {
		renderDialog();
		fireEvent.click(await screen.findByText("Alpha Page"));

		expect(reportSearchResultClicked.mock.calls[0][0]).toMatchObject({
			position: 0,
			url: "/docs/a",
			resultType: "page",
		});
	});
});
