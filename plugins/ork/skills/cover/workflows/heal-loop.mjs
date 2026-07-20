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
// Run it via the Workflow tool:
//   Workflow({ scriptPath: "<this file>", args: { testCommand: "npx vitest run tests/unit/", tier: "unit" } })
//
// Workflow runtime notes: no fs/process in the SCRIPT body; Date.now(), Math.random()
// and argless new Date() are FORBIDDEN (they break resume). Spawned AGENTS run the
// commands and read files themselves (cwd = repo root -> repo-relative paths only).

export const meta = {
	name: "heal-loop",
	description:
		"Bounded test heal loop for /ork:cover Phase 5: run the suite, classify each failure against the heal-loop taxonomy, repair test files from the real failure output, and return a structured failure if it never goes green. Ceiling is 3 diagnose runs and 2 repair passes (the last iteration verifies, it does not repair).",
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

const FAILURE = {
	type: "object",
	additionalProperties: false,
	properties: {
		test: { type: "string" }, // test name or id
		file: { type: "string" }, // repo-relative test file
		line: { type: "integer" },
		category: { type: "string", enum: CATEGORIES },
		message: { type: "string" }, // VERBATIM failure output slice, not a paraphrase
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
					category: { type: "string", enum: CATEGORIES },
					change: { type: "string" },
				},
				required: ["file", "category", "change"],
			},
		},
		source_bugs: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					source_file: { type: "string" },
					test_file: { type: "string" },
					issue: { type: "string" },
				},
				required: ["source_file", "test_file", "issue"],
			},
		},
		unfixable: { type: "array", items: { type: "string" } },
	},
	required: ["files_edited", "fixes", "source_bugs", "unfixable"],
};

const TAXONOMY = `Classify EVERY failure into exactly one category:
- assertion       expected/actual mismatch (e.g. "expected 200, got 201")
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

${TAXONOMY}

Put the last ~2000 characters of real stdout/stderr in raw_output.`;

phase("Heal");
log(
	`heal-loop: tier=${TIER} · command="${TEST_COMMAND}" · ceiling=${MAX_ITERATIONS} iteration(s) enforced by the script`,
);

const ledger = [];
let latest = null;
let healed = false;
let iterationsUsed = 0;

// REAL loop with a REAL counter, bounded by MAX_ITERATIONS.
for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
	iterationsUsed = iteration;

	const run = await agent(runPrompt, {
		label: `run:${TIER}#${iteration}`,
		phase: "Heal",
		schema: RUN_RESULT,
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

	ledger.push({
		iteration,
		pass_count: run.pass_count,
		fail_count: run.fail_count,
		categories,
	});

	if (run.passed && failures.length === 0) {
		healed = true;
		log(
			`Iteration ${iteration}: GREEN (${run.pass_count} passing), exiting the loop early.`,
		);
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

	// Hand the repair agent the REAL failure text, verbatim.
	const failureText = JSON.stringify(failures).slice(0, 12000);
	const repair = await agent(
		`Repair failing tests for the ${TIER} tier. This is heal iteration ${iteration} of ${MAX_ITERATIONS}.

These are the ACTUAL failures from running "${TEST_COMMAND}" (verbatim, JSON):
${failureText}

Raw output tail:
${String(run.raw_output || "").slice(0, 3000)}

${TAXONOMY}

Rules (references/heal-loop-strategy.md):
1. Fix TEST files only (under ${TEST_GLOB}). NEVER edit source code.
2. Read the source before fixing a test, so the assertion matches real behavior.
3. Fix by category: assertion -> correct the expected value against real source behavior;
   import -> fix the path / tsconfig / conftest; setup -> add the missing service or fixture
   and check fixture scope; timeout -> use proper waits (Playwright auto-wait, or a justified
   timeout bump); stale-selector -> switch to a semantic locator such as getByRole;
   type -> fix the type assertion or the factory output; flaky -> remove timing dependence,
   use deterministic waits and frozen time.
4. Do NOT suppress: no skip, no try/except swallow, no eslint-disable, no type ignore.
5. If a failure is a SOURCE bug (the test is correct), do NOT touch it. Record it in
   source_bugs and leave the test failing.
6. Anything you cannot fix within these rules goes in unfixable with the reason.

Report exactly what you changed.`,
		{
			label: `repair:${TIER}#${iteration}`,
			phase: "Heal",
			schema: REPAIR_RESULT,
		},
	);

	const edited = repair && Array.isArray(repair.files_edited) ? repair.files_edited : [];
	const sourceBugs = repair && Array.isArray(repair.source_bugs) ? repair.source_bugs : [];
	ledger[ledger.length - 1].repaired_files = edited;
	ledger[ledger.length - 1].source_bugs = sourceBugs.length;
	log(
		`Iteration ${iteration}: repaired ${edited.length} test file(s)${sourceBugs.length ? ` · ${sourceBugs.length} SOURCE bug(s) flagged, left failing on purpose` : ""}`,
	);

	if (!edited.length && !sourceBugs.length) {
		log(
			`Iteration ${iteration}: repair agent changed nothing, a further identical retry cannot help. Stopping.`,
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
		iteration_ledger: ledger,
	};
}

// STRUCTURED FAILURE. Never a soft "mostly fine", the caller must be able to gate on this.
log(
	`heal-loop: NOT HEALED after ${iterationsUsed} iteration(s), ${residual.length} test(s) still failing.`,
);
return {
	status: "failed",
	healed: false,
	tier: TIER,
	test_command: TEST_COMMAND,
	iterations_used: iterationsUsed,
	max_iterations: MAX_ITERATIONS,
	pass_count: latest ? latest.pass_count : 0,
	fail_count: latest ? latest.fail_count : residual.length,
	failure_categories: byCategory,
	remaining_failures: residual.map((f) => ({
		test: f.test,
		file: f.file,
		line: f.line,
		category: f.category,
		message: String(f.message || "").slice(0, 600),
		suggested_fix: f.suggested_fix,
	})),
	iteration_ledger: ledger,
	note: `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. These tests are STILL FAILING and require manual resolution; do not report this run as a success.`,
};
