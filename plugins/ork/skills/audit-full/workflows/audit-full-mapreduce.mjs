// audit-full-mapreduce — dynamic-workflow harness (template).
//
// The SCALE tier for /ork:audit-full. The skill's default is a single-context
// Opus-1M pass (its edge: whole-codebase cross-file reasoning in one window).
// When STEP 1's token estimate EXCEEDS that budget (~125K LOC / repos that one
// context can't hold), the skill used to PUNT to /ork:verify. This is the proper
// in-skill alternative: map-reduce the audit while preserving as much cross-file
// reasoning as sharding allows.
//
//   Shard-audit  → one ISOLATED-context agent per shard runs the real
//                  security/architecture/dependency analysis on that shard
//   Synthesize   → merge + dedupe shard findings, THEN a cross-shard boundary
//                  pass (the import / data-flow / auth-boundary edges that
//                  sharding splits — sharding's blind spot, recovered here)
//   Refute       → blind adversarial refuters on CRITICAL/HIGH (the shared
//                  engine's rules: blind, citation-verify, quorum, deterministic
//                  exemption, spawn-ceiling). Mirrors the single-context STEP 3.5.
//
// Distribution: shipped template-in-skill (same pattern as bare-eval/skill-fitness).
// Run it via the Workflow tool — treat as a TEMPLATE, pass shards/mode per use:
//   Workflow({ scriptPath: "<this file>", args: { shards: ["apps/api","apps/web"], mode: "full", effort: "high" } })
//
// COST: each shard agent is a real reading+reasoning pass (tens of K tokens per
// shard); refuters add more. Pass an explicit shard list + token budget rather
// than running blind on a huge repo. The single-context path is cheaper when it
// fits — only reach for this tier when it genuinely doesn't.
//
// Workflow runtime notes: no fs/process/Date.now in the SCRIPT body; spawned
// AGENTS read files via their Read tool (cwd = repo root → use REPO-RELATIVE
// paths, never absolute user paths, which break on other installs).

export const meta = {
	name: "audit-full-mapreduce",
	description:
		"Scale tier for /ork:audit-full: shard a too-big codebase, audit each shard in an isolated context, synthesize with a cross-shard boundary pass, then adversarially refute CRITICAL/HIGH.",
	phases: [
		{
			title: "Shard-audit",
			detail:
				"one isolated-context agent per shard runs security/architecture/dependency analysis",
		},
		{
			title: "Synthesize",
			detail:
				"merge + dedupe, then a cross-shard boundary pass for edges sharding splits",
		},
		{
			title: "Refute",
			detail:
				"blind adversarial refuters on CRITICAL/HIGH per the shared engine",
		},
	],
};

// args may arrive as a STRING (memory: feedback_workflow_authoring_gotchas) — guard it.
const RAW = typeof args === "string" && args.trim() ? JSON.parse(args) : args;
const cfg = Array.isArray(RAW)
	? { shards: RAW }
	: RAW && typeof RAW === "object"
		? RAW
		: {};
const SHARDS =
	Array.isArray(cfg.shards) && cfg.shards.length ? cfg.shards : ["src"];
const MODE = cfg.mode || "full"; // full | security | architecture | dependencies
// Specialist routing (#2371 follow-up): security-mode stages have an obvious
// owner — run them as ork:security-auditor (curated red-team prompt) instead
// of the generic workflow subagent. Mixed modes stay generic on purpose:
// forcing a specialist onto a cross-domain task is worse than the default.
const STAGE_AGENT =
	MODE === "security" ? { agentType: "ork:security-auditor" } : {};
const EFFORT = cfg.effort || "high"; // high → single advisory refuters; xhigh → quorum
const REFUTER_CEILING = 24; // engine §8 global spawn ceiling

if (!Array.isArray(cfg.shards) || !cfg.shards.length) {
	log(
		`WARN: no shards passed — defaulting to ["src"]. Pass {shards:[...]} derived from STEP 1's estimate for a real run.`,
	);
}
log(
	`audit-full-mapreduce: ${SHARDS.length} shard(s) · mode=${MODE} · effort=${EFFORT}`,
);

// Small schemas — big StructuredOutput schemas flake on heavy agents (memory). Keep tight.
const FINDING = {
	type: "object",
	additionalProperties: false,
	properties: {
		severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
		category: { type: "string" }, // e.g. owasp-a01, circular-dep, cve, license
		file: { type: "string" }, // repo-relative
		line: { type: "integer" },
		title: { type: "string" },
		evidence: { type: "string" }, // short, cited
		deterministic: { type: "boolean" }, // true = CVE/build/test ground truth (refutation-exempt)
	},
	required: [
		"severity",
		"category",
		"file",
		"title",
		"evidence",
		"deterministic",
	],
};
const SHARD_RESULT = {
	type: "object",
	additionalProperties: false,
	properties: {
		shard: { type: "string" },
		findings: { type: "array", items: FINDING },
	},
	required: ["shard", "findings"],
};
const VERDICT = {
	type: "object",
	additionalProperties: false,
	properties: {
		independent_severity: {
			type: "string",
			enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"],
		},
		citation_verified: { type: "boolean" },
		outcome: { type: "string", enum: ["upheld", "downgraded", "refuted"] },
		reason: { type: "string" },
	},
	required: ["independent_severity", "citation_verified", "outcome", "reason"],
};

const modeFocus =
	MODE === "security"
		? "security only (OWASP, injection, auth boundaries, secrets, data-flow)"
		: MODE === "architecture"
			? "architecture only (dependency direction, cycles, layer violations, coupling)"
			: MODE === "dependencies"
				? "dependencies only (CVEs, licenses, currency, transitive risk, unused)"
				: "security + architecture + dependencies";

phase("Shard-audit");

// BARRIER: synthesis needs ALL shard findings for the cross-boundary pass.
const shardResults = (
	await parallel(
		SHARDS.map(
			(shard) => () =>
				agent(
					`Audit the codebase shard at repo-relative path "${shard}". Focus: ${modeFocus}.
Read the files under "${shard}" yourself (cwd = repo root; use repo-relative paths). Do the
real cross-file analysis WITHIN this shard: trace user input → sink, verify auth boundaries,
detect injection surfaces, import cycles, layer violations, CVE/license issues. Mark a finding
deterministic=true ONLY for ground truth (a CVE/CVSS match, a failing build/test, a type error)
— everything else (reachability/exploitability claims, design judgments) is deterministic=false.
Cite file:line with a SHORT evidence slice. Report only real findings; do not pad.`,
					{
						...STAGE_AGENT,
						label: `shard:${shard}`,
						phase: "Shard-audit",
						schema: SHARD_RESULT,
					},
				),
		),
	)
).filter(Boolean);

const allFindings = shardResults.flatMap((r) => r.findings);
log(
	`Shard-audit done: ${allFindings.length} raw findings across ${shardResults.length} shard(s)`,
);

phase("Synthesize");

// Cross-shard boundary pass — the one thing sharding loses. Give synthesis the per-shard
// findings + the shard list so it can reason about edges that CROSS shard boundaries
// (a route in shard A whose handler is in shard B, taint that flows across modules).
const synthesis = await agent(
	`You are synthesizing a sharded audit into one report. Shards: ${JSON.stringify(SHARDS)}.
Per-shard findings (JSON): ${JSON.stringify(allFindings).slice(0, 9000)}

Do two things:
1. DEDUPE to root cause — collapse the same issue reported by multiple shards into one finding.
2. CROSS-SHARD BOUNDARY PASS — the deliberate recovery of sharding's blind spot: identify
   vulnerabilities/violations whose pieces live in DIFFERENT shards (an entry point in one
   shard reaching a sink in another, an auth check skipped across a module boundary, a
   dependency-direction violation spanning shards). Add these as new findings; mark them
   cross_shard in the title.
Return the merged finding set. Preserve each finding's deterministic flag (do not invent
deterministic=true). Keep severities honest.`,
	{
		label: "cross-boundary-synthesis",
		phase: "Synthesize",
		model: "opus", // synthesis + cross-cutting reasoning → opus (per dynamic-workflow-patterns model tiers)
		schema: {
			type: "object",
			additionalProperties: false,
			properties: { findings: { type: "array", items: FINDING } },
			required: ["findings"],
		},
	},
);

const merged = synthesis.findings;
// Decision-bearing + refutable only: CRITICAL/HIGH that are NOT deterministic ground truth (engine §6).
const refutable = merged.filter(
	(f) =>
		(f.severity === "CRITICAL" || f.severity === "HIGH") && !f.deterministic,
);

phase("Refute");

// Spawn-ceiling (engine §8): rank by severity, refute top-K, flag the overflow — never silently truncate.
const ranked = refutable.sort(
	(a, b) =>
		(a.severity === "CRITICAL" ? -1 : 1) - (b.severity === "CRITICAL" ? -1 : 1),
);
const toRefute = ranked.slice(0, REFUTER_CEILING);
const overflow = ranked.slice(REFUTER_CEILING);
if (overflow.length)
	log(
		`Refuter ceiling ${REFUTER_CEILING} hit — ${overflow.length} finding(s) shipped "not independently refuted; manual review required".`,
	);

const votesPerFinding = EFFORT === "xhigh" ? 3 : 1; // engine §4 quorum at xhigh; advisory single at high

const refuted = await parallel(
	toRefute.map(
		(f) => () =>
			parallel(
				Array.from(
					{
						length:
							f.severity === "CRITICAL"
								? votesPerFinding
								: Math.min(votesPerFinding, 2),
					},
					(_unused, i) => () =>
						agent(
							`Adversarially verify a single audit finding. You are BLIND to the producer's reasoning.
Category: ${f.category}. Location: ${f.file}:${f.line ?? "?"}.
Open that file:line YOURSELF and form your OWN severity from the evidence. Default to refuting
if you cannot reproduce the issue from the cited location. If the finding asserts a flow that
spans files you cannot see, return upheld (do not refute what you simply couldn't trace).
Return your independent severity, whether the citation checks out, and the outcome.`,
							{
								...STAGE_AGENT,
								label: `refute:${f.file}#${i + 1}`,
								phase: "Refute",
								schema: VERDICT,
							},
						),
				),
			).then((vs) => {
				const v = vs.filter(Boolean);
				const verified = v.filter((x) => x.citation_verified);
				// Majority of VERIFIED refutations to overturn; a lone/ unverified vote never flips (engine §3,§4).
				const refutes = verified.filter((x) => x.outcome === "refuted").length;
				const overturned =
					verified.length >= votesPerFinding
						? refutes >= Math.ceil(votesPerFinding / 2)
						: false;
				return {
					...f,
					refutation: {
						votes: v.length,
						verified: verified.length,
						refutes,
						outcome: overturned ? "refuted" : "upheld",
					},
				};
			}),
	),
);

const confirmed = refuted.filter(Boolean);
const killed = confirmed.filter((f) => f.refutation.outcome === "refuted");
log(
	`Refute done: ${confirmed.length - killed.length} upheld · ${killed.length} flagged refuted (NOT auto-dropped — engine §7 needs user confirm)`,
);

// No-auto-flip (engine §7): refuted CRITICAL/HIGH are FLAGGED, not silently removed.
return {
  mode: MODE,
  shards: SHARDS,
  totals: {
    raw: allFindings.length,
    merged: merged.length,
    critical: merged.filter((f) => f.severity === 'CRITICAL').length,
    high: merged.filter((f) => f.severity === 'HIGH').length,
    refuted_flagged: killed.length,
    unrefuted_overflow: overflow.length,
  },
  findings: merged,
  refutation_ledger: confirmed.map((f) => ({ file: f.file, line: f.line, severity: f.severity, ...f.refutation })),
  note: 'Refuted CRITICAL/HIGH are flagged, not auto-removed (engine §7). Deterministic CVE/build/test findings were refutation-exempt (§6).',
}
