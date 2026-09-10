import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HostInstallPicker } from "@/components/host-install";

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
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/search-beacon", () => ({
	track: vi.fn(),
}));

Object.defineProperty(navigator, "clipboard", {
	configurable: true,
	value: { writeText: vi.fn().mockResolvedValue(undefined) },
});

describe("HostInstallPicker", () => {
	it("Cursor is a host query link, not a dead button", () => {
		render(<HostInstallPicker />);
		expect(
			screen.getByRole("link", { name: "Cursor" }).querySelector("svg"),
		).toBeTruthy();
	});

	it("replaces the URL without a full navigation when a host is clicked", async () => {
		replace.mockClear();
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

	it("renders the Cursor copy payload when active is cursor", () => {
		render(<HostInstallPicker active="cursor" />);
		expect(
			screen.getByRole("button", {
				name: /copy yonatangross\/orchestkit to clipboard/i,
			}),
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Cursor docs/i }).getAttribute("href"),
		).toBe("/docs/getting-started/cursor");
		expect(
			screen.getByRole("link", { name: "Cursor" }).getAttribute("aria-current"),
		).toBe("true");
	});

	it("copies two Codex lines as one clipboard payload", () => {
		render(<HostInstallPicker active="codex" />);
		const copy = screen.getByRole("button", {
			name: /ork-codex@orchestkit-codex/i,
		});
		fireEvent.click(copy);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("codex plugin add ork-codex@orchestkit-codex"),
		);
	});
});
