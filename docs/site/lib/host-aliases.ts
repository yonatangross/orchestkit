// Host-name aliases for docs search. Short queries like "pi" must pin a host
// page instead of infix-matching PII / Pixel / pipeline.

export const HOST_ALIAS_BONUS = 3000;

/** Lowercase query (or compact form) -> host docs URL. */
export const HOST_ALIASES: Readonly<Record<string, string>> = {
	pi: "/docs/getting-started/skills-sh",
	muse: "/docs/getting-started/muse",
	musecode: "/docs/getting-started/muse",
	"muse-code": "/docs/getting-started/muse",
	"muse code": "/docs/getting-started/muse",
	opencode: "/docs/getting-started/skills-sh",
	codex: "/docs/getting-started/codex",
	cursor: "/docs/getting-started/cursor",
	claude: "/docs/getting-started/claude-code",
	"claude-code": "/docs/getting-started/claude-code",
	claudecode: "/docs/getting-started/claude-code",
	skillssh: "/docs/getting-started/skills-sh",
	"skills-sh": "/docs/getting-started/skills-sh",
	"skills.sh": "/docs/getting-started/skills-sh",
};

function compactQuery(query: string): string {
	return query.trim().toLowerCase().replace(/[\s.]+/g, "");
}

/** Canonical host URL for a query, if the query is a known host name. */
export function hostAliasUrl(query: string): string | undefined {
	const raw = query.trim().toLowerCase();
	if (!raw) return undefined;
	if (HOST_ALIASES[raw]) return HOST_ALIASES[raw];
	const compact = compactQuery(query);
	if (HOST_ALIASES[compact]) return HOST_ALIASES[compact];
	const first = raw.split(/[^a-z0-9]+/).find(Boolean);
	if (first && first !== raw && HOST_ALIASES[first] && raw.split(/[^a-z0-9]+/).filter(Boolean).length === 1) {
		return HOST_ALIASES[first];
	}
	return undefined;
}

export function hostAliasBonus(query: string, url: string): number {
	const target = hostAliasUrl(query);
	if (!target) return 0;
	const path = url.replace(/^https?:\/\/[^/]+/, "");
	return path === target ? HOST_ALIAS_BONUS : 0;
}

/** True when `query` appears as a whole word in `text` (Algolia prefix-from-start). */
export function hasWholeWord(query: string, text: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return false;
	const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}

/**
 * Short queries (< 4 chars) must not rank on mid-word title matches.
 * Keep the hit when it is a host alias, when the title does not contain the
 * query at all (body match / ranking fixture), or when the title has it as a word.
 */
export function passesShortQueryInfix(
	query: string,
	title: string,
	url: string,
): boolean {
	if (query.trim().length >= 4) return true;
	if (hostAliasBonus(query, url) > 0) return true;
	const q = query.trim().toLowerCase();
	if (!title.toLowerCase().includes(q)) return true;
	return hasWholeWord(query, title);
}
