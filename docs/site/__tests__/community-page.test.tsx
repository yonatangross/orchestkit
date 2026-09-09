import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CommunityPage from "../app/(home)/community/page";

vi.mock("next/link", () => ({
	default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

describe("community page", () => {
	it("offers the live WhatsApp join door and a live-room example without mock labels", () => {
		const { container } = render(<CommunityPage />);

		expect(screen.getByRole("link", { name: /join the whatsapp community/i })).toHaveAttribute(
			"href",
			expect.stringContaining("yonyon.ai/go/orchestkit"),
		);
		expect(screen.getByRole("link", { name: /open discussions/i })).toBeTruthy();
		expect(screen.getByText(/example of the live room/i)).toBeTruthy();
		expect(container.textContent ?? "").not.toMatch(/mocked|Mock UI|Community · mock/i);
		expect(container.textContent ?? "").not.toMatch(/claude install/i);
	});
});
