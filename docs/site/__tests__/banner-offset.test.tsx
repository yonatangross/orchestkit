import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { BannerOffset } from "@/components/banner-offset";

// rAF runs synchronously so a scroll re-measures inside the same act().
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
	cb(0);
	return 1;
});

function banner(bottom: number) {
	const el = document.createElement("div");
	el.id = "v1";
	el.getBoundingClientRect = () => ({ bottom }) as DOMRect;
	document.body.appendChild(el);
	return el;
}

const offset = () => document.documentElement.style.getPropertyValue("--fd-banner-height");

afterEach(() => {
	document.body.replaceChildren();
	document.documentElement.style.removeProperty("--fd-banner-height");
});

describe("BannerOffset", () => {
	it("sets --fd-banner-height to the banner's visible height", () => {
		banner(48);
		render(<BannerOffset bannerId="v1" />);
		expect(offset()).toBe("48px");
	});

	it("shrinks to 0 once the banner scrolls away", () => {
		const el = banner(48);
		render(<BannerOffset bannerId="v1" />);
		el.getBoundingClientRect = () => ({ bottom: -20 }) as DOMRect;
		act(() => {
			window.dispatchEvent(new Event("scroll"));
		});
		expect(offset()).toBe("0px");
	});

	it("drops to 0 when the banner leaves the DOM, with no scroll (returning visitor)", async () => {
		// fumadocs removes a dismissed banner after hydration, after the first
		// measurement; the offset stayed at the banner height until a scroll.
		banner(48);
		render(<BannerOffset bannerId="v1" />);
		expect(offset()).toBe("48px");
		document.getElementById("v1")?.remove();
		await act(async () => {
			await Promise.resolve(); // MutationObserver callbacks run as microtasks
		});
		expect(offset()).toBe("0px");
	});

	it("reads 0 when the banner was closed, and cleans up on unmount", () => {
		const view = render(<BannerOffset bannerId="missing" />);
		expect(offset()).toBe("0px");
		view.unmount();
		expect(offset()).toBe("");
	});
});
