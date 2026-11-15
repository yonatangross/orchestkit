// Search result copy for docs pages: the <title> and meta description a search
// engine shows. Kept as pure functions so the limits are unit tested.
//
// Limits (orchestkit.dev SEO gaps, rows 8 and 9): a title runs 30 to 60
// characters and says what the page is, not just its name; a description runs
// 140 to 160 characters and carries a concrete number. A page that set its own
// `seoTitle` or an in-range description keeps it.

import { COUNTS, SITE } from "@/lib/constants";

export const TITLE_MIN = 30;
export const TITLE_MAX = 60;
export const DESC_MIN = 140;
export const DESC_MAX = 160;

const SUFFIX = ` | ${SITE.name}`;

type Kind = "skill" | "agent" | "doc";

function kindOf(slug: readonly string[]): Kind {
	// /docs/reference/skills/<name> and /docs/reference/agents/<name>, including
	// the companion pages of a split skill (<name>/rules and so on).
	if (slug[0] === "reference" && slug.length >= 3) {
		if (slug[1] === "skills") return "skill";
		if (slug[1] === "agents") return "agent";
	}
	return "doc";
}

/** The full <title> for a docs page, suffix included. */
export function docsSearchTitle(
	slug: readonly string[],
	title: string,
	seoTitle?: string,
): string {
	if (seoTitle) return seoTitle;
	const kind = kindOf(slug);
	const sub = slug.length > 3 ? ` ${slug.slice(3).join(" ")}` : "";
	const candidates =
		kind === "skill"
			? [
					`${title}${sub} skill for AI coding agents`,
					`${title}${sub} skill for coding agents`,
					`${title}${sub} skill`,
				]
			: kind === "agent"
				? [
						`${title} agent for AI coding tools`,
						`${title} subagent`,
					]
				: [title];
	for (const c of candidates) {
		const full = `${c}${SUFFIX}`;
		if (full.length <= TITLE_MAX) return full;
	}
	return `${candidates[candidates.length - 1]}${SUFFIX}`;
}

function inRange(text: string): boolean {
	return text.length >= DESC_MIN && text.length <= DESC_MAX && /[0-9]/.test(text);
}

function sentences(text: string): string[] {
	return (
		text
			.replace(/\s+/g, " ")
			.trim()
			.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? []
	)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** The meta description for a docs page: 140 to 160 characters with a number. */
export function docsSearchDescription(
	slug: readonly string[],
	description: string | undefined,
): string {
	const raw = (description ?? "").replace(/\s+/g, " ").trim();
	if (inRange(raw)) return raw;
	const kind = kindOf(slug);
	const tail =
		kind === "skill"
			? `One of ${COUNTS.skills} ${SITE.name} skills.`
			: kind === "agent"
				? `One of ${COUNTS.agents} ${SITE.name} agents.`
				: `${SITE.name}: ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks.`;
	const fillers = [
		"Free and open source.",
		"MIT licensed.",
		"Install once, use it in every project.",
		"Works in Claude Code, Cursor and Codex.",
	];
	const join = (parts: string[]) => parts.join(" ");

	// Routing lines ("Not for ...") help the model pick a skill; they are not
	// search copy, so they are dropped first.
	const pool = sentences(raw).filter((s) => !/^not for\b/i.test(s));
	const body: string[] = [];
	for (const s of pool) {
		if (join([...body, s, tail]).length <= DESC_MAX) body.push(s);
		else break;
	}
	if (body.length === 0 && pool.length > 0) {
		// One sentence longer than the budget: cut it at a word boundary.
		const budget = DESC_MAX - tail.length - 5;
		const cut = pool[0].slice(0, budget).replace(/\s+\S*$/, "").replace(/[,:;]$/, "");
		body.push(`${cut}...`);
	}
	let out = join([...body, tail]);
	for (const f of fillers) {
		if (out.length >= DESC_MIN) break;
		if (join([out, f]).length <= DESC_MAX) out = join([out, f]);
	}
	return out;
}
