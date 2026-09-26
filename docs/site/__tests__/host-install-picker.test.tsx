import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HostInstallGrid, HostInstallPicker } from "@/components/host-install";
import { SITE } from "@/lib/constants";
import { HOST_INSTALLS } from "@/lib/host-installs";
import { track } from "@/lib/search-beacon";

vi.mock("next/link", () => ({
	default: ({
		children,
		href,
		...props
	}: {
		children: React.ReactNode;
		href: string;
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace, push: vi.fn() }),
	useSearchParams: () => search,
}));

vi.mock("@/lib/search-beacon", () => ({
	track: vi.fn(),
}));

Object.defineProperty(navigator, "clipboard", {
	configurable: true,
	value: { writeText: vi.fn().mockResolvedValue(undefined) },
});

// GH-4155: the card entrance starts real WAAPI animations under happy-dom
// once the component mounts, and the unmount cancel rejects their finished
// promises with AbortError after the test has moved on. Report reduced
// motion so the entrance never starts. The stub has to be installed before
// the first render of the file: motion initializes a module-global ref from
// matchMedia on the first useReducedMotion() call and never re-reads it.
// The reduced-motion test below keeps its own explicit stub.
function reducedMotionMatchMedia(query: string) {
	return {
		matches: query.includes("reduce"),
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	} as unknown as MediaQueryList;
}

describe("HostInstallPicker", () => {
	beforeEach(() => {
		search = new URLSearchParams();
		replace.mockClear();
		vi.mocked(track).mockClear();
		vi
			.spyOn(window, "matchMedia")
			.mockImplementation(reducedMotionMatchMedia);
	});

	it("lists hosts in the same order as the Installation grid", () => {
		// Gate 2026-09-25: the home chips and /docs/getting-started/installation
		// disagreed (Devin 4th vs 7th). Both now read HOST_INSTALLS.
		const names = HOST_INSTALLS.map((spec) => spec.name);
		const { unmount } = render(<HostInstallPicker />);
		const chips = names.map((name) => screen.getByRole("link", { name }));
		for (let i = 1; i < chips.length; i++) {
			expect(
				chips[i - 1].compareDocumentPosition(chips[i]) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
		}
		unmount();
		const { container } = render(<HostInstallGrid />);
		const cards = Array.from(container.querySelectorAll("article")).map(
			(card) => card.querySelector("p")?.textContent,
		);
		expect(cards).toEqual(names);
	});

	it("Cursor is a host query link, not a dead button", () => {
		render(<HostInstallPicker />);
		expect(
			screen.getByRole("link", { name: "Cursor" }).querySelector("svg"),
		).toBeTruthy();
	});

	it("defaults to Claude Code with no query string (the prerendered state)", () => {
		render(<HostInstallPicker />);
		expect(
			screen.getByRole("link", { name: "Claude Code" }).getAttribute("aria-current"),
		).toBe("true");
	});

	it("replaces the URL without a full navigation when a host is clicked", async () => {
		render(<HostInstallPicker />);
		fireEvent.click(screen.getByRole("link", { name: "Cursor" }));
		expect(replace).toHaveBeenCalledWith("/?host=cursor", {
			scroll: false,
			transitionTypes: ["catalog"],
		});
		expect(
			await screen.findByRole("button", {
				name: /copy yonatangross\/orchestkit to clipboard/i,
			}),
		).toBeTruthy();
	});

	it("records host_selected with the picked host", () => {
		render(<HostInstallPicker />);
		fireEvent.click(screen.getByRole("link", { name: "Codex" }));
		expect(track).toHaveBeenCalledWith("host_selected", { host: "codex" });
	});

	it("records host_selected for a modified click without hijacking it", () => {
		render(<HostInstallPicker />);
		fireEvent.click(screen.getByRole("link", { name: "Pi" }), { metaKey: true });
		expect(track).toHaveBeenCalledWith("host_selected", { host: "pi" });
		expect(replace).not.toHaveBeenCalled();
	});

	it("adopts a ?host=cursor deep link from the URL", async () => {
		search = new URLSearchParams("host=cursor");
		render(<HostInstallPicker />);
		expect(
			await screen.findByRole("button", {
				name: /copy yonatangross\/orchestkit to clipboard/i,
			}),
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Cursor docs/i }).getAttribute("href"),
		).toBe("/docs/getting-started/cursor");
		await waitFor(() =>
			expect(
				screen.getByRole("link", { name: "Cursor" }).getAttribute("aria-current"),
			).toBe("true"),
		);
		// A deep link is not a selection: only clicks are counted.
		expect(track).not.toHaveBeenCalledWith("host_selected", expect.anything());
	});

	it("keeps the catalog tab from the URL when a host is picked", () => {
		search = new URLSearchParams("lib=hooks");
		render(<HostInstallPicker />);
		fireEvent.click(screen.getByRole("link", { name: "Cursor" }));
		expect(replace).toHaveBeenCalledWith("/?host=cursor&lib=hooks", {
			scroll: false,
			transitionTypes: ["catalog"],
		});
	});

	it("renders eight host links including Devin and Antigravity", () => {
		render(<HostInstallPicker />);
		const nav = screen.getByRole("navigation", { name: /install by host/i });
		expect(within(nav).getByRole("link", { name: "Devin" })).toBeTruthy();
		expect(
			within(nav).getByRole("link", { name: "Antigravity" }),
		).toBeTruthy();
		expect(
			within(nav).getAllByRole("link", { name: /docs/i }).length,
		).toBeGreaterThanOrEqual(1);
	});

	it("adopts a ?host=devin deep link and shows its install command", async () => {
		search = new URLSearchParams("host=devin");
		render(<HostInstallPicker />);
		expect(
			await screen.findByRole("button", {
				name: /copy devin plugins install https:\/\/github\.com\/yonatangross\/orchestkit/i,
			}),
		).toBeTruthy();
		await waitFor(() =>
			expect(
				screen.getByRole("link", { name: "Devin" }).getAttribute("aria-current"),
			).toBe("true"),
		);
	});

	it("adopts a ?host=agy deep link and shows its install command", async () => {
		search = new URLSearchParams("host=agy");
		render(<HostInstallPicker />);
		expect(
			await screen.findByRole("button", {
				name: /copy npx skills add yonatangross\/orchestkit/i,
			}),
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Antigravity docs/i }).getAttribute(
				"href",
			),
		).toBe("/docs/getting-started/agy");
		await waitFor(() =>
			expect(
				screen
					.getByRole("link", { name: "Antigravity" })
					.getAttribute("aria-current"),
			).toBe("true"),
		);
	});

	it("moves focus between cards with arrow keys", () => {
		render(<HostInstallPicker />);
		const claude = screen.getByRole("link", { name: "Claude Code" });
		claude.focus();
		fireEvent.keyDown(claude, { key: "ArrowRight" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Cursor" }),
		);
		fireEvent.keyDown(document.activeElement as Element, { key: "End" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Antigravity" }),
		);
		fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Claude Code" }),
		);
	});

	it("wraps ArrowLeft from the first card to the last", () => {
		render(<HostInstallPicker />);
		const claude = screen.getByRole("link", { name: "Claude Code" });
		claude.focus();
		fireEvent.keyDown(claude, { key: "ArrowLeft" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Antigravity" }),
		);
	});

	it("moves by grid columns on ArrowDown/ArrowUp and stays put at the edge", () => {
		const realGetComputedStyle = window.getComputedStyle.bind(window);
		vi.spyOn(window, "getComputedStyle").mockImplementation(
			(el: Element, pseudo?: string | null) => {
				if (
					el instanceof HTMLElement &&
					el.getAttribute("aria-label") === "Hosts"
				) {
					return {
						...realGetComputedStyle(el, pseudo),
						gridTemplateColumns: "1fr 1fr 1fr 1fr",
					} as CSSStyleDeclaration;
				}
				return realGetComputedStyle(el, pseudo);
			},
		);
		render(<HostInstallPicker />);
		const claude = screen.getByRole("link", { name: "Claude Code" });
		claude.focus();
		// Chip order follows demand (PostHog 2026-09-25): Claude, Cursor, Codex,
		// Devin | OpenCode, Muse Code, Pi, Antigravity.
		fireEvent.keyDown(claude, { key: "ArrowDown" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "OpenCode" }),
		);
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Antigravity" }),
		);
		// No cell below the last card: focus must not move (APG grid).
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Antigravity" }),
		);
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Devin" }),
		);
		fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
		fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "Claude Code" }),
		);
		vi.restoreAllMocks();
	});

	it("does not intercept Enter and activates the focused card on Space", () => {
		render(<HostInstallPicker />);
		const cursor = screen.getByRole("link", { name: "Cursor" });
		cursor.focus();
		// Enter is left to the anchor's native activation.
		expect(fireEvent.keyDown(cursor, { key: "Enter" })).toBe(true);
		expect(track).not.toHaveBeenCalled();
		// Space does not activate an anchor natively, so the grid does it.
		fireEvent.keyDown(cursor, { key: " " });
		expect(track).toHaveBeenCalledWith("host_selected", { host: "cursor" });
		expect(replace).toHaveBeenCalledWith("/?host=cursor", {
			scroll: false,
			transitionTypes: ["catalog"],
		});
	});

	it("makes every host chip its own tab stop, deep link or not", async () => {
		// Was a roving tabindex: Tab reached one chip and jumped to Copy, and
		// nothing announced that arrows reach the other 7 hosts (QA #21).
		search = new URLSearchParams("host=devin");
		render(<HostInstallPicker />);
		await waitFor(() =>
			expect(
				screen.getByRole("link", { name: "Devin" }).getAttribute("aria-current"),
			).toBe("true"),
		);
		const group = screen.getByRole("group", { name: "Hosts" });
		const chips = within(group).getAllByRole("link");
		expect(chips).toHaveLength(8);
		for (const chip of chips) {
			expect(chip.getAttribute("tabindex")).not.toBe("-1");
			expect(chip.tabIndex).toBe(0);
		}
	});

	it("never prerenders cards at opacity 0 under reduced motion", () => {
		vi.spyOn(window, "matchMedia").mockImplementation(
			(query: string) =>
				({
					matches: query.includes("reduce"),
					media: query,
					onchange: null,
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					addListener: vi.fn(),
					removeListener: vi.fn(),
					dispatchEvent: vi.fn(),
				}) as unknown as MediaQueryList,
		);
		render(<HostInstallPicker />);
		for (const name of [
			"Claude Code",
			"Cursor",
			"Codex",
			"Muse Code",
			"Pi",
			"OpenCode",
			"Devin",
			"Antigravity",
		]) {
			expect(
				screen.getByRole("link", { name }).style.opacity,
			).not.toBe("0");
		}
		vi.restoreAllMocks();
	});

	it("shows Claude Code's command one line per command and copies the one-liner", () => {
		render(<HostInstallPicker />);
		const box = document.querySelector("[data-hero-install]") as HTMLElement;
		expect(box).toBeTruthy();
		// Labelled with the host, so a Cursor reader never mistakes it for theirs.
		expect(within(box).getByText("Claude Code")).toBeTruthy();
		// Two display lines, not one wrapped line with the $ in the middle.
		expect(box.textContent).toContain("claude plugin marketplace add yonatangross/orchestkit");
		expect(box.textContent).toContain("claude plugin install ork@orchestkit");
		const copy = within(box).getByRole("button", {
			name: new RegExp(`copy ${SITE.installCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
		});
		fireEvent.click(copy);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SITE.installCommand);
		expect(track).toHaveBeenCalledWith("install_copied", { host: "claude", surface: "hero" });
		expect(
			screen.getByRole("button", { name: /^copy \/ork:setup to clipboard$/i }),
		).toBeTruthy();
	});

	it("labels the command box with the picked host and tags its copy", async () => {
		search = new URLSearchParams("host=cursor");
		render(<HostInstallPicker />);
		const copy = await screen.findByRole("button", {
			name: /copy yonatangross\/orchestkit to clipboard/i,
		});
		const box = document.querySelector("[data-hero-install]") as HTMLElement;
		expect(within(box).getByText("Cursor")).toBeTruthy();
		fireEvent.click(copy);
		expect(track).toHaveBeenCalledWith("install_copied", { host: "cursor", surface: "hero" });
	});

	it("fires install_viewed once, with the host and why it is shown", async () => {
		const observers: { cb: IntersectionObserverCallback }[] = [];
		const RealIO = globalThis.IntersectionObserver;
		globalThis.IntersectionObserver = class {
			constructor(cb: IntersectionObserverCallback) {
				observers.push({ cb });
			}
			observe() {}
			disconnect() {}
			unobserve() {}
			takeRecords() {
				return [];
			}
		} as unknown as typeof IntersectionObserver;
		try {
			search = new URLSearchParams("host=devin");
			render(<HostInstallPicker />);
			await waitFor(() =>
				expect(
					screen.getByRole("link", { name: "Devin" }).getAttribute("aria-current"),
				).toBe("true"),
			);
			const seen = [{ isIntersecting: true }] as unknown as IntersectionObserverEntry[];
			for (const o of observers) o.cb(seen, {} as IntersectionObserver);
			for (const o of observers) o.cb(seen, {} as IntersectionObserver);
			const calls = vi.mocked(track).mock.calls.filter(([name]) => name === "install_viewed");
			expect(calls).toEqual([
				["install_viewed", { host: "devin", source: "deeplink", surface: "hero" }],
			]);
		} finally {
			globalThis.IntersectionObserver = RealIO;
		}
	});

	it("observes the box that is on screen, not the one a host change replaced", async () => {
		// The box remounts on every host change; an observer attached once on
		// mount kept watching the detached first box (review, 2026-09-25).
		const observers: { cb: IntersectionObserverCallback; el: Element | null }[] = [];
		const RealIO = globalThis.IntersectionObserver;
		globalThis.IntersectionObserver = class {
			private entry: { cb: IntersectionObserverCallback; el: Element | null };
			constructor(cb: IntersectionObserverCallback) {
				this.entry = { cb, el: null };
				observers.push(this.entry);
			}
			observe(el: Element) {
				this.entry.el = el;
			}
			disconnect() {}
			unobserve() {}
			takeRecords() {
				return [];
			}
		} as unknown as typeof IntersectionObserver;
		try {
			search = new URLSearchParams("host=codex");
			render(<HostInstallPicker />);
			await waitFor(() =>
				expect(screen.getByRole("link", { name: "Codex" }).getAttribute("aria-current")).toBe("true"),
			);
			const onScreen = document.querySelector("[data-hero-install]");
			const seen = [{ isIntersecting: true }] as unknown as IntersectionObserverEntry[];
			// Only an observer watching the box that is actually in the page can see it.
			for (const o of observers) if (o.el && o.el === onScreen && o.el.isConnected) o.cb(seen, {} as IntersectionObserver);
			const calls = vi.mocked(track).mock.calls.filter(([name]) => name === "install_viewed");
			expect(calls).toEqual([["install_viewed", { host: "codex", source: "deeplink", surface: "hero" }]]);
		} finally {
			globalThis.IntersectionObserver = RealIO;
		}
	});

	it("does not carry Copied over to the next host", async () => {
		render(<HostInstallPicker />);
		fireEvent.click(await screen.findByRole("button", { name: /^copy claude plugin marketplace add/i }));
		await screen.findByRole("button", { name: /^copied /i });
		fireEvent.click(screen.getByRole("link", { name: "Cursor" }));
		const next = await screen.findByRole("button", { name: /copy yonatangross\/orchestkit to clipboard/i });
		expect(next.textContent).toContain("Copy");
		expect(next.textContent).not.toContain("Copied");
	});

	it("copies two Codex lines as one clipboard payload", async () => {
		search = new URLSearchParams("host=codex");
		render(<HostInstallPicker />);
		const copy = await screen.findByRole("button", {
			name: /ork-codex@orchestkit-codex/i,
		});
		fireEvent.click(copy);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("codex plugin add ork-codex@orchestkit-codex"),
		);
	});
});
