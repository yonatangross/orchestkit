// brainstorm-diverge: the executor behind /ork:brainstorm Phase 2 (divergent
// exploration), run at effort low.
//
// claude.dev "Spending your effort": low effort is right for in-the-loop
// brainstorming and sketches, where the point is to see many ideas fast.
// Evaluation is the opposite kind of work, so it keeps the session effort.
//
// Claude Code cannot express that split anywhere else:
//   - skill `effort:` frontmatter covers the WHOLE skill (for a `context: fork`
//     skill it sets the fork's effort), so `effort: low` on brainstorm would also
//     run Phase 4 devil's-advocate scoring at low;
//   - the Agent tool takes a per-call `model`, but no per-call `effort`;
//   - agent() in a Workflow script takes `effort` per call.
// So Phase 2 runs here, every generator at effort low, and Phases 3 to 6 stay in
// the SKILL.md shell at the session effort.
//
//   Diverge -> one generator per selected perspective (Phase 0 agents), each
//              returning raw ideas in a fixed schema. No scores, no filtering.
//   Pool    -> plain code, no agent: dedup by normalised title, keep every
//              perspective that raised an idea, flag a short pool.
//   Top-up  -> one extra low-effort round when the pool is under the target,
//              told which titles already exist. Never more than one.
//
// Run it via the Workflow tool from SKILL.md Phase 2:
//   Workflow({ scriptPath: "<this file>", args: { topic, tier, ceiling, agents,
//              constraints, minIdeas, modelOverride } })
//
// It returns data and never asks the user: tier questions, constraint questions
// and the Phase 3 gate all stay in the SKILL.md shell.
//
// Workflow runtime notes: no fs/process in the script body; Date.now(),
// Math.random() and argless new Date() are forbidden (they break resume).

export const meta = {
	name: "brainstorm-diverge",
	description:
		"Phase 2 of /ork:brainstorm at effort low: one idea generator per selected perspective (workflow-architect and test-generator always included), raw ideas in a fixed schema, deduplicated into one pool with at most one top-up round. Never scores or filters; evaluation stays at the session effort.",
	phases: [
		{ title: "Diverge", detail: "one low-effort generator per perspective, no filtering" },
		{ title: "Top-up", detail: "one extra low-effort round only when the pool is under the target" },
	],
};

// The divergent phase is the one place brainstorm spends low effort. Every
// agent() call below passes this; the unit test asserts it.
const DIVERGE_EFFORT = "low";

function parseMaybeJson(v, what) {
	if (typeof v !== "string") return v;
	if (!v.trim()) return undefined;
	try {
		return JSON.parse(v);
	} catch {
		throw new Error(`brainstorm-diverge: ${what} is not valid JSON`);
	}
}
const RAW = parseMaybeJson(args, "args");
const cfg = RAW && typeof RAW === "object" && !Array.isArray(RAW) ? RAW : {};
const reasons = [];

const TOPIC = String(cfg.topic || "").trim();
if (!TOPIC) throw new Error("brainstorm-diverge: args.topic is required");
const TIER = String(cfg.tier || "unknown");
const CEILING = String(cfg.ceiling || "No complexity ceiling was passed; prefer the simplest approach that works.");
const CONSTRAINTS = String(cfg.constraints || "None stated.");
const MODEL = cfg.modelOverride ? String(cfg.modelOverride) : undefined;
const minArg = Number(cfg.minIdeas);
const MIN_IDEAS = Number.isFinite(minArg) && minArg > 0 ? Math.floor(minArg) : 10;

// phase-workflow.md Phase 0 Step 2: workflow-architect and test-generator are
// always in the room. Missing ones are added, toward coverage.
const ALWAYS = ["ork:workflow-architect", "ork:test-generator"];
const agentsRaw = parseMaybeJson(cfg.agents, "agents");
const asked = (Array.isArray(agentsRaw) ? agentsRaw : typeof agentsRaw === "string" ? agentsRaw.split(/[\n,]/) : [])
	.map((a) => String(a).trim())
	.filter(Boolean)
	.map((a) => (a.includes(":") ? a : `ork:${a}`));
const PERSPECTIVES = [...new Set([...ALWAYS, ...asked])];
for (const a of ALWAYS) if (!asked.includes(a)) reasons.push(`note: added ${a}, Phase 0 always includes it`);

const IDEAS_SCHEMA = {
	type: "object",
	properties: {
		status: { type: "string", enum: ["DONE", "PARTIAL", "BLOCKED"] },
		ideas: {
			type: "array",
			items: {
				type: "object",
				properties: {
					title: { type: "string" },
					sketch: { type: "string" },
					unconventional: { type: "boolean" },
				},
				required: ["title", "sketch"],
			},
		},
	},
	required: ["status", "ideas"],
};

const opts = (extra) => ({ ...extra, effort: DIVERGE_EFFORT, ...(MODEL ? { model: MODEL } : {}) });

function divergePrompt(perspective, existing) {
	return [
		`DIVERGENT MODE for: ${TOPIC}`,
		`Perspective: ${perspective}`,
		"",
		`PROJECT TIER: ${TIER}`,
		`COMPLEXITY CEILING: ${CEILING}`,
		`CONSTRAINTS: ${CONSTRAINTS}`,
		"",
		"Generate as many distinct approaches as you can, at least 3 or 4.",
		"- Do NOT filter, score or critique. Evaluation happens later, in another phase.",
		"- Include at least one unconventional approach and mark it unconventional=true.",
		"- Each idea is a short title plus a two or three sentence sketch.",
		"- Do NOT suggest patterns that exceed the complexity ceiling.",
		existing.length ? `These titles are already in the pool; propose different ones:\n${existing.map((t) => `- ${t}`).join("\n")}` : "",
		"status is DONE, PARTIAL (you stopped early) or BLOCKED (you could not generate ideas).",
	]
		.filter((l) => l !== "")
		.join("\n");
}

const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const pool = new Map();
const perspectives = [];

function absorb(res, perspective, round) {
	const status = res && typeof res.status === "string" ? res.status : null;
	if (!res || !Array.isArray(res.ideas) || status === "BLOCKED") {
		perspectives.push({ perspective, round, outcome: "NO-IDEAS", status, ideas: 0 });
		return;
	}
	let fresh = 0;
	for (const raw of res.ideas) {
		const title = raw && typeof raw.title === "string" ? raw.title.trim() : "";
		if (!title) continue;
		const key = norm(title);
		const prev = pool.get(key);
		if (prev) {
			if (!prev.raisedBy.includes(perspective)) prev.raisedBy.push(perspective);
			continue;
		}
		pool.set(key, {
			title,
			sketch: String((raw && raw.sketch) || ""),
			unconventional: raw && raw.unconventional === true,
			raisedBy: [perspective],
			partial: status === "PARTIAL",
			round,
		});
		fresh += 1;
	}
	perspectives.push({ perspective, round, outcome: status === "PARTIAL" ? "PARTIAL" : "DONE", status, ideas: fresh });
}

log(`topic="${TOPIC}", ${PERSPECTIVES.length} perspective(s) at effort ${DIVERGE_EFFORT}, target ${MIN_IDEAS} ideas`);

phase("Diverge");
await pipeline(
	PERSPECTIVES,
	// A throwing generator is recorded as NO-IDEAS, not dropped from the report.
	(p) =>
		agent(divergePrompt(p, []), opts({ label: `diverge:${p}`, phase: "Diverge", schema: IDEAS_SCHEMA, agentType: p })).catch((e) => {
			log(`generator ${p} failed: ${e && e.message ? e.message : e}`);
			return null;
		}),
	(res, p) => absorb(res, p, 1),
);

let toppedUp = false;
if (pool.size < MIN_IDEAS) {
	phase("Top-up");
	toppedUp = true;
	const lead = PERSPECTIVES[0];
	log(`pool has ${pool.size} of ${MIN_IDEAS} ideas, one top-up round from ${lead}`);
	const existing = [...pool.values()].map((i) => i.title);
	const res = await agent(divergePrompt(lead, existing), opts({ label: `top-up:${lead}`, phase: "Top-up", schema: IDEAS_SCHEMA, agentType: lead })).catch((e) => {
		log(`top-up failed: ${e && e.message ? e.message : e}`);
		return null;
	});
	absorb(res, lead, 2);
}

const ideas = [...pool.values()];
const short = ideas.length < MIN_IDEAS;
if (short) reasons.push(`short: ${ideas.length} of ${MIN_IDEAS} ideas after ${toppedUp ? "one top-up round" : "the first round"}; tell the user before Phase 3`);
const silent = perspectives.filter((p) => p.round === 1 && p.outcome === "NO-IDEAS").map((p) => p.perspective);
if (silent.length) reasons.push(`missing: ${silent.join(", ")} returned no ideas`);
const partial = ideas.filter((i) => i.partial).length;
if (partial) reasons.push(`partial: ${partial} idea(s) came from a PARTIAL generator, give them extra scrutiny in Phase 3`);

return {
	status: ideas.length ? "diverged" : "empty",
	topic: TOPIC,
	effort: DIVERGE_EFFORT,
	minIdeas: MIN_IDEAS,
	short,
	toppedUp,
	ideas,
	perspectives,
	reasons,
};
