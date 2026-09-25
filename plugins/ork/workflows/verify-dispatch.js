// verify-dispatch: the executor behind /ork:verify Phase 2 (parallel agent dispatch).
//
// Replaces "launch ALL agents in ONE message" prose with a script that owns the
// mechanical parts of Phase 2, so they hold whether or not a model remembers them:
//
//   Dispatch -> one agent per selected dimension (effort-scaled, SKILL.md STEP 0),
//               each returning a structured score with command-backed evidence
//   Refute   -> every decision-bearing finding (a critical blocker, or a score under
//               its rubric min_pass or min_blocker) goes to refuter agents that try
//               to DISPROVE it by running a command. Majority is counted against
//               the PLANNED votes: a dead, throwing or unrun refuter is a no.
//   Gate     -> plain code, no agent: the verdict CAP the evidence allows
//
// The contract this script enforces: it never returns a cap higher than the rules
// in SKILL.md and references/grading-rubric.md allow. Anything it cannot establish
// lowers the cap. It does NOT compute the weighted composite across the rubric
// dimensions; that is Phase 4 judgment, and Phase 4 grades within the cap.
//
// Run it via the Workflow tool from SKILL.md Phase 2:
//   Workflow({ scriptPath: "<this file>", args: { effort, dimensions, scope, rubric,
//              modelOverride, testEvidence: { outcome, exitCode, summaryLine } } })
//
// Workflow runtime notes: no fs/process in the script body; Date.now(),
// Math.random() and argless new Date() are forbidden (they break resume). The
// skill shell reads rubric.json and runs scripts/assert-evidence.sh, then passes
// both in as args.

export const meta = {
	name: "verify-dispatch",
	description:
		"Phase 2 of /ork:verify: dispatch the effort-scaled verification agents with an evidence schema, send every decision-bearing finding to refuter agents (majority of planned votes), and return the verdict cap the evidence allows. Unknown inputs, missing evidence and pending tests lower the cap; Phase 4 grades within it.",
	phases: [
		{ title: "Dispatch", detail: "one agent per selected dimension, structured score plus command-backed evidence" },
		{ title: "Refute", detail: "refuters try to disprove critical blockers and low scores; 1 vote at high, 3 at xhigh" },
		{ title: "Gate", detail: "verdict cap from test evidence, rubric thresholds, blockers, CLAIMED items and dead agents" },
	],
};

function parseMaybeJson(v, what) {
	if (typeof v !== "string") return v;
	if (!v.trim()) return undefined;
	try {
		return JSON.parse(v);
	} catch {
		throw new Error(`verify-dispatch: ${what} is not valid JSON`);
	}
}
const RAW = parseMaybeJson(args, "args");
const cfg = RAW && typeof RAW === "object" && !Array.isArray(RAW) ? RAW : {};

const reasons = [];
let cap = "READY FOR MERGE";
const RANK = { "READY FOR MERGE": 0, "IMPROVEMENTS RECOMMENDED": 1, BLOCKED: 2 };
const lower = (to, why) => {
	if (RANK[to] > RANK[cap]) cap = to;
	reasons.push(`${to}: ${why}`);
};

// SKILL.md "Phase 2 Agents (Quick Reference)", in dispatch priority order: security
// first, so a tight agent ceiling never drops the dimension with a hard blocker.
const AGENTS = [
	{ focus: "security", agentType: "ork:security-auditor", scope: "OWASP, secrets, CVEs" },
	{ focus: "quality", agentType: "ork:code-quality-reviewer", scope: "lint, types, patterns" },
	{ focus: "coverage", agentType: "ork:test-generator", scope: "coverage and test quality" },
	{ focus: "api", agentType: "ork:backend-system-architect", scope: "API design, async" },
	{ focus: "performance", agentType: "ork:python-performance-engineer", scope: "latency, resources, scaling" },
	{ focus: "ui", agentType: "ork:frontend-ui-developer", scope: "React 19, Zod, a11y" },
];
// Which rubric dimension each verifier's score is held to. api and ui are the
// compliance checks (references/report-template.md "API Compliance", "UI Compliance").
const RUBRIC_DIM = { security: "security", quality: "maintainability", coverage: "testability", api: "compliance", ui: "compliance", performance: "performance" };

// SKILL.md STEP 0 effort table: low = tests only, medium = 3 agents, high/xhigh = all.
const EFFORT_FOCUS = { low: [], medium: ["security", "quality", "coverage"], high: AGENTS.map((a) => a.focus), xhigh: AGENTS.map((a) => a.focus) };
let EFFORT = String(cfg.effort || "high").toLowerCase();
if (EFFORT === "max") EFFORT = "xhigh";
if (!Object.prototype.hasOwnProperty.call(EFFORT_FOCUS, EFFORT)) {
	log(`unknown effort "${cfg.effort}", using high`);
	EFFORT = "high";
}

let wanted = EFFORT_FOCUS[EFFORT];
if (Array.isArray(cfg.dimensions) && cfg.dimensions.length) {
	const names = cfg.dimensions.map((d) => String(d).toLowerCase());
	const unknown = names.filter((n) => !AGENTS.some((a) => a.focus === n));
	if (unknown.length) {
		log(`unknown dimension(s) ignored: ${unknown.join(", ")}`);
		lower("IMPROVEMENTS RECOMMENDED", `unknown dimension(s) requested: ${unknown.join(", ")}`);
	}
	wanted = names.filter((n) => !unknown.includes(n));
	if (!wanted.length) lower("BLOCKED", "a dimensions override selected no known verifier, nothing was verified");
}
const SELECTED = AGENTS.filter((a) => wanted.includes(a.focus));
const VOTES = EFFORT === "xhigh" ? 3 : EFFORT === "high" ? 1 : 0;
const maxArg = Number(cfg.maxAgents);
const MAX_AGENTS = Number.isFinite(maxArg) && cfg.maxAgents !== undefined && cfg.maxAgents !== null ? Math.max(1, Math.min(12, Math.floor(maxArg))) : 12;
const SCOPE = String(cfg.scope || "the current branch diff against its base");
const MODEL = cfg.modelOverride ? String(cfg.modelOverride) : undefined;

// Rubric: object or JSON text. Without dimensions, fall back to the two thresholds
// grading-rubric.md names (security min_blocker 4.0, compliance min_pass 6.0) and say so.
let rubric = parseMaybeJson(cfg.rubric, "rubric");
let rubricDims = Array.isArray(rubric?.dimensions) ? rubric.dimensions : [];
if (!rubricDims.length) {
	rubricDims = [
		{ name: "security", min_blocker: 4.0 },
		{ name: "compliance", min_pass: 6.0 },
	];
	log("rubric missing or empty, applying default thresholds (security min_blocker 4.0, compliance min_pass 6.0)");
	lower("IMPROVEMENTS RECOMMENDED", "rubric.json was not passed; default thresholds applied");
}
const threshold = (focus) => {
	const d = rubricDims.find((x) => x && x.name === RUBRIC_DIM[focus]);
	return { minPass: typeof d?.min_pass === "number" ? d.min_pass : null, minBlocker: typeof d?.min_blocker === "number" ? d.min_blocker : null };
};

const DIM_SCHEMA = {
	type: "object",
	properties: {
		score: { type: "number", minimum: 0, maximum: 10 },
		evidence: {
			type: "array",
			items: {
				type: "object",
				properties: { claim: { type: "string" }, command: { type: "string" }, exit: { type: "number" }, keyLine: { type: "string" } },
				required: ["claim"],
			},
		},
		blockers: {
			type: "array",
			items: {
				type: "object",
				properties: { issue: { type: "string" }, fileLine: { type: "string" }, severity: { type: "string", enum: ["critical", "high", "medium", "low"] } },
				required: ["issue", "severity"],
			},
		},
	},
	required: ["score", "evidence", "blockers"],
};
const VERDICT_SCHEMA = {
	type: "object",
	properties: {
		refuted: { type: "boolean" },
		reason: { type: "string" },
		command: { type: "string" },
		exit: { type: "number" },
		correctedScore: { type: "number", minimum: 0, maximum: 10 },
	},
	required: ["refuted", "reason"],
};

// Agent budget: dispatch slots are reserved up front, refuters share what is left.
const dispatchSlots = Math.min(SELECTED.length, MAX_AGENTS);
let refuteLeft = MAX_AGENTS - dispatchSlots;
const dropped = [];
let spent = 0;
const opts = (extra) => (MODEL ? { ...extra, model: MODEL } : extra);

function dispatchPrompt(a) {
	return [
		`You are the ${a.focus} verifier for /ork:verify. Scope: ${SCOPE}. Focus: ${a.scope}.`,
		"Score this dimension 0-10. Every evidence item must name the command you ran this session,",
		"its exit code, and the one output line that proves the claim. An item you could not back",
		"with a command you ran is allowed, but leave command empty: it will be reported as CLAIMED.",
		"List blockers only for defects you can point to at file:line, with a severity.",
	].join("\n");
}

function refutePrompt(a, finding, vote) {
	return [
		`Refuter ${vote + 1} of ${VOTES} for the ${a.focus} dimension of /ork:verify. Scope: ${SCOPE}.`,
		"Try to DISPROVE this finding by running a command against the real tree:",
		JSON.stringify(finding),
		"refuted=true only when a command you ran shows the finding is wrong; cite it in command/exit.",
		finding.kind === "score" ? "For a score finding, refuted=true also requires correctedScore: the score your command supports." : "",
		"If you cannot run a disproving command, refuted=false. Do not argue from reading alone.",
	].filter(Boolean).join("\n");
}

async function refute(a, finding) {
	const votes = [];
	for (let v = 0; v < VOTES; v++) {
		if (refuteLeft <= 0) {
			dropped.push(`refute:${a.focus}:${finding.kind}:${v + 1}`);
			log(`agent ceiling ${MAX_AGENTS} reached, refuter ${v + 1} for ${a.focus} ${finding.kind} not spawned (counts as not refuted)`);
			continue;
		}
		refuteLeft -= 1;
		spent += 1;
		try {
			const r = await agent(refutePrompt(a, finding, v), opts({ label: `refute:${a.focus}`, phase: "Refute", schema: VERDICT_SCHEMA, agentType: a.agentType }));
			if (r) votes.push(r);
		} catch (e) {
			log(`refuter ${v + 1} for ${a.focus} failed (counts as not refuted): ${e && e.message ? e.message : e}`);
		}
	}
	const yes = votes.filter((r) => r.refuted === true && r.command && (finding.kind !== "score" || typeof r.correctedScore === "number"));
	const refuted = VOTES > 0 && yes.length * 2 > VOTES; // majority of PLANNED votes
	const corrected = refuted && finding.kind === "score" ? Math.min(...yes.map((r) => r.correctedScore)) : null;
	return { refuted, corrected, votes: votes.length, planned: VOTES };
}

log(`effort=${EFFORT}, ${SELECTED.length} verifier(s), ${VOTES} refuter vote(s) per finding, ceiling ${MAX_AGENTS} agents`);

const results = await pipeline(
	SELECTED,
	(a, _item, i) => {
		if (i >= dispatchSlots) {
			dropped.push(`dispatch:${a.focus}`);
			log(`agent ceiling ${MAX_AGENTS} reached, verifier ${a.focus} not spawned`);
			return null;
		}
		spent += 1;
		return agent(dispatchPrompt(a), opts({ label: `dispatch:${a.focus}`, phase: "Dispatch", schema: DIM_SCHEMA, agentType: a.agentType }));
	},
	async (res, a) => {
		if (!res) return { focus: a.focus, agentType: a.agentType, outcome: "NO-RESULT", score: null, effectiveScore: null, evidence: [], blockers: [], refuted: [], claimed: [] };
		const t = threshold(a.focus);
		const findings = res.blockers.filter((b) => b.severity === "critical").map((b) => ({ kind: "blocker", ...b }));
		const low = (t.minBlocker !== null && res.score < t.minBlocker) || (t.minPass !== null && res.score < t.minPass);
		if (low) findings.push({ kind: "score", score: res.score, minPass: t.minPass, minBlocker: t.minBlocker });
		const refuted = [];
		const keptCritical = [];
		let effectiveScore = res.score;
		for (const f of findings) {
			const r = VOTES > 0 ? await refute(a, f) : { refuted: false, corrected: null, votes: 0, planned: 0 };
			if (r.refuted) {
				refuted.push({ ...f, votes: r.votes, planned: r.planned, correctedScore: r.corrected });
				if (f.kind === "score") effectiveScore = Math.max(res.score, r.corrected);
			} else if (f.kind === "blocker") keptCritical.push(f);
		}
		return {
			focus: a.focus,
			agentType: a.agentType,
			outcome: "SCORED",
			score: res.score,
			effectiveScore,
			evidence: res.evidence,
			blockers: [...keptCritical, ...res.blockers.filter((b) => b.severity !== "critical")],
			refuted,
			backed: res.evidence.filter((e) => e.command).length,
			claimed: res.evidence.filter((e) => !e.command).map((e) => e.claim),
		};
	},
);

phase("Gate");
const agents = results.filter(Boolean);

for (const a of agents) {
	if (a.outcome === "NO-RESULT") {
		lower("IMPROVEMENTS RECOMMENDED", `${a.focus}: verifier returned no result`);
		continue;
	}
	const t = threshold(a.focus);
	if (t.minBlocker !== null && a.effectiveScore < t.minBlocker) lower("BLOCKED", `${a.focus} ${a.effectiveScore}/10 below min_blocker ${t.minBlocker}`);
	else if (t.minPass !== null && a.effectiveScore < t.minPass) lower("IMPROVEMENTS RECOMMENDED", `${a.focus} ${a.effectiveScore}/10 below min_pass ${t.minPass}`);
	for (const b of a.blockers) {
		const where = b.fileLine ? ` (${b.fileLine})` : "";
		if (b.severity === "critical") lower("BLOCKED", `${a.focus}: critical blocker not refuted: ${b.issue}${where}`);
		else if (b.severity === "high") lower("IMPROVEMENTS RECOMMENDED", `${a.focus}: high blocker: ${b.issue}${where}`);
	}
	if (a.backed === 0) lower("IMPROVEMENTS RECOMMENDED", `${a.focus}: score has no command-backed evidence`);
	if (a.claimed.length) lower("IMPROVEMENTS RECOMMENDED", `${a.focus}: ${a.claimed.length} CLAIMED item(s) without a command`);
}
for (const f of SELECTED.filter((a) => !agents.some((r) => r.focus === a.focus))) {
	lower("IMPROVEMENTS RECOMMENDED", `${f.focus}: no result`);
}
if (dropped.length) lower("IMPROVEMENTS RECOMMENDED", `${dropped.length} agent spawn(s) dropped at the ${MAX_AGENTS}-agent ceiling`);

// Tests (SKILL.md Phase 3): only outcome=EVIDENCE from scripts/assert-evidence.sh with
// exit 0 may pass. Phase 3 usually runs alongside this dispatch, so testEvidence is
// optional; without it the cap is PENDING-TESTS and capIfTestsPass says what applies
// once the gate reports EVIDENCE with exit 0 (anything else there is BLOCKED).
const capExcludingTests = cap;
const te = cfg.testEvidence && typeof cfg.testEvidence === "object" ? cfg.testEvidence : null;
let tests;
if (!te) {
	tests = { outcome: "PENDING", exitCode: null, summaryLine: "" };
	reasons.push("PENDING-TESTS: run scripts/assert-evidence.sh; EVIDENCE with exit 0 gives capIfTestsPass, anything else is BLOCKED");
} else {
	tests = { outcome: String(te.outcome || "COULD-NOT-OBSERVE"), exitCode: typeof te.exitCode === "number" ? te.exitCode : null, summaryLine: String(te.summaryLine || "") };
	if (tests.outcome !== "EVIDENCE") lower("BLOCKED", `Tests: ${tests.outcome}, no grade from an unobserved run`);
	else if (tests.exitCode !== 0) lower("BLOCKED", `Tests: EVIDENCE with exit ${tests.exitCode === null ? "unknown (pass exitCode from the EXIT= marker)" : tests.exitCode}`);
}

return {
	status: "dispatched",
	effort: EFFORT,
	verdictCap: te ? cap : "PENDING-TESTS",
	capIfTestsPass: te ? null : capExcludingTests,
	reasons,
	tests,
	agents,
	agentsSpawned: spent,
	dropped,
};
