// Card data for the docs MCP App views (skill card, install picker). Pure and
// side-effect free so the route stays thin and the data is unit-testable.
//
// Nothing here is hand-copied: skill facts come from the generated skills data
// (scripts/generate-docs-data.js) and host commands come from HOST_INSTALLS, the
// one list the home page, the Installation page and the setup wizard also read.

import { SITE } from "@/lib/constants";
import { SKILLS } from "@/lib/generated/skills-data";
import { HOST_INSTALL_BY_ID } from "@/lib/host-installs";
import { osaDistance } from "@/lib/search-suggest";

export const CARD_HOSTS = ["claude", "cursor", "codex"] as const;
export type CardHostId = (typeof CARD_HOSTS)[number];

export type SkillPlugin = "ork" | "ork-extras";

export type SkillCardData =
	| {
			found: true;
			name: string;
			description: string;
			/** The leading sentence(s) of the description: what the skill does. */
			summary: string;
			/** The "Use when ..." sentence of the description, if it has one. */
			useWhen: string | null;
			plugin: SkillPlugin;
			version: string;
			/** The slash command, only for a skill a person can type. */
			invoke: string | null;
			installCommand: string;
			docsUrl: string;
	  }
	| { found: false; query: string; suggestions: string[] };

export type InstallHostCard = {
	id: CardHostId;
	name: string;
	what: string;
	where: string;
	/** One command per line, as shown. */
	commands: string[];
	/** What the copy button puts on the clipboard. */
	copy: string;
	/** Show a `$` before each command line. */
	prompt: boolean;
	/** The copy button's label: a repo name is not a command. */
	copyLabel: string;
	then: { label: string; commands: string[]; prompt: boolean } | null;
	docsUrl: string;
};

export type InstallPickerData = {
	selected: CardHostId;
	hosts: InstallHostCard[];
};

// `claude plugin marketplace add <repo>` is the first half of the site-wide
// install line; the second half names the plugin. Both halves stay in lockstep
// with SITE.installCommand (pinned by __tests__/install-command.test.ts).
const MARKETPLACE_ADD = SITE.installCommand.split(" && ")[0];
const MARKETPLACE_NAME = "orchestkit";

export function claudeInstallCommand(plugin: SkillPlugin): string {
	return `${MARKETPLACE_ADD} && claude plugin install ${plugin}@${MARKETPLACE_NAME}`;
}

/** `/ork:brainstorm`, `ork-extras:langgraph` and ` Brainstorm ` all mean the same skill. */
function normalizeSkillName(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/^\//, "")
		.replace(/^(ork-extras|ork):/, "");
}

const MAX_SUGGESTIONS = 5;

export function nearestSkillNames(query: string): string[] {
	const q = normalizeSkillName(query);
	if (!q) return [];
	const cap = Math.max(2, Math.floor(q.length / 3));
	const scored: Array<{ name: string; score: number }> = [];
	for (const name of Object.keys(SKILLS)) {
		if (name.includes(q) || (name.length >= 3 && q.includes(name))) {
			scored.push({ name, score: 0 });
			continue;
		}
		const d = osaDistance(q, name, cap);
		if (d <= cap) scored.push({ name, score: d });
	}
	return scored
		.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
		.slice(0, MAX_SUGGESTIONS)
		.map((s) => s.name);
}

/**
 * Skill descriptions are written for the model's router: what the skill does,
 * then "Use when ...", then "Not for ...". A person reading the card wants the
 * first two. Both parts are cut from the real description, never rewritten.
 */
export function splitDescription(description: string): { summary: string; useWhen: string | null } {
	const sentences = description
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	const isRouting = (s: string) => /^(use (when|for)|not for)\b/i.test(s);
	const firstRouting = sentences.findIndex(isRouting);
	const lead = firstRouting === -1 ? sentences.slice(0, 1) : sentences.slice(0, firstRouting);
	const useWhen = sentences.find((s) => /^use (when|for)\b/i.test(s)) ?? null;
	return { summary: lead.length ? lead.join(" ") : description.trim(), useWhen };
}

export function buildSkillCard(rawName: string): SkillCardData {
	const key = normalizeSkillName(rawName);
	const skill = Object.prototype.hasOwnProperty.call(SKILLS, key) ? SKILLS[key] : undefined;
	if (!skill) {
		return { found: false, query: rawName.trim(), suggestions: nearestSkillNames(rawName) };
	}
	const plugin: SkillPlugin = skill.plugins[0] === "ork-extras" ? "ork-extras" : "ork";
	return {
		found: true,
		name: skill.name,
		description: skill.description,
		...splitDescription(skill.description),
		plugin,
		version: skill.version,
		invoke: skill.userInvocable ? `/${plugin}:${skill.name}` : null,
		installCommand: claudeInstallCommand(plugin),
		docsUrl: `${SITE.domain}/docs/reference/skills/${skill.name}`,
	};
}

export function skillCardText(card: SkillCardData): string {
	if (!card.found) {
		const near = card.suggestions.length
			? ` Nearest names: ${card.suggestions.join(", ")}.`
			: " Search the docs with orchestkit_docs_search.";
		return `No such skill: "${card.query}".${near}`;
	}
	return [
		`${card.name} (${card.plugin} ${card.version}): ${card.description}`,
		`Install: ${card.installCommand}`,
		card.invoke ? `Run: ${card.invoke}` : null,
		`Docs: ${card.docsUrl}`,
	]
		.filter((l): l is string => l !== null)
		.join("\n");
}

export function parseCardHost(raw: unknown): CardHostId {
	const id = typeof raw === "string" ? raw.trim().toLowerCase() : "";
	return (CARD_HOSTS as readonly string[]).includes(id) ? (id as CardHostId) : "claude";
}

// What a person gets, in plain words, for the line under the copy button. The
// site's own taglines (HOST_INSTALLS.what) are written for the docs page; these
// say the same facts without the plugin jargon. The commands are never written here.
const CARD_WHAT: Record<CardHostId, string> = {
	claude: "Skills, agents and hooks, all inside Claude Code.",
	cursor: "Skills, commands and agents in Cursor. Claude Code's hooks do not run there.",
	codex: "A pack made for Codex. It is separate from the Claude Code plugin.",
};

export function buildInstallPicker(rawHost?: unknown): InstallPickerData {
	const hosts = CARD_HOSTS.map((id): InstallHostCard => {
		const spec = HOST_INSTALL_BY_ID[id];
		return {
			id,
			name: spec.name,
			what: CARD_WHAT[id],
			where: spec.where,
			commands: [...spec.commands],
			// Two shell lines copy as one `&&` line so a failed first step stops the
			// second. A single slug or slash command copies as shown.
			copy: spec.copy ?? (spec.prompt ? spec.commands.join(" && ") : spec.commands.join("\n")),
			prompt: spec.prompt,
			// A single word with no shell prompt is a marketplace slug, not a command.
			copyLabel:
				!spec.prompt && spec.commands.length === 1 && !spec.commands[0].includes(" ")
					? "Copy repo name"
					: "Copy command",
			then: spec.then
				? {
						label: `Then type in ${spec.name}`,
						commands: [...spec.then.commands],
						prompt: spec.then.prompt,
					}
				: null,
			docsUrl: `${SITE.domain}${spec.href}`,
		};
	});
	return { selected: parseCardHost(rawHost), hosts };
}

export function installPickerText(data: InstallPickerData): string {
	return data.hosts
		.map((h) => `${h.name}${h.id === data.selected ? " (selected)" : ""}:\n${h.commands.map((c) => `  ${c}`).join("\n")}`)
		.join("\n");
}
