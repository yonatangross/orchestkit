// Guards the orank "content hidden without JS / for non-scrolling crawlers"
// recovery: AnimateOnView sets opacity:0 on mount and animates in on scroll, but
// it must NEVER leave content stuck at opacity:0 — it reveals immediately when
// already near the viewport, and a ~1200ms fallback reveals regardless of scroll.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AnimateOnView } from "@/components/animate-on-view";

// IntersectionObserver that never fires (simulates a client that never scrolls
// the element into view) so we exercise the immediate + fallback reveal paths.
class NoopIntersectionObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

function mockMatchMedia(reducedMotion: boolean) {
	vi.stubGlobal(
		"matchMedia",
		(query: string) => ({
			matches: reducedMotion && query.includes("reduce"),
			media: query,
			addEventListener() {},
			removeEventListener() {},
		}),
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("AnimateOnView reveal safety", () => {
	it("reveals immediately when already near the viewport at mount", () => {
		mockMatchMedia(false);
		// Default jsdom getBoundingClientRect returns all-zero → top(0) < vh+100,
		// bottom(0) > -100 → counts as near viewport.
		const { container } = render(
			<AnimateOnView>
				<p>below fold</p>
			</AnimateOnView>,
		);
		const el = container.firstElementChild as HTMLElement;
		// delay defaults to 0; flush the 0ms reveal timer.
		vi.advanceTimersByTime(0);
		expect(el.style.opacity).toBe("1");
		expect(el.style.transform).toBe("translateY(0)");
	});

	it("never leaves content hidden — fallback reveals without any scroll", () => {
		mockMatchMedia(false);
		// Force the element far below the viewport so the near-viewport check fails
		// and only the fallback timeout can reveal it.
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			top: 5000,
			bottom: 5200,
			left: 0,
			right: 0,
			width: 0,
			height: 200,
			x: 0,
			y: 5000,
			toJSON: () => ({}),
		} as DOMRect);

		const { container } = render(
			<AnimateOnView>
				<p>far below fold</p>
			</AnimateOnView>,
		);
		const el = container.firstElementChild as HTMLElement;
		// Hidden initially (observer never fires).
		expect(el.style.opacity).toBe("0");
		// After the fallback window, content is revealed regardless of scroll.
		vi.advanceTimersByTime(1200);
		expect(el.style.opacity).toBe("1");
		expect(el.style.transform).toBe("translateY(0)");
	});

	it("honors prefers-reduced-motion: reveals immediately, no transition", () => {
		mockMatchMedia(true);
		const { container } = render(
			<AnimateOnView>
				<p>reduced motion</p>
			</AnimateOnView>,
		);
		const el = container.firstElementChild as HTMLElement;
		expect(el.style.opacity).toBe("1");
		expect(el.style.transition).toBe("");
	});
});
