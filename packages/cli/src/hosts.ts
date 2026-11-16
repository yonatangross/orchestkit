// Which coding agents ("hosts") OrchestKit installs into, and how.
//
// Source of truth: docs/site/lib/host-installs.ts (same ids, same order, same
// commands). This package is published on its own and cannot import site code,
// so tests/hosts.test.ts fails when the two drift apart.

export type HostId = "claude" | "cursor" | "codex" | "devin" | "opencode" | "muse" | "pi" | "agy";

export type Host = {
	id: HostId;
	name: string;
	/** Binaries whose presence on PATH means the host is installed here. */
	bins: string[];
	/** Environment variables a host sets for the processes it runs. */
	env?: Record<string, string>;
	where: string;
	commands: string[];
	then?: string;
};

/**
 * Claude Code's install as one line, the form the site copies: with `&&`, a
 * failed marketplace add stops before the install runs. `claude install`
 * installs the Claude Code native build, not a plugin, so it never appears here.
 */
export const PLUGIN_INSTALL_COMMAND =
	"claude plugin marketplace add yonatangross/orchestkit && claude plugin install ork@orchestkit";

const SKILLS_SH_STARTER =
	"npx skills add yonatangross/orchestkit -s devops-deployment -s responsive-patterns -s architecture-decision-record -s ui-components -s rag-retrieval -s agent-orchestration -s brainstorm -s expect -s auto -s review-pr -s fix-issue -s commit";

export const HOSTS: readonly Host[] = [
	{
		id: "claude",
		name: "Claude Code",
		bins: ["claude"],
		env: { CLAUDECODE: "1" },
		where: "Paste in a terminal.",
		commands: [PLUGIN_INSTALL_COMMAND],
		then: "/ork:setup",
	},
	{
		id: "cursor",
		name: "Cursor",
		bins: ["cursor", "cursor-agent"],
		where: "Settings → Plugins. Paste the repo, enable ork, open a new chat.",
		commands: ["yonatangross/orchestkit"],
		then: "/ork:setup",
	},
	{
		id: "codex",
		name: "Codex",
		bins: ["codex"],
		where: "Paste in a terminal, then restart Codex.",
		commands: [
			"codex plugin marketplace add yonatangross/orchestkit --ref main --sparse .agents/plugins --sparse plugins/ork-codex",
			"codex plugin add ork-codex@orchestkit-codex",
		],
		then: "$ork-implement",
	},
	{
		id: "devin",
		name: "Devin",
		bins: ["devin"],
		where: "Paste in a terminal with the Devin CLI signed in.",
		commands: ["devin plugins install https://github.com/yonatangross/orchestkit#plugins/ork"],
		then: "devin plugins info ork",
	},
	{
		id: "opencode",
		name: "OpenCode",
		bins: ["opencode"],
		where: "Paste in the repo.",
		commands: [SKILLS_SH_STARTER],
	},
	{
		id: "muse",
		name: "Muse Code",
		bins: ["muse"],
		where: "Paste in the repo. Muse Code already scans .agents/skills.",
		commands: [SKILLS_SH_STARTER],
		then: "muse skills list",
	},
	{
		id: "pi",
		name: "Pi",
		bins: ["pi"],
		where: "Paste in a terminal. Add -l to pin the project.",
		commands: ["pi install git:github.com/yonatangross/orchestkit"],
	},
	{
		id: "agy",
		name: "Antigravity",
		bins: ["agy"],
		where: "Paste in the repo. agy reads the workspace .agents/skills.",
		commands: [SKILLS_SH_STARTER],
		then: 'agy -p "/skills" --add-dir "$PWD"',
	},
];

export const HOST_IDS: readonly HostId[] = HOSTS.map((h) => h.id);

export function isHostId(value: string): value is HostId {
	return (HOST_IDS as readonly string[]).includes(value);
}

/** What detection may look at. Injected so tests never read the real machine. */
export type HostEnv = {
	env: Record<string, string | undefined>;
	hasBin: (bin: string) => boolean;
};

/** Hosts present on this machine, in the site's host order. */
export function detectHosts({ env, hasBin }: HostEnv): HostId[] {
	return HOSTS.filter(
		(h) =>
			Object.entries(h.env ?? {}).some(([k, v]) => env[k] === v) || h.bins.some((b) => hasBin(b)),
	).map((h) => h.id);
}

function hostBlock(h: Host): string {
	const lines = [`${h.name}: ${h.where}`, ...h.commands.map((c) => `  ${c}`)];
	if (h.then) lines.push(`  then: ${h.then}`);
	return lines.join("\n");
}

/** The install instructions for the given hosts, or a list of all hosts when none. */
export function installText(ids: readonly HostId[]): string {
	if (ids.length === 0) {
		return [
			"No coding agent found on PATH. OrchestKit installs into any of these:",
			"",
			...HOSTS.map((h) => `  ${h.id.padEnd(9)} ${h.name}`),
			"",
			"Run: orchestkit install <host>    (or --all to print every command)",
			"",
		].join("\n");
	}
	const blocks = HOSTS.filter((h) => ids.includes(h.id)).map(hostBlock);
	return `${blocks.join("\n\n")}\n\nDocs: https://orchestkit.dev/docs/getting-started/installation\n`;
}
