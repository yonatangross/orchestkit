// What OrchestKit gives on each agent host, stated once for llms.txt and the
// home page (SEO PR-F, 15.11.2026). Every line comes from the repo:
// lib/host-installs.ts (hosts, order, install commands) and the install pages
// under content/docs/getting-started/ (hosts.mdx, cursor.mdx, codex.mdx,
// devin.mdx). Hooks are Claude Code hooks.json scripts: Cursor does not
// register them (cursor.mdx), Devin does not load them (devin.mdx), and the
// skills-only hosts have no hook surface. Change a host's support there first,
// then here; __tests__/seo-pr-f-cross-harness.test.tsx keeps ids and install
// commands in sync with HOST_INSTALLS.

import type { HostId } from "@/components/host-marks";
import { COUNTS } from "@/lib/constants";
import { HOST_INSTALLS } from "@/lib/host-installs";

export type HostSupport = {
	id: HostId;
	name: string;
	/** What the host loads, in plain words. */
	gets: string;
	/** True only where OrchestKit's lifecycle hooks actually run. */
	hooks: boolean;
	/** The one-line install, as the install chip copies it. */
	install: string;
};

const GETS: Record<HostId, { gets: string; hooks: boolean }> = {
	claude: {
		gets: `the full ork plugin: ${COUNTS.skills} skills, ${COUNTS.agents} agents and ${COUNTS.hooks} hooks`,
		hooks: true,
	},
	cursor: { gets: "the same ork plugin, without the Claude hook scripts", hooks: false },
	codex: { gets: "the portable ork-codex pack: workflows such as $ork-implement, plus Codex roles", hooks: false },
	devin: { gets: "the ork plugin from git; skills load, hooks do not", hooks: false },
	opencode: { gets: "Agent Skills through skills.sh (a starter set of 12)", hooks: false },
	muse: { gets: "skills through .agents/skills", hooks: false },
	pi: { gets: "skills through the shipped pi manifest", hooks: false },
	agy: { gets: "skills through workspace .agents/skills", hooks: false },
};

export const HOST_SUPPORT: readonly HostSupport[] = HOST_INSTALLS.map((spec) => ({
	id: spec.id,
	name: spec.name,
	...GETS[spec.id],
	install: spec.copy ?? spec.commands.join(" && "),
}));

/** One phrase for every surface that says what OrchestKit is (SEO PR-G). */
export const PRODUCT_LINE = `a free, open-source library of skills and agents for ${hostSummary()}`;

/** The single statement of the hooks limit. */
export const HOOKS_LIMIT = "Hooks run on Claude Code only; the other hosts get skills, and Cursor, Codex and Devin also get the plugin or pack named above.";

/** "Claude Code, Cursor, Codex and 5 more" */
export function hostSummary(named = 3): string {
	const names = HOST_SUPPORT.slice(0, named).map((h) => h.name);
	const rest = HOST_SUPPORT.length - named;
	return rest > 0 ? `${names.join(", ")} and ${rest} more agent hosts` : names.join(", ");
}
