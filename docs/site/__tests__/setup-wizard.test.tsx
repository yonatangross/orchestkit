import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetupWizard } from "@/components/setup-wizard";
import { SITE } from "@/lib/constants";
import { SKILLS_SH_STARTER } from "@/lib/host-installs";

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

const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
	value: { writeText: writeTextMock },
	writable: true,
	configurable: true,
});

function copyLine(line: string) {
	fireEvent.click(
		screen.getByRole("button", {
			name: (accessible) =>
				accessible.toLowerCase().startsWith("copy ") &&
				accessible.includes(line) &&
				accessible.toLowerCase().includes("to clipboard"),
		}),
	);
}

describe("SetupWizard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("starts on the host step with Claude selected", () => {
		render(<SetupWizard />);
		expect(screen.getByText("Which host do you run?")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /^Claude Code$/ }),
		).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByText(/claude install orchestkit\/ork/)).toBeInTheDocument();
	});

	it("keeps a Claude default chip and has no lighter-plugin presets", () => {
		render(<SetupWizard />);
		expect(
			screen.getByRole("button", { name: /I'm on Claude Code, just copy/i }),
		).toBeInTheDocument();
		expect(screen.queryByText("Quick presets")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Minimal" })).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Everything" }),
		).not.toBeInTheDocument();
	});

	it("copies the Claude install command by default", () => {
		render(<SetupWizard />);
		copyLine(SITE.installCommand);
		expect(writeTextMock).toHaveBeenCalledWith(SITE.installCommand);
	});

	it("switches the clipboard payload when Cursor is selected", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
		copyLine("yonatangross/orchestkit");
		expect(writeTextMock).toHaveBeenCalledWith("yonatangross/orchestkit");
		expect(writeTextMock).not.toHaveBeenCalledWith(
			expect.stringMatching(/cursor install/i),
		);
		expect(screen.getByText(/No cursor install CLI/)).toBeInTheDocument();
	});

	it("switches Codex to the two-line ork-codex add, not claude install", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: "Codex" }));
		copyLine("ork-codex@orchestkit-codex");
		const payload = writeTextMock.mock.calls[0][0] as string;
		expect(payload).toContain("ork-codex@orchestkit-codex");
		expect(payload).toContain("codex plugin marketplace add");
		expect(payload).not.toContain("claude install");
		expect(screen.getByText(/ork-codex is a portable pack/)).toBeInTheDocument();
	});

	it("copies the shipped pi install and never emits ork-pi", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: "Pi" }));
		copyLine("pi install git:github.com/yonatangross/orchestkit");
		expect(writeTextMock).toHaveBeenCalledWith(
			"pi install git:github.com/yonatangross/orchestkit",
		);
		expect(writeTextMock.mock.calls[0][0]).not.toMatch(/ork-pi/i);
		expect(screen.getByText(/Command is pi install, not ork-pi/)).toBeInTheDocument();
	});

	it("never emits ork-muse for Muse Code", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: "Muse Code" }));
		copyLine(SKILLS_SH_STARTER);
		expect(writeTextMock).toHaveBeenCalledWith(SKILLS_SH_STARTER);
		expect(writeTextMock.mock.calls[0][0]).not.toMatch(/ork-muse/i);
		expect(
			screen.getByText(/Muse hooks stay in \.muse\/hooks\.json/),
		).toBeInTheDocument();
		expect(screen.getByText("muse skills list")).toBeInTheDocument();
	});

	it("navigates to the optional stack step and back", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: /next/i }));
		expect(screen.getByText("Optional stack hint")).toBeInTheDocument();
		expect(
			screen.getByText(/Does not pick another plugin/),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
		expect(screen.getByText("Which host do you run?")).toBeInTheDocument();
	});

	it("disables Back on host and Next on stack", () => {
		render(<SetupWizard />);
		expect(screen.getByRole("button", { name: /^back$/i })).toBeDisabled();
		fireEvent.click(screen.getByRole("button", { name: /next/i }));
		expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
	});

	it("does not change the Claude command when a stack hint is chosen", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: /next/i }));
		fireEvent.click(screen.getByRole("button", { name: /python/i }));
		copyLine(SITE.installCommand);
		expect(writeTextMock).toHaveBeenCalledWith(SITE.installCommand);
		expect(
			screen.getByText(/After install, \/ork:setup will bias toward/),
		).toBeInTheDocument();
		expect(screen.getByText(/The plugin is still ork/)).toBeInTheDocument();
	});

	it("appends real -s flags on Muse and still never invents ork-muse", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: "Muse Code" }));
		fireEvent.click(screen.getByRole("button", { name: /next/i }));
		fireEvent.click(screen.getByRole("button", { name: /python/i }));
		copyLine("-s python-backend");
		const payload = writeTextMock.mock.calls[0][0] as string;
		expect(payload.startsWith(SKILLS_SH_STARTER)).toBe(true);
		expect(payload).toContain("-s python-backend");
		expect(payload).not.toMatch(/ork-pi|ork-muse/);
	});

	it("keeps Codex on ork-codex when a stack hint is chosen", () => {
		render(<SetupWizard />);
		fireEvent.click(screen.getByRole("button", { name: "Codex" }));
		fireEvent.click(screen.getByRole("button", { name: /next/i }));
		fireEvent.click(
			screen.getByRole("button", { name: /Backend APIs, databases/i }),
		);
		copyLine("ork-codex@orchestkit-codex");
		const payload = writeTextMock.mock.calls[0][0] as string;
		expect(payload).toContain("ork-codex@orchestkit-codex");
		expect(payload).not.toContain("-s api-design");
		expect(
			screen.getByText(/ork-codex stays the same pack/),
		).toBeInTheDocument();
	});

	it("shows the selected host what/where, not a second plugin badge", () => {
		render(<SetupWizard />);
		expect(
			screen.getByText("Full ork plugin: skills, agents, hooks."),
		).toBeInTheDocument();
		expect(screen.queryByText("Full toolkit")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Cursor" }));
		expect(
			screen.getByText("Same ork plugin. Claude hook scripts are not registered."),
		).toBeInTheDocument();
	});
});
