import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
	default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

import { AgentReadinessSection, Path } from "@/components/agent-readiness-section";

describe("Path", () => {
	it("keeps the text exact and offers a break after every / and .", () => {
		const { container } = render(<Path text="github.com/yonatangross/orchestkit/sdk" />);
		expect(container.textContent).toBe("github.com/yonatangross/orchestkit/sdk");
		// github. | com/ | yonatangross/ | orchestkit/ | sdk
		expect(container.querySelectorAll("wbr")).toHaveLength(4);
	});

	it("never offers a break inside a segment", () => {
		const { container } = render(<Path text="https://orchestkit.yonyon.ai/api/mcp" />);
		const segments = [...container.querySelectorAll("code > span")].map((s) => s.textContent);
		expect(segments).toContain("mcp");
		expect(segments.every((s) => s === "/" || !/[/.]./.test(s ?? ""))).toBe(true);
	});
});

describe("AgentReadinessSection", () => {
	it("renders the long paths through Path, so each can wrap at a boundary", () => {
		const { container } = render(<AgentReadinessSection />);
		expect(screen.getByRole("heading", { name: "Built for AI agents, too" })).toBeTruthy();
		const codes = [...container.querySelectorAll("code")].filter((c) => c.querySelector("wbr"));
		const texts = codes.map((c) => c.textContent);
		expect(texts).toContain("github.com/yonatangross/orchestkit/sdk");
		expect(texts).toContain("io.github.yonatangross/orchestkit");
		expect(texts.some((t) => t?.endsWith("/api/mcp"))).toBe(true);
	});
});
