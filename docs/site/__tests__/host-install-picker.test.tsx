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

vi.mock("@/lib/search-beacon", () => ({
	track: vi.fn(),
}));

Object.defineProperty(navigator, "clipboard", {
	configurable: true,
	value: { writeText: vi.fn().mockResolvedValue(undefined) },
});

describe("HostInstallPicker", () => {
	it("switches the copy payload when picking Cursor", () => {
		render(<HostInstallPicker />);
		fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
		expect(
			screen.getByRole("button", {
				name: /copy yonatangross\/orchestkit to clipboard/i,
			}),
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Cursor docs/i }).getAttribute("href"),
		).toBe("/docs/getting-started/cursor");
	});

	it("copies two Codex lines as one clipboard payload", () => {
		render(<HostInstallPicker />);
		fireEvent.click(screen.getByRole("button", { name: "Codex" }));
		const copy = screen.getByRole("button", {
			name: /ork-codex@orchestkit-codex/i,
		});
		fireEvent.click(copy);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("codex plugin add ork-codex@orchestkit-codex"),
		);
	});
});
