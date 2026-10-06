// Data for the per-page link cards drawn by app/api/og/[...slug]/route.tsx.
// Everything here is read from the page's own .mdx body: a skill card shows the
// skill's OWN example output (the first fenced block in its "## Examples"
// section), an agent card shows its real tool list and the agents it delegates
// to (its `Agent(ork:...)` entries). Nothing is invented: a page without an
// example falls back to its invoke command, an agent without delegations says so.

export type CardKind = "skill" | "agent" | "doc";

export interface SkillCardData {
	verdict: string;
	uses: string[];
	sample: string[];
	sampleIsInvoke: boolean;
}

export interface AgentCardData {
	line: string;
	tools: string[];
	moreTools: number;
	delegates: string[];
}

const SAMPLE_LINES = 14;
const SAMPLE_COLS = 52;

export function cardKind(slug: string[] | undefined): CardKind {
	if (slug?.[0] === "reference" && slug[1] === "skills" && slug[2]) return "skill";
	if (slug?.[0] === "reference" && slug[1] === "agents" && slug[2]) return "agent";
	return "doc";
}

// Cut text at a word boundary so it fits `max` characters.
export function clip(text: string, max: number): string {
	const t = text.trim();
	if (t.length <= max) return t;
	const cut = t.slice(0, max - 1);
	const at = cut.lastIndexOf(" ");
	return `${(at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[,;:]$/, "")}...`;
}

// The first sentence of a description, shortened at its first colon when long.
export function verdictOf(description: string, max = 92): string {
	const first = description.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
	if (first.length <= max) return first;
	const colon = first.indexOf(":");
	if (colon > 20 && colon <= max) return first.slice(0, colon);
	return clip(first, max);
}

// "Use for a, b, c, d." in the description becomes up to two short lines.
export function usesOf(description: string, body: string, perLine = 34): string[] {
	const use = description.match(/\bUse (?:for|when|to|it for)\b[^.]*?(?::\s*|\s)([^.]+)\./i);
	if (use) {
		const items = use[1]
			.split(/,\s*|\s+or\s+|\s+and\s+/)
			.map((s) => s.trim().replace(/^any\s+/, ""))
			.filter((s) => s && s.length < 40 && !/^['"]/.test(s));
		const lines: string[] = [];
		let cur: string[] = [];
		for (const it of items) {
			const next = [...cur, it].join(", ");
			if (next.length > perLine && cur.length) {
				lines.push(cur.join(", "));
				cur = [it];
				if (lines.length === 2) break;
			} else cur.push(it);
		}
		if (lines.length < 2 && cur.length) lines.push(cur.join(", "));
		if (lines.length) return lines.slice(0, 2);
	}
	const heads = [...examplesSection(body).matchAll(/^###\s+(.+)$/gm)].map((m) => clip(m[1], perLine));
	return heads.slice(0, 2);
}

function examplesSection(body: string): string {
	const m = body.match(/^##\s+Examples?\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
	return m ? m[1] : "";
}

function fencedBlocks(text: string): { info: string; lines: string[] }[] {
	const out: { info: string; lines: string[] }[] = [];
	const re = /^```([^\n]*)\n([\s\S]*?)^```/gm;
	for (let m = re.exec(text); m; m = re.exec(text)) out.push({ info: m[1].trim(), lines: m[2].replace(/\s+$/, "").split("\n") });
	return out;
}

function invokeOf(body: string): string | null {
	const b = fencedBlocks(body).find((x) => /title="Invoke"/.test(x.info));
	return b ? b.lines.join(" ").trim() : null;
}

export function skillCard(description: string, body: string): SkillCardData {
	const blocks = fencedBlocks(examplesSection(body)).filter((b) => !/title="Invoke"/.test(b.info) && b.lines.some((l) => l.trim()));
	const pick = blocks[0] ?? fencedBlocks(body).find((b) => !/title="Invoke"/.test(b.info) && b.lines.some((l) => l.trim()));
	const verdict = verdictOf(description);
	const uses = usesOf(description, body);
	if (pick) {
		const lines = pick.lines.slice(0, SAMPLE_LINES).map((l) => [...l].slice(0, SAMPLE_COLS).join("").replace(/\s+$/, ""));
		return { verdict, uses, sample: lines, sampleIsInvoke: false };
	}
	const inv = invokeOf(body);
	return { verdict, uses, sample: inv ? [inv] : [], sampleIsInvoke: true };
}

export function agentCard(description: string, body: string, shown = 7): AgentCardData {
	const sec = body.match(/^##\s+Tools Available\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m)?.[1] ?? "";
	const all = [...sec.matchAll(/^-\s+`([^`]+)`/gm)].map((m) => m[1]);
	const delegates = all.map((t) => t.match(/^Agent\((?:ork:)?([^)]+)\)$/)?.[1]).filter((x): x is string => Boolean(x));
	const plain = all.filter((t) => !t.startsWith("Agent(") && !t.startsWith("mcp__"));
	const after = description.includes(":") ? description.slice(description.indexOf(":") + 1) : description;
	return { line: clip(after.replace(/\.$/, ""), 64), tools: plain.slice(0, shown), moreTools: Math.max(0, plain.length - shown), delegates };
}
