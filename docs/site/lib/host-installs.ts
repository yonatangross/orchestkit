import type { HostId } from "@/components/host-marks";
import { SITE } from "@/lib/constants";
import type { LibraryTab } from "@/lib/library-tab";

/** Starter 12. Never the bare `npx skills add yonatangross/orchestkit` firehose. */
export const SKILLS_SH_STARTER =
	"npx skills add yonatangross/orchestkit -s doctor -s setup -s explore -s implement -s verify -s review-pr -s commit -s expect -s assess -s brainstorm -s create-pr -s remember";

export type HostInstallSpec = {
	id: HostId;
	name: string;
	href: string;
	what: string;
	where: string;
	commands: string[];
	/** Show a `$` prefix. Off for marketplace slugs and slash commands. */
	prompt: boolean;
	then?: { label: string; commands: string[]; prompt: boolean };
};

export const HOST_INSTALLS: readonly HostInstallSpec[] = [
	{
		id: "claude",
		name: "Claude Code",
		href: "/docs/getting-started/claude-code",
		what: "Full ork plugin: skills, agents, hooks.",
		where: "Paste in a terminal.",
		commands: [SITE.installCommand],
		prompt: true,
		then: { label: "Then run", commands: ["/ork:setup"], prompt: false },
	},
	{
		id: "cursor",
		name: "Cursor",
		href: "/docs/getting-started/cursor",
		what: "Same ork plugin. Claude hook scripts are not registered.",
		where: "Settings → Plugins. Paste the repo, enable ork, open a new chat.",
		commands: ["yonatangross/orchestkit"],
		prompt: false,
		then: {
			label: "Then in a new chat",
			commands: ["/ork:setup"],
			prompt: false,
		},
	},
	{
		id: "codex",
		name: "Codex",
		href: "/docs/getting-started/codex",
		what: "Portable ork-codex pack. Not the Claude Code plugin.",
		where: "Paste in a terminal, then restart Codex.",
		commands: [
			"codex plugin marketplace add yonatangross/orchestkit --ref main --sparse .agents/plugins --sparse plugins/ork-codex",
			"codex plugin add ork-codex@orchestkit-codex",
		],
		prompt: true,
		then: { label: "Then invoke", commands: ["$ork-implement"], prompt: false },
	},
	{
		id: "muse",
		name: "Muse Code",
		href: "/docs/getting-started/muse",
		what: "Skills via .agents/skills. No ork-muse pack.",
		where: "Paste in the repo. Muse Code already scans .agents/skills.",
		commands: [SKILLS_SH_STARTER],
		prompt: true,
		then: {
			label: "Then confirm",
			commands: ["muse skills list"],
			prompt: true,
		},
	},
	{
		id: "pi",
		name: "Pi",
		href: "/docs/guides/orchestkit-on-pi-codex-cursor",
		what: "Shipped pi manifest. No ork-pi pack.",
		where: "Paste in a terminal. Add -l to pin the project.",
		commands: ["pi install git:github.com/yonatangross/orchestkit"],
		prompt: true,
	},
	{
		id: "opencode",
		name: "OpenCode",
		href: "/docs/getting-started/skills-sh#opencode",
		what: "Agent Skills via skills.sh. No separate marketplace plugin.",
		where: "Paste in the repo.",
		commands: [SKILLS_SH_STARTER],
		prompt: true,
	},
];

export const HOST_INSTALL_BY_ID: Record<HostId, HostInstallSpec> = Object.fromEntries(
	HOST_INSTALLS.map((spec) => [spec.id, spec]),
) as Record<HostId, HostInstallSpec>;

const HOST_IDS = HOST_INSTALLS.map((spec) => spec.id);

export function parseHostId(
	value: string | string[] | undefined,
): HostId {
	const raw = Array.isArray(value) ? value[0] : value;
	const id = raw?.trim().toLowerCase();
	return HOST_IDS.includes(id as HostId) ? (id as HostId) : "claude";
}

/** Homepage picker URL. Claude is the default, so it stays `/` when the catalog is on skills. */
export function homeInstallHref(host: HostId, lib: LibraryTab = "skills"): string {
	const params = new URLSearchParams();
	if (host !== "claude") params.set("host", host);
	if (lib !== "skills") params.set("lib", lib);
	const query = params.toString();
	return query ? `/?${query}` : "/";
}

export const SKILLS_SH_HOST_IDS = ["muse", "opencode"] as const;

export type StackHint = "backend" | "frontend" | "fullstack" | "python";

export const STACK_HINTS: readonly {
	id: StackHint;
	label: string;
	description: string;
	extras: readonly string[];
	setupBias: string;
}[] = [
	{
		id: "backend",
		label: "Backend",
		description: "APIs, databases, microservices",
		extras: ["api-design", "database-patterns"],
		setupBias: "API and database skills",
	},
	{
		id: "frontend",
		label: "Frontend",
		description: "React, UI, design systems",
		extras: ["react-server-components-framework", "ui-components", "accessibility"],
		setupBias: "React and UI skills",
	},
	{
		id: "fullstack",
		label: "Full-Stack",
		description: "Both backend and frontend",
		extras: ["api-design", "react-server-components-framework"],
		setupBias: "API plus React skills",
	},
	{
		id: "python",
		label: "Python",
		description: "FastAPI, SQLAlchemy, data science",
		extras: ["python-backend"],
		setupBias: "python-backend / FastAPI skills",
	},
];

export function isSkillsShHost(id: HostId): boolean {
	return (SKILLS_SH_HOST_IDS as readonly string[]).includes(id);
}

export function withSkillsShExtras(base: string, extras: readonly string[]): string {
	let cmd = base;
	for (const skill of extras) {
		const flag = `-s ${skill}`;
		if (cmd.includes(flag)) continue;
		cmd += ` ${flag}`;
	}
	return cmd;
}

/** Install lines for a host. Stack only mutates skills.sh; never a second plugin. */
export function installCommandsForHost(
	host: HostId,
	stack: StackHint | null,
): string[] {
	const spec = HOST_INSTALL_BY_ID[host];
	if (!isSkillsShHost(host) || !stack) return [...spec.commands];
	const extras = STACK_HINTS.find((s) => s.id === stack)?.extras ?? [];
	return spec.commands.map((line) =>
		line.startsWith("npx skills add") ? withSkillsShExtras(line, extras) : line,
	);
}

export function stackHintCopy(host: HostId, stack: StackHint | null): string | null {
	if (!stack) return null;
	const hint = STACK_HINTS.find((s) => s.id === stack);
	if (!hint) return null;
	if (host === "claude" || host === "cursor") {
		return `After install, /ork:setup will bias toward ${hint.setupBias}. The plugin is still ork.`;
	}
	if (host === "codex") {
		return `ork-codex stays the same pack. ${hint.setupBias} live in the full Claude plugin, not this pack.`;
	}
	return `Starter 12 plus ${hint.extras.map((s) => `-s ${s}`).join(" ")}. Still skills.sh. No native pack.`;
}
