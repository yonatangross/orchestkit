import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityRoomThread } from "@/components/community-room-thread";

/** Times on the live frame, not the invisible final-frame sizer. */
function times(container: HTMLElement): string[] {
	const live = container.querySelector("[data-room-live]");
	return [...(live?.textContent ?? "").matchAll(/\d\d:\d\d/g)].map((m) => m[0]);
}

describe("CommunityRoomThread", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("with motion, replays the day once and stops on its last messages", () => {
		// Looping showed 16:11 and then 09:12 with no new day between them (dogfood ISSUE-003).
		vi.useFakeTimers();
		vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
		vi.stubGlobal("IntersectionObserver", undefined);
		const { container } = render(<CommunityRoomThread botLine="What's new in ork 1.0: a line" />);

		expect(times(container)).toEqual(["09:12", "09:14", "09:15", "09:18"]);
		expect(container.textContent).toContain("Today");
		// Every frame renders invisibly in the live frame's grid cell, so the box
		// holds the tallest frame's height and the page below never moves
		// (gate 2026-09-25: the opening frame is about 31px taller than the last).
		const sizers = [...container.querySelectorAll<HTMLElement>("[data-room-sizer]")];
		expect(sizers).toHaveLength(6);
		const live = container.querySelector("[data-room-live]");
		for (const sizer of sizers) {
			expect(sizer.className.split(" ")).toContain("invisible");
			expect(sizer.parentElement).toBe(live?.parentElement);
		}
		expect(sizers[0].textContent).toContain("09:12");
		expect(sizers[5].textContent).toContain("16:11");

		const seen = new Set<string>();
		for (let i = 0; i < 40; i++) {
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			const now = times(container);
			expect(now).toEqual([...now].sort());
			expect(container.textContent).toContain("Today");
			seen.add(now.join(","));
		}

		expect(times(container)).toEqual(["11:43", "11:44", "16:08", "16:11"]);
		expect(container.textContent).toContain("What's new in ork 1.0");
		// The opening frame, then one new message per frame to 16:11: six frames.
		expect(seen.size).toBe(6);
	});

	it("with reduced motion, holds the last messages, bot line included", () => {
		vi.useFakeTimers();
		vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query }));
		const { container } = render(<CommunityRoomThread botLine="What's new in ork 1.0: a line" />);
		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expect(times(container)).toEqual(["11:43", "11:44", "16:08", "16:11"]);
		expect(container.textContent).toContain("What's new in ork 1.0");
		expect(container.textContent).toContain("Today");
	});
});
