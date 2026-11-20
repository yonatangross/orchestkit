import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompatTable } from "@/components/compat-table";
import { COMPAT_ROWS } from "@/lib/generated/compat-data";

// Approved reference: the strip and table mockup, Yonatan 16.11.2026 09:28,
// "Yes, with '?' not 0": a host shows an issue count only after its labelling
// pass is recorded; until then "?", never 0.
// A row header's name starts with the host name; Claude Code's also carries its minimum version.
const rowName = (name: string) => new RegExp(`^${name}`);

describe("CompatTable", () => {
	it("is a real table with a caption, column headers and one row per host", () => {
		render(<CompatTable />);
		const table = screen.getByRole("table");
		expect(within(table).getByText(/what OrchestKit runs in/i)).toBeTruthy();
		const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
		expect(headers).toEqual(["Host", "Skills", "Agents", "Hooks", "Install", "Open issues"]);
		expect(within(table).getAllByRole("row")).toHaveLength(COMPAT_ROWS.length + 1);
		expect(COMPAT_ROWS.map((r) => r.id)).toEqual(["claude", "cursor", "codex", "devin", "opencode", "muse", "pi", "agy"]);
	});

	it("names every host in text beside its mark (no mark-only status)", () => {
		render(<CompatTable />);
		for (const r of COMPAT_ROWS) expect(screen.getByRole("rowheader", { name: rowName(r.name) })).toBeTruthy();
	});

	it("shows ? with a spoken reason for an unknown number, never 0", () => {
		render(<CompatTable />);
		const devin = screen.getByRole("rowheader", { name: "Devin" }).closest("tr") as HTMLElement;
		expect(within(devin).getAllByText("?").length).toBeGreaterThan(0);
		expect(within(devin).getAllByText("not measured yet").length).toBeGreaterThan(0);
		const cells = [...document.querySelectorAll("tbody td:last-child")].map((c) => c.textContent);
		expect(cells.every((t) => !/^\s*0\s*$/.test(t ?? ""))).toBe(true);
	});

	it("shows ? for open issues until a host's labelling pass is recorded", () => {
		render(<CompatTable />);
		for (const r of COMPAT_ROWS.filter((r) => r.issues === null)) {
			const row = screen.getByRole("rowheader", { name: rowName(r.name) }).closest("tr") as HTMLElement;
			const last = row.querySelector("td:last-child") as HTMLElement;
			expect(last.textContent).toContain("?");
			expect(last.textContent).toContain("not counted yet");
		}
	});

	it("never prints none; tracked hooks read not yet with the issue (looks review 16.11)", () => {
		const { container } = render(<CompatTable />);
		expect(container.textContent).not.toMatch(/\bnone\b/);
		const cursor = screen.getByRole("rowheader", { name: rowName("Cursor") }).closest("tr") as HTMLElement;
		expect(cursor.textContent).toContain("not yet");
		expect(within(cursor).getByRole("link", { name: /#4004/ }).getAttribute("href")).toContain("/issues/4004");
	});

	it("on a phone, a card per host carries every column, with no table to scroll", () => {
		render(<CompatTable />);
		const list = screen.getByRole("list", { name: /compatibility by host/i });
		const items = within(list).getAllByRole("listitem");
		expect(items).toHaveLength(COMPAT_ROWS.length);
		const claude = COMPAT_ROWS.find((r) => r.id === "claude");
		expect(items[0].textContent).toMatch(
			new RegExp(`Claude Code.*Skills ${claude?.skills}.*Agents ${claude?.agents}.*Hooks ${claude?.hooks}.*Install: plugin \\(CLI\\).*Open issues`, "s"),
		);
		expect(items[2].textContent).toContain("Agents 4 roles");
	});

	it("shows core skills with the opt-in ork-extras count beside them, never the total", () => {
		render(<CompatTable />);
		const claude = COMPAT_ROWS.find((r) => r.id === "claude");
		const row = screen.getByRole("rowheader", { name: rowName("Claude Code") }).closest("tr") as HTMLElement;
		const cell = row.querySelector("td") as HTMLElement;
		expect(cell.textContent).toBe(`${claude?.skills} + ${claude?.extraSkills} ork-extras`);
		expect(screen.getAllByText(/opt-in second plugin, installed on its own/i).length).toBeGreaterThan(0);
	});

	it("explains the open issues column instead of leaving bare ?", () => {
		render(<CompatTable />);
		expect(screen.getAllByText(/counted once each host's issues are labelled/i).length).toBeGreaterThan(0);
	});

	it("states the Claude Code minimum version from the generated data", () => {
		render(<CompatTable />);
		const claude = COMPAT_ROWS.find((r) => r.id === "claude");
		expect(claude?.minVersion).toMatch(/^\d+\.\d+\.\d+$/);
		// Once in the phone card and once in the table row.
		expect(screen.getAllByText(new RegExp(`Claude Code ${claude?.minVersion} or newer`))).toHaveLength(2);
	});
});
