import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/search-beacon", () => ({ track: vi.fn() }));

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

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import { track } from "@/lib/search-beacon";
import { SITE } from "@/lib/constants";
import { InstallSnippet } from "@/components/install-snippet";
import { HostInstall } from "@/components/host-install";
import { TrackedCodeBlock, codeCopyProps } from "@/components/tracked-code-block";
import {
	GitHubClickTracker,
	githubLinkLocation,
} from "@/components/github-click-tracker";

const trackMock = vi.mocked(track);

Object.defineProperty(navigator, "clipboard", {
	value: { writeText: vi.fn().mockResolvedValue(undefined) },
	writable: true,
	configurable: true,
});

beforeEach(() => {
	trackMock.mockClear();
});

describe("install vs setup snippet events", () => {
	it("an install chip fires install_copied by default", () => {
		render(<InstallSnippet text={SITE.installCommand} host="claude" />);
		fireEvent.click(screen.getByRole("button"));
		expect(trackMock).toHaveBeenCalledWith("install_copied", { host: "claude" });
	});

	it("the Claude card fires setup_copied for /ork:setup, never install_copied", () => {
		render(<HostInstall host="claude" />);
		fireEvent.click(
			screen.getByRole("button", { name: /^copy \/ork:setup to clipboard$/i }),
		);
		expect(trackMock).toHaveBeenCalledTimes(1);
		expect(trackMock).toHaveBeenCalledWith("setup_copied", { host: "claude", surface: "docs-card" });

		trackMock.mockClear();
		fireEvent.click(
			screen.getByRole("button", {
				name: /copy claude plugin marketplace add yonatangross\/orchestkit/i,
			}),
		);
		expect(trackMock).toHaveBeenCalledWith("install_copied", { host: "claude", surface: "docs-card" });
	});

	it("a two-command terminal install copies as one && line (Codex)", () => {
		const writeText = vi.mocked(navigator.clipboard.writeText);
		writeText.mockClear();
		render(<HostInstall host="codex" />);
		fireEvent.click(screen.getByRole("button", { name: /^copy codex plugin marketplace add/i }));
		expect(writeText).toHaveBeenCalledTimes(1);
		const payload = writeText.mock.calls[0][0];
		expect(payload).not.toContain("\n");
		expect(payload).toMatch(/ork-codex && codex plugin add ork-codex@orchestkit-codex$/);
	});
});

describe("code_copied on docs code blocks", () => {
	it("reports page path, block language and the first token", () => {
		window.history.pushState({}, "", "/docs/getting-started/installation");
		render(
			<TrackedCodeBlock>
				<code className="language-bash">
					{"claude plugin marketplace add yonatangross/orchestkit\n"}
				</code>
			</TrackedCodeBlock>,
		);
		fireEvent.click(screen.getByRole("button", { name: /copy text/i }));
		expect(trackMock).toHaveBeenCalledWith("code_copied", {
			path: "/docs/getting-started/installation",
			language: "bash",
			first_token: "claude",
		});
	});

	it("falls back to unknown when a block has no language class", () => {
		const figure = document.createElement("figure");
		figure.innerHTML = "<pre><code>  /ork:doctor --json</code></pre>";
		expect(codeCopyProps(figure, "/docs/x")).toEqual({
			path: "/docs/x",
			language: "unknown",
			first_token: "/ork:doctor",
		});
	});
});

describe("github_clicked on shared nav and footer", () => {
	it("classifies only the bare repo link inside shared chrome", () => {
		document.body.innerHTML = `
			<header><a id="nav" href="${SITE.github}">GitHub</a></header>
			<aside id="nd-sidebar"><a id="side" href="${SITE.github}/">GitHub</a></aside>
			<footer><nav aria-label="Footer"><a id="foot" href="${SITE.github}">GitHub</a></nav></footer>
			<main><a id="edit" href="${SITE.github}/edit/main/x.mdx">Edit</a>
			<a id="body" href="${SITE.github}">repo</a></main>`;
		const el = (id: string) => document.getElementById(id) as Element;
		expect(githubLinkLocation(el("nav"))).toBe("nav");
		expect(githubLinkLocation(el("side"))).toBe("sidebar");
		expect(githubLinkLocation(el("foot"))).toBe("footer");
		expect(githubLinkLocation(el("edit"))).toBeNull();
		expect(githubLinkLocation(el("body"))).toBeNull();
	});

	it("fires github_clicked with the location on click", () => {
		render(
			<>
				<GitHubClickTracker />
				<header>
					<a href={SITE.github}>GitHub nav</a>
				</header>
				<footer>
					<a href={SITE.github}>GitHub footer</a>
				</footer>
			</>,
		);
		const stop = (e: Event) => e.preventDefault();
		document.addEventListener("click", stop);
		fireEvent.click(screen.getByText("GitHub nav"));
		fireEvent.click(screen.getByText("GitHub footer"));
		document.removeEventListener("click", stop);
		expect(trackMock).toHaveBeenNthCalledWith(1, "github_clicked", { location: "nav" });
		expect(trackMock).toHaveBeenNthCalledWith(2, "github_clicked", { location: "footer" });
	});
});
