import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/constants";
import {
	HOST_INSTALLS,
	SKILLS_SH_STARTER,
	HOST_INSTALL_BY_ID,
	homeInstallHref,
	installCommandsForHost,
	parseHostId,
	stackHintCopy,
	withSkillsShExtras,
} from "@/lib/host-installs";

describe("host install commands", () => {
	it("covers every documented host", () => {
		expect(HOST_INSTALLS.map((h) => h.id)).toEqual([
			"claude",
			"cursor",
			"codex",
			"muse",
			"pi",
			"opencode",
		]);
	});

	it("keeps Claude on the site-wide install command", () => {
		expect(HOST_INSTALL_BY_ID.claude.commands).toEqual([SITE.installCommand]);
		expect(HOST_INSTALL_BY_ID.claude.then?.commands).toEqual(["/ork:setup"]);
	});

	it("does not invent a Cursor CLI or a fake pack name", () => {
		const joined = HOST_INSTALLS.flatMap((h) => h.commands).join("\n");
		expect(joined).not.toMatch(/cursor install/i);
		expect(joined).not.toMatch(/ork-muse|ork-pi/);
		expect(HOST_INSTALL_BY_ID.cursor.commands).toEqual(["yonatangross/orchestkit"]);
		expect(HOST_INSTALL_BY_ID.cursor.prompt).toBe(false);
	});

	it("installs Pi via the shipped pi manifest, not ork-pi", () => {
		expect(HOST_INSTALL_BY_ID.pi.commands).toEqual([
			"pi install git:github.com/yonatangross/orchestkit",
		]);
	});

	it("installs Codex via ork-codex, not the Claude plugin", () => {
		const cmd = HOST_INSTALL_BY_ID.codex.commands.join("\n");
		expect(cmd).toContain("ork-codex@orchestkit-codex");
		expect(cmd).not.toContain("claude install");
	});

	it("gives Muse and OpenCode the starter 12, not the firehose", () => {
		expect(SKILLS_SH_STARTER).toContain("-s implement");
		expect(SKILLS_SH_STARTER).not.toBe(
			"npx skills add yonatangross/orchestkit",
		);
		for (const id of ["muse", "opencode"] as const) {
			expect(HOST_INSTALL_BY_ID[id].commands).toEqual([SKILLS_SH_STARTER]);
		}
	});

	it("appends extra -s flags without duplicating the starter 12", () => {
		const twice = withSkillsShExtras(SKILLS_SH_STARTER, ["implement", "api-design"]);
		expect(twice).toContain("-s api-design");
		expect(twice.match(/-s implement/g)).toHaveLength(1);
	});

	it("stack hint never swaps Claude, Cursor, or Codex to another plugin", () => {
		expect(installCommandsForHost("claude", "python")).toEqual([
			SITE.installCommand,
		]);
		expect(installCommandsForHost("cursor", "backend")).toEqual([
			"yonatangross/orchestkit",
		]);
		expect(installCommandsForHost("codex", "frontend")).toEqual(
			HOST_INSTALL_BY_ID.codex.commands,
		);
		expect(stackHintCopy("claude", "python")).toMatch(/plugin is still ork/);
		expect(stackHintCopy("codex", "backend")).toMatch(/ork-codex stays the same pack/);
	});

	it("stack hint only mutates skills.sh hosts, and never invents packs", () => {
		expect(installCommandsForHost("pi", "python")).toEqual([
			"pi install git:github.com/yonatangross/orchestkit",
		]);
		const [muse] = installCommandsForHost("muse", "python");
		expect(muse.startsWith(SKILLS_SH_STARTER)).toBe(true);
		expect(muse).toContain("-s python-backend");
		expect(muse).not.toMatch(/ork-pi|ork-muse/);
		expect(installCommandsForHost("muse", null)).toEqual([SKILLS_SH_STARTER]);
	});

	it("parses host query values and ignores junk", () => {
		expect(parseHostId("cursor")).toBe("cursor");
		expect(parseHostId(["pi"])).toBe("pi");
		expect(parseHostId("ork-muse")).toBe("claude");
		expect(parseHostId(undefined)).toBe("claude");
	});

	it("omits default Claude from the homepage query", () => {
		expect(homeInstallHref("claude")).toBe("/");
		expect(homeInstallHref("cursor")).toBe("/?host=cursor");
		expect(homeInstallHref("pi", "agents")).toBe("/?host=pi&lib=agents");
	});
});
