import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HostInstallPicker } from "@/components/host-install";
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

describe("HostInstallPicker", () => {
	beforeEach(() => {
		search = new URLSearchParams();
		replace.mockClear();
		vi.mocked(track).mockClear();
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
