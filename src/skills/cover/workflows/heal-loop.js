// heal-loop: the executor behind /ork:cover Phase 5.
//
// Replaces the old prose pseudocode (`for iteration in range(3)`) with a REAL
// bounded loop. The iteration ceiling is enforced HERE, by the script, not by an
// instruction a model may drift past.
//
// Per iteration:
//   Diagnose → one agent RUNS the test command and returns structured pass/fail
//              plus the verbatim failure output and a per-failure classification
//              from references/heal-loop-strategy.md
//   Repair   → a second agent receives THAT FAILURE TEXT (never a summary of it)
//              and edits test files only
// Early exit the moment the suite is green. On exhaustion the workflow returns a
// STRUCTURED FAILURE (healed:false), there is no fall-through that reads as success.
//
// VALUE MISMATCHES ARE NEVER HEALED. A failure where the test expected X and got Y
// (assertion diff, snapshot diff, wrong status code, wrong count) is withheld from the
// repair agent, reported as "possible product bug: expected X, got Y (file:line)" and
// left failing. Rewriting the expected value to match current output would turn a
// product bug into a green test. The script vets every fix the repair agent reports
// and reverts any that rewrites an expected value; the prompt text alone is not the gate.
//
// Run it via the Workflow tool:
//   Workflow({ scriptPath: "<this file>", args: { testCommand: "npx vitest run tests/unit/", tier: "unit" } })
//
// Workflow runtime notes: no fs/process in the SCRIPT body; Date.now(), Math.random()
// and argless new Date() are FORBIDDEN (they break resume). Spawned AGENTS run the
// commands and read files themselves (cwd = repo root -> repo-relative paths only).

export const meta = {
	name: "heal-loop",
	description:
		"Bounded test heal loop for /ork:cover Phase 5: run the suite, classify each failure against the heal-loop taxonomy, repair setup, fixture, import, path, type, selector, timeout and flake failures from the real failure output, report every value mismatch as a possible product bug without touching it, and return a structured failure if it never goes green. Ceiling is 3 diagnose runs and 2 repair passes (the last iteration verifies, it does not repair).",
	phases: [
		{
			title: "Heal",
			detail:
				"up to 3 diagnose runs and 2 repair passes, exiting early the moment the suite is green",
		},
		{
			title: "Verdict",
			detail:
				"structured healed/not-healed result with the residual failures and their classifications",
		},
	],
};

// args may arrive as a STRING (memory: feedback_workflow_authoring_gotchas), guard it.
const RAW = typeof args === "string" && args.trim() ? JSON.parse(args) : args;
const cfg = RAW && typeof RAW === "object" && !Array.isArray(RAW) ? RAW : {};

const TEST_COMMAND = cfg.testCommand || "npm test";
const TIER = cfg.tier || "unit"; // unit | integration | e2e
const TEST_GLOB = cfg.testGlob || "tests/";
// HARD ceiling. Clamped, never trusted from args beyond the bound.
// Floor is 2, not 1: the loop never spawns a repair on its final iteration (there would
// be no verification run left to confirm it), so a ceiling of 1 would diagnose once and
// break with zero repairs - a heal loop structurally incapable of healing.
// N iterations therefore means N diagnose runs and N-1 repair passes.
const MAX_ITERATIONS = Math.max(2, Math.min(3, Number(cfg.maxIterations) || 3));

// The taxonomy from references/heal-loop-strategy.md. Kept in sync with that table.
const CATEGORIES = [
	"assertion",
	"import",
	"setup",
	"timeout",
	"stale-selector",
	"type",
	"flaky",
	"source-bug",
	"unknown",
];

// Never sent for repair, never healed: reported as possible product bugs.
const VALUE_MISMATCH = new Set(["assertion", "source-bug"]);

const FAILURE = {
	type: "object",
	additionalProperties: false,
	properties: {
		test: { type: "string" }, // test name or id
		file: { type: "string" }, // repo-relative test file
		line: { type: "integer" },
		category: { type: "string", enum: CATEGORIES },
		message: { type: "string" }, // VERBATIM failure output slice, not a paraphrase
		expected: { type: "string" }, // value mismatches: the value the test expected
		actual: { type: "string" }, // value mismatches: the value the product returned
		suggested_fix: { type: "string" },
	},
	required: ["test", "file", "category", "message"],
};

const RUN_RESULT = {
	type: "object",
	additionalProperties: false,
	properties: {
		passed: { type: "boolean" }, // true ONLY if the command exited 0 with zero failures
		pass_count: { type: "integer" },
		fail_count: { type: "integer" },
		exit_code: { type: "integer" },
		failures: { type: "array", items: FAILURE },
		raw_output: { type: "string" }, // tail of the real stdout/stderr
	},
	required: ["passed", "pass_count", "fail_count", "failures", "raw_output"],
};

const REPAIR_RESULT = {
	type: "object",
	additionalProperties: false,
	properties: {
		files_edited: { type: "array", items: { type: "string" } },
		fixes: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					file: { type: "string" },
					test: { type: "string" },
					line: { type: "integer" },
					category: { type: "string", enum: CATEGORIES },
					change: { type: "string" },
					before: { type: "string" }, // verbatim text replaced
					after: { type: "string" }, // verbatim text written
					touches_expected_value: { type: "boolean" },
				},
				required: ["file", "category", "change", "before", "after", "touches_expected_value"],
			},
		},
		possible_product_bugs: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					test_file: { type: "string" },
					test: { type: "string" },
					line: { type: "integer" },
					source_file: { type: "string" },
					expected: { type: "string" },
					actual: { type: "string" },
					issue: { type: "string" },
				},
				required: ["test_file", "issue"],
			},
		},
		unfixable: { type: "array", items: { type: "string" } },
	},
	required: ["files_edited", "fixes", "possible_product_bugs", "unfixable"],
};

const REVERT_RESULT = {
	type: "object",
	additionalProperties: false,
	properties: {
		reverted: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					file: { type: "string" },
					line: { type: "integer" },
					restored: { type: "boolean" }, // true ONLY if git diff confirms "before" is back
					note: { type: "string" },
				},
				required: ["file", "restored"],
			},
		},
	},
	required: ["reverted"],
};

const TAXONOMY = `Classify EVERY failure into exactly one category:
- assertion       VALUE mismatch: expected X, got Y; snapshot diff; wrong status code; wrong
                  count (e.g. "expected 200, got 201"). Never healed, reported as a possible product bug
- import          module resolution (e.g. "Cannot find module './auth'")
- setup           missing service/fixture (e.g. "Connection refused", wrong fixture scope)
- timeout         exceeded the time budget
- stale-selector  E2E locator did not match (e.g. Element not found: [data-testid=...])
- type            type/attribute error (e.g. "Property 'id' does not exist")
- flaky           passes on some runs, fails on others; timing or shared-state dependent
- source-bug      the test is CORRECT and the SOURCE is wrong
- unknown         genuinely unclassifiable; do not use it to avoid deciding`;

const runPrompt = `Run this exact command from the repo root and report the REAL result:

    ${TEST_COMMAND}

Do not simulate, predict, or summarize away the output. Run it, read the actual output.
Set passed=true ONLY if the command exited 0 AND the reported failure count is zero.
For every failing test, capture the VERBATIM failure message (the real assertion diff,
stack line, or error string), not a paraphrase, plus the repo-relative test file and line.
For every assertion failure also fill expected and actual with the two values verbatim.

${TAXONOMY}

Put the last ~2000 characters of real stdout/stderr in raw_output.`;

const failureKey = (f) => `${f.file || ""}::${f.test || ""}`;
const isValueMismatch = (f) => VALUE_MISMATCH.has(f.category);
const EXPECTED_GOT = /expected:?\s+(.+?)[,;]?\s+(?:but\s+)?(?:got|received):?\s+(.+)/i;
// A fix whose own description says it rewrites an expected value or a snapshot is
// rejected even when touches_expected_value claims otherwise.
const EXPECTED_EDIT = /\bexpected (?:value|status|count)\b|\bsnapshots?\b|update-?snapshot|\s-u\b/i;

function expectedActual(f) {
	if (f.expected || f.actual) return [f.expected || "?", f.actual || "?"];
	const m = String(f.message || "").match(EXPECTED_GOT);
	return m ? [m[1].trim(), m[2].trim()] : ["?", "?"];
}

// Keyed by file + test so a failure reported again in a later iteration stays one entry.
const productBugs = new Map();

function flagProductBug(f, origin, iteration, reason) {
	const key = failureKey(f);
	if (productBugs.has(key)) return productBugs.get(key);
	const [expected, actual] = expectedActual(f);
	const file = f.file || "?";
	const where = f.line ? `${file}:${f.line}` : file;
	const entry = {
		test: f.test || "",
		file,
		line: f.line,
		category: f.category,
		expected,
		actual,
		report: `possible product bug: expected ${expected}, got ${actual} (${where})`,
		origin, // classified | rejected-repair | repair-agent
		reason,
		iteration,
		message: String(f.message || "").slice(0, 600),
	};
	productBugs.set(key, entry);
	return entry;
}

// Returns the reason a reported fix is rejected, or null when heal may keep it.
function vetFix(fix) {
	if (VALUE_MISMATCH.has(fix.category)) {
		return `fix targets a ${fix.category} failure; value mismatches are never healed`;
	}
	if (fix.touches_expected_value === true) return "fix rewrites an expected value";
	if (EXPECTED_EDIT.test(String(fix.change || ""))) {
		return "fix describes an expected value or snapshot rewrite";
	}
	const target = failureKey({ file: fix.file, test: fix.test });
	if (fix.test && productBugs.has(target)) {
		return "fix edits a test already reported as a possible product bug";
	}
	for (const bug of productBugs.values()) {
		if (fix.line && bug.line && bug.file === fix.file && bug.line === fix.line) {
			return "fix edits the line of a test already reported as a possible product bug";
		}
	}
	return null;
}

function fixTarget(fix, candidates) {
	const hit =
		candidates.find((f) => f.file === fix.file && fix.test && f.test === fix.test) ||
		candidates.find((f) => f.file === fix.file && fix.line && f.line === fix.line);
	return (
		hit || {
			test: fix.test || "",
			file: fix.file,
			line: fix.line,
			category: fix.category,
			message: String(fix.change || ""),
		}
	);
}

phase("Heal");
log(
	`heal-loop: tier=${TIER} · command="${TEST_COMMAND}" · ceiling=${MAX_ITERATIONS} iteration(s) enforced by the script`,
);

const ledger = [];
let latest = null;
let healed = false;
let vanished = false;
let iterationsUsed = 0;

// REAL loop with a REAL counter, bounded by MAX_ITERATIONS.
for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
	iterationsUsed = iteration;

	// Run + failure classification is test-domain work — same specialist as the
	// repair stage below (agentType default: name the owner, don't fall generic).
	const run = await agent(runPrompt, {
		label: `run:${TIER}#${iteration}`,
		phase: "Heal",
		schema: RUN_RESULT,
		agentType: "ork:test-generator",
	});

	if (!run) {
		log(`Iteration ${iteration}: test-run agent returned nothing, treating as FAILED.`);
		ledger.push({
			iteration,
			pass_count: 0,
			fail_count: -1,
			categories: [],
			note: "test-run agent returned no structured result",
		});
		continue;
	}

	latest = run;
	const failures = Array.isArray(run.failures) ? run.failures : [];
	const categories = Array.from(new Set(failures.map((f) => f.category)));

	for (const f of failures.filter(isValueMismatch)) {
		flagProductBug(f, "classified", iteration, "value mismatch; heal never rewrites an expected value");
	}
	const repairable = failures.filter((f) => !isValueMismatch(f) && !productBugs.has(failureKey(f)));
	const withheld = failures.filter((f) => !repairable.includes(f));

	ledger.push({
		iteration,
		pass_count: run.pass_count,
		fail_count: run.fail_count,
		categories,
		withheld_value_mismatches: withheld.length,
	});

	if (run.passed && failures.length === 0) {
		if (productBugs.size) {
			// A flagged test only goes green if a test edit changed what it asserts,
			// which is the rewrite this loop forbids. It is not a heal.
			vanished = true;
			log(
				`Iteration ${iteration}: suite is GREEN but ${productBugs.size} test(s) reported as possible product bugs no longer fail; heal never rewrites expected values, so this is NOT a heal.`,
			);
		} else {
			healed = true;
			log(
				`Iteration ${iteration}: GREEN (${run.pass_count} passing), exiting the loop early.`,
			);
		}
		break;
	}

	log(
		`Iteration ${iteration}/${MAX_ITERATIONS}: ${run.fail_count} failing · ${run.pass_count} passing · categories: ${categories.join(", ") || "none reported"}`,
	);

	// Last budgeted iteration: diagnosing again would be the whole cost with no
	// retry left to prove the repair. Stop and report honestly instead.
	if (iteration === MAX_ITERATIONS) {
		log(
			`Iteration budget exhausted at ${MAX_ITERATIONS}, not spawning another repair pass with no verification run left.`,
		);
		break;
	}

	if (!repairable.length) {
		log(
			`Iteration ${iteration}: every failure is a possible product bug (value mismatch), nothing heal may repair. Stopping.`,
		);
		break;
	}

	// Hand the repair agent the REAL failure text, verbatim, for repairable failures only.
	// The raw tail would carry the withheld diffs too, so it is dropped when any exist.
	const failureText = JSON.stringify(repairable).slice(0, 12000);
	const rawTail = withheld.length
		? "(omitted: it contains value mismatch failures that heal must not touch)"
		: String(run.raw_output || "").slice(0, 3000);
	const doNotTouch = Array.from(productBugs.values())
		.map((b) => `- ${b.file}${b.line ? `:${b.line}` : ""} ${b.test}`)
		.join("\n");
	const repair = await agent(
		`Repair failing tests for the ${TIER} tier. This is heal iteration ${iteration} of ${MAX_ITERATIONS}.

These are the ACTUAL failures from running "${TEST_COMMAND}" (verbatim, JSON):
${failureText}

Raw output tail:
${rawTail}

${TAXONOMY}

Rules (references/heal-loop-strategy.md):
1. Fix TEST files only (under ${TEST_GLOB}). NEVER edit source code.
2. Read the source before fixing a test, so the fix matches real behavior.
3. Fix by category: import -> fix the path / tsconfig / conftest; setup -> add the missing
   service or fixture and check fixture scope; timeout -> use proper waits (Playwright
   auto-wait, or a justified timeout bump); stale-selector -> switch to a semantic locator
   such as getByRole; type -> fix the type assertion or the factory output; flaky -> remove
   timing dependence, use deterministic waits and frozen time.
4. NEVER change an expected value, snapshot, expected status code or expected count so a
   test matches current output. If that is the only fix you can find, do not make it:
   record it in possible_product_bugs with expected and actual, and leave the test failing.
5. Do NOT touch these tests, they are reported as possible product bugs:
${doNotTouch || "(none)"}
6. Do NOT suppress: no skip, no try/except swallow, no eslint-disable, no type ignore.
7. Anything you cannot fix within these rules goes in unfixable with the reason.

Report exactly what you changed: one fixes entry per edit, with before and after verbatim and
touches_expected_value set truthfully. The workflow reverts any fix that rewrites an expected value.`,
		{
			// M170/#3126: repair has an obvious specialist owner — fixing tests
			// by failure category is test-generator's exact domain. The run stage
			// above stays generic on purpose (mechanical command execution).
			agentType: "ork:test-generator",
			label: `repair:${TIER}#${iteration}`,
			phase: "Heal",
			schema: REPAIR_RESULT,
		},
	);

	const fixes = repair && Array.isArray(repair.fixes) ? repair.fixes : [];
	const reportedBugs =
		repair && Array.isArray(repair.possible_product_bugs) ? repair.possible_product_bugs : [];
	const accepted = [];
	const rejected = [];
	for (const fix of fixes) {
		const reason = vetFix(fix);
		if (reason) rejected.push({ fix, reason });
		else accepted.push(fix);
	}
	for (const { fix, reason } of rejected) {
		flagProductBug(fixTarget(fix, repairable), "rejected-repair", iteration, reason).rejected_fix = {
			file: fix.file,
			line: fix.line,
			before: fix.before,
			after: fix.after,
			revert_confirmed: false,
		};
	}
	for (const b of reportedBugs) {
		flagProductBug(
			{
				test: b.test || "",
				file: b.test_file,
				line: b.line,
				category: "source-bug",
				expected: b.expected,
				actual: b.actual,
				message: b.issue,
			},
			"repair-agent",
			iteration,
			b.issue,
		);
	}

	if (rejected.length) {
		const revert = await agent(
			`The heal repair pass made edits that heal is NOT allowed to make: they rewrite what a test
expects so it matches current output. Undo EXACTLY these edits and nothing else. For each one,
replace the "after" text with the "before" text in that file, then run git diff on the file to
confirm the original assertion is back. Do not touch any other line and do not edit source code.

${JSON.stringify(rejected.map(({ fix, reason }) => ({ file: fix.file, line: fix.line, test: fix.test, before: fix.before, after: fix.after, reason }))).slice(0, 8000)}

Set restored=true ONLY when git diff shows the "before" text back in place.`,
			{
				agentType: "ork:test-generator",
				label: `revert:${TIER}#${iteration}`,
				phase: "Heal",
				schema: REVERT_RESULT,
			},
		);
		const restored = (revert && Array.isArray(revert.reverted) ? revert.reverted : []).filter(
			(r) => r.restored === true,
		);
		for (const bug of productBugs.values()) {
			const rf = bug.rejected_fix;
			if (!rf || rf.revert_confirmed) continue;
			rf.revert_confirmed = restored.some(
				(r) => r.file === rf.file && (!rf.line || !r.line || r.line === rf.line),
			);
		}
		log(
			`Iteration ${iteration}: REJECTED ${rejected.length} fix(es) that rewrote an expected value; reverted ${restored.length}.`,
		);
	}

	const last = ledger[ledger.length - 1];
	last.repaired_files = Array.from(new Set(accepted.map((f) => f.file)));
	last.accepted_fixes = accepted.length;
	last.rejected_fixes = rejected.length;
	last.possible_product_bugs = productBugs.size;
	log(
		`Iteration ${iteration}: kept ${accepted.length} fix(es) in ${last.repaired_files.length} test file(s)${productBugs.size ? ` · ${productBugs.size} possible product bug(s), left failing on purpose` : ""}`,
	);

	if (!accepted.length) {
		log(
			`Iteration ${iteration}: no repair survived vetting, a further identical retry cannot help. Stopping.`,
		);
		break;
	}
}

phase("Verdict");

const residual = latest && Array.isArray(latest.failures) ? latest.failures : [];
const byCategory = {};
for (const f of residual) {
	byCategory[f.category] = (byCategory[f.category] || 0) + 1;
}

if (healed) {
	log(`heal-loop: HEALED in ${iterationsUsed} iteration(s).`);
	return {
		status: "healed",
		healed: true,
		tier: TIER,
		test_command: TEST_COMMAND,
		iterations_used: iterationsUsed,
		max_iterations: MAX_ITERATIONS,
		pass_count: latest ? latest.pass_count : 0,
		fail_count: 0,
		remaining_failures: [],
		possible_product_bugs: [],
		iteration_ledger: ledger,
	};
}

// STRUCTURED FAILURE. Never a soft "mostly fine", the caller must be able to gate on this.
//
// `latest` is null only when EVERY diagnose agent returned nothing, so the suite state is
// unknown rather than known-good. Reporting fail_count 0 there would let a caller gating on
// fail_count read a failed run as clean, which is the exact fail-open shape this loop exists
// to avoid. Emit -1 (the same unknown sentinel the ledger uses) so the gate cannot pass.
// A green run after a possible product bug was flagged is untrusted the same way.
const unknownState = latest === null || vanished;
const bugs = Array.from(productBugs.values());
log(
	latest === null
		? `heal-loop: NOT HEALED after ${iterationsUsed} iteration(s); suite state UNKNOWN, every diagnose run returned nothing.`
		: `heal-loop: NOT HEALED after ${iterationsUsed} iteration(s), ${residual.length} test(s) still failing, ${bugs.length} possible product bug(s).`,
);
for (const b of bugs) log(`  ${b.report}`);
return {
	status: "failed",
	healed: false,
	state_known: !unknownState,
	tier: TIER,
	test_command: TEST_COMMAND,
	iterations_used: iterationsUsed,
	max_iterations: MAX_ITERATIONS,
	pass_count: latest ? latest.pass_count : 0,
	fail_count: unknownState ? -1 : latest.fail_count,
	failure_categories: byCategory,
	possible_product_bugs: bugs,
	value_mismatch_vanished: vanished,
	remaining_failures: residual.map((f) => ({
		test: f.test,
		file: f.file,
		line: f.line,
		category: f.category,
		message: String(f.message || "").slice(0, 600),
		suggested_fix: f.suggested_fix,
	})),
	iteration_ledger: ledger,
	note: vanished
		? `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. The suite went green after tests were reported as possible product bugs; heal never rewrites expected values, so inspect the test diff for those tests (fail_count -1, state_known false). Do NOT report this run as a success.`
		: latest === null
			? `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. Every diagnose run returned nothing, so the suite state is UNKNOWN (fail_count -1, state_known false). Do NOT report this run as a success and do NOT treat fail_count 0 as green.`
			: `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. These tests are STILL FAILING and require manual resolution; report each possible_product_bugs entry verbatim ("possible product bug: expected X, got Y (file:line)"); do not report this run as a success.`,
};
