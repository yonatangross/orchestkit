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
                  count (e.g. "expected 200, got 201"). Never healed, reported as a possible product bug.
                  The workflow treats any message in that shape as a value mismatch whatever the category
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
const EXPECTED_GOT = /expected:?\s+(.+?)[,;]?\s+(?:but\s+)?(?:got|received):?\s+(.+)/i;
// Value-mismatch message shapes, each with the capture order [expected, actual].
// The agent's category is not trusted: a message in one of these shapes is a value
// mismatch whatever the failure is labelled.
const VALUE_MESSAGES = [
	{
		// chai / vitest: expected <actual> to be <expected>, before EXPECTED_GOT so a trailing
		// "but got N" does not swap the sides.
		re: /\bexpected\s+(.+?)\s+to\s+(?:be|equal|eql|deep\s+equal|have\s+(?:a\s+)?length(?:Of)?(?:\s+of)?)\s+(.+?)(?:\s+but\b.*|\s+\/\/.*)?$/im,
		order: [2, 1],
	},
	{ re: EXPECTED_GOT, order: [1, 2] }, // expected X, got Y / Expected: X Received: Y
	{ re: /\bassert\s+(.+?)\s+==\s+(.+)/, order: [2, 1] }, // pytest: assert actual == expected
	{ re: /AssertionError:\s*(.+?)\s+!=\s+(.+)/, order: [2, 1] }, // unittest: first != second
	{ re: /\bstatus(?:[ _]?code)?\b[^\n]*?\b([1-5]\d\d)\b[^\n]*?\b([1-5]\d\d)\b/i, order: [1, 2] },
];
// Expected/got shapes that are not value mismatches: TS2554 "Expected 2 arguments, but got 1"
// is a type error, and a Playwright "Received: <element(s) not found>" is a locator that
// matched nothing (stale selector). toHaveCount "Received: 0" and a real toHaveText diff
// ("Received string: ...") stay value mismatches.
const NOT_VALUE =
	/\bexpected \d+(?:-\d+)? (?:type )?arguments?\b|\bReceived:?\s*<?element\(s\) not found>?/i;
const valueMessage = (f) => {
	const msg = String(f.message || "");
	return NOT_VALUE.test(msg) ? undefined : VALUE_MESSAGES.find((v) => v.re.test(msg));
};
const isValueMismatch = (f) => VALUE_MISMATCH.has(f.category) || Boolean(valueMessage(f));
// A fix whose own description says it rewrites an expected value or a snapshot is
// rejected even when touches_expected_value claims otherwise.
const EXPECTED_EDIT = /\bexpected (?:value|status|count)\b|\bsnapshots?\b|update-?snapshot|\s-u\b/i;

function expectedActual(f) {
	if (f.expected || f.actual) return [f.expected || "?", f.actual || "?"];
	const v = valueMessage(f);
	if (!v) return ["?", "?"];
	const m = String(f.message).match(v.re);
	return v.order.map((i) => m[i].trim());
}

// Deterministic assertion diff over a fix's before/after text. The agent's category and
// touches_expected_value are labels it chose; this reads the code it says it changed.
// A JS expect(...) is keyed by its matcher chain and arguments (the expected side); its
// subject is compared separately and may only change as a locator swap in a stale-selector fix.
const EXPECT_CALL = /\bexpect(?:\.soft)?\s*\(/g;
const LINE_ASSERTIONS = [
	/^\s*assert\b.*$/gm, // pytest / plain assert
	/\b(?:self\.)?assert[A-Z]\w*\s*\(.*$/gm, // unittest assertEqual, assertTrue, JUnit
	/\bassert\.\w+\s*\(.*$/gm, // node:assert, chai assert
	/\bpytest\.raises\s*\(.*$/gm,
	/\.should\b.*$/gm, // chai should
	/\bstatus(?:_code|Code)?\s*(?:===?|!==?)\s*\d{3}\b.*$/gm, // status comparisons
];
const WEAK_MATCHER =
	/\.(?:toBeDefined|toBeTruthy|toBeFalsy|toBeTypeOf|not\.toBeNull|not\.toBeUndefined|not\.toThrow)\(|expect\.any(?:thing)?\(/;
const SKIP_MARKER =
	/\b(?:it|test|describe)\.(?:skip|only|todo|fixme)\b|\bx(?:it|test|describe)\s*\(|\btest\.fail\s*\(|@pytest\.mark\.(?:skip|skipif|xfail)\b|\bpytest\.(?:skip|xfail)\s*\(|@unittest\.skip/g;

const squash = (s) => s.replace(/\s+/g, "").replace(/[;,]+$/, "");

function closeParen(text, open) {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (text[i] === "(") depth += 1;
		else if (text[i] === ")") {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return text.length;
}

function splitArgs(s) {
	const out = [];
	let depth = 0;
	let start = 0;
	let quote = null;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (quote) {
			if (c === "\\") i += 1;
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'" || c === "`") quote = c;
		else if ("([{".includes(c)) depth += 1;
		else if (")]}".includes(c)) depth -= 1;
		else if (c === "," && depth === 0) {
			out.push(s.slice(start, i));
			start = i + 1;
		}
	}
	out.push(s.slice(start));
	return out.map((a) => a.trim()).filter(Boolean);
}

const comparisonRight = (s) => {
	const m = /(?:===?|!==?|<=|>=|\bis(?:\s+not)?\s|\bnot\s+in\s|\bin\s|[<>])\s*(.+)$/.exec(s);
	return m ? m[1] : "";
};

// The expected side of a line assertion: the right of a comparison, the expected argument
// of an assertEqual style call, the exception of pytest.raises, the chain after .should.
function lineExpectedSide(line) {
	const call = /\b((?:self\.)?assert[A-Z]\w*|assert\.\w+|pytest\.raises)\s*\(/.exec(line);
	if (call) {
		const open = call.index + call[0].length - 1;
		const inner = line.slice(open + 1, closeParen(line, open) - 1);
		if (call[1] === "pytest.raises") return inner;
		const args = splitArgs(inner);
		if (args.length < 2) return comparisonRight(args[0] || "");
		// JUnit assertEquals(expected, actual); unittest and node:assert take (actual, expected).
		return /(?:Equals|Same)$/.test(call[1]) ? args[0] : args.slice(1).join(",");
	}
	const should = line.indexOf(".should");
	if (should >= 0) return line.slice(should + ".should".length);
	return comparisonRight(line.replace(/^\s*assert\b/, ""));
}

// expect(key, subject, expectedSide): expectedSide is the matcher arguments only.
// actualSide is what the assertion inspects: the expect subject, or the rest of the line.
function extractAssertions(text) {
	const out = [];
	for (const m of text.matchAll(EXPECT_CALL)) {
		const open = m.index + m[0].length - 1;
		let i = closeParen(text, open);
		const subject = squash(text.slice(open + 1, i - 1));
		let chain = "";
		let args = "";
		for (;;) {
			const step = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*/.exec(text.slice(i));
			if (!step) break;
			i += step[0].length;
			chain += `.${step[1]}`;
			if (text[i] === "(") {
				const end = closeParen(text, i);
				chain += squash(text.slice(i, end));
				args += text.slice(i, end);
				i = end;
			}
		}
		out.push({
			key: `expect(...)${chain}`,
			subject,
			expectedSide: args,
			actualSide: subject,
			raw: subject + chain,
			js: true,
		});
	}
	for (const re of LINE_ASSERTIONS) {
		for (const m of text.matchAll(re)) {
			const expectedSide = lineExpectedSide(m[0]);
			const at = expectedSide ? m[0].lastIndexOf(expectedSide) : -1;
			const actualSide = at < 0 ? m[0] : `${m[0].slice(0, at)} ${m[0].slice(at + expectedSide.length)}`;
			out.push({ key: squash(m[0]), subject: "", expectedSide, actualSide, raw: m[0], js: false });
		}
	}
	return out;
}

const LITERAL = /(["'`])(?:\\.|(?!\1).)*\1|\b\d+(?:\.\d+)?\b|\b(?:true|false|null|undefined|None|True|False)\b/g;
const literals = (s) => (String(s).match(LITERAL) || []).map((l) => l.replace(/^["'`]|["'`]$/g, ""));
const names = (s) => new Set(String(s).match(/[A-Za-z_$][\w$]*/g) || []);
// name = value, with an optional const/let/var and TS type; not ==, ===, => or a property.
const ASSIGNMENT =
	/(?:^|[;{(\s])(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]|, ]+?)?\s*=(?![=>])\s*([^;\n]+)/g;

function assignments(text) {
	const out = new Map();
	for (const m of text.matchAll(ASSIGNMENT)) out.set(m[1], squash(m[2]));
	return out;
}

// A locator root: getBy*/queryBy*/findBy* or locator(, optionally behind page., screen.,
// within(x). and the like. Math.min(res.status, 409) or a bare 409 is not one.
const LOCATOR_SUBJECT =
	/^(?:[A-Za-z_$][\w$]*(?:\([^()]*\))?\.)*(?:(?:get|query|find)(?:All)?By[A-Z]\w*|locator)\(/;

// Added control flow around an assertion can stop it from ever failing.
const GUARDS = [
	["try", /\btry\s*[{:]/g],
	["catch", /\bcatch\b|\bexcept\b/g],
	["return", /\breturn\b/g],
	["if", /\bif\s*\(|^\s*(?:el)?if\s[^\n]*:\s*$/gm],
	["ternary", /\s\?\s[^\n]*?\s:\s/g],
	["&& or ||", /&&|\|\|/g],
];

// A constant with one of these names carries an expected value even when no assertion in
// the reported hunks names it (the assertion can sit in an unreported part of the file).
const EXPECTED_NAME = /expect|want|golden/i;

// Identifiers on one side of every assertion in any hunk of one file, before or after. A
// pass can move a value in one hunk while the assertion sits in another.
function namesByFile(fixes, side) {
	const byFile = new Map();
	for (const fix of fixes) {
		const set = byFile.get(fix.file) || new Set();
		for (const text of [fix.before, fix.after]) {
			for (const a of extractAssertions(String(text || ""))) {
				for (const n of names(a[side])) set.add(n);
			}
		}
		byFile.set(fix.file, set);
	}
	return byFile;
}
const assertedNamesByFile = (fixes) => namesByFile(fixes, "expectedSide");
const subjectNamesByFile = (fixes) => namesByFile(fixes, "actualSide");

// The only subject change heal may keep: a stale-selector fix swapping one locator for
// another that does not carry the failure's expected value.
function isLocatorSwap(fix, target, from, to) {
	const [expectedValue] = expectedActual(target);
	return (
		fix.category === "stale-selector" &&
		LOCATOR_SUBJECT.test(from) &&
		LOCATOR_SUBJECT.test(to) &&
		!(expectedValue !== "?" && literals(to).includes(expectedValue.replace(/^["'`]|["'`]$/g, "")))
	);
}

// Conservative rule: in a test file, a changed binding value is never healed, because the
// assertion reading it can sit outside every reported hunk. Only names whose LAST word (or
// last two words joined), after dropping trailing unit words, is one of these stay healable.
// A substring is not enough: redirectTarget holds dir, hostName and timeoutMessage hold one.
const SAFE_WORDS = new Set([
	"timeout",
	"delay",
	"retry",
	"retries",
	"wait",
	"interval",
	"poll",
	"port",
	"host",
	"url",
	"baseurl",
	"path",
	"dir",
	"directory",
	"fixture",
	"fixtures",
	"file",
	"filename",
]);
const UNIT_WORDS = new Set(["ms", "s", "sec", "secs", "seconds", "millis", "milliseconds", "min", "mins", "minutes"]);
const nameWords = (name) =>
	String(name)
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((w) => w.toLowerCase());
function isSafeBinding(name) {
	const words = nameWords(name);
	while (words.length > 1 && UNIT_WORDS.has(words[words.length - 1])) words.pop();
	return SAFE_WORDS.has(words[words.length - 1]) || SAFE_WORDS.has(words.slice(-2).join(""));
}
const TEST_FILE =
	/(?:^|\/)(?:tests?|__tests__|specs?|e2e)\/|[._](?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.(?:py|go)$|(?:^|\/)conftest\.py$/i;
const isTestFile = (file) => !file || TEST_FILE.test(String(file).replace(/\\/g, "/"));

// obj.x = v, obj['k'] = v and Python d['k'] = v. Keyed by the squashed target.
const MEMBER_ASSIGNMENT =
	/(?:^|[;{(\s])([A-Za-z_$][\w$]*(?:\s*(?:\.\s*[A-Za-z_$][\w$]*|\[[^\]\n]*\]))+)\s*=(?![=>])\s*([^;\n]+)/g;

function valueBindings(text) {
	const out = assignments(text);
	for (const m of text.matchAll(MEMBER_ASSIGNMENT)) out.set(squash(m[1]), squash(m[2]));
	return out;
}

const lastSegment = (name) => {
	const m = String(name).match(/(?:\.([A-Za-z_$][\w$]*)|\[\s*["'`]?([^\]"'`]*)["'`]?\s*\])$/);
	return m ? m[1] || m[2] : String(name);
};

// Object.assign(target, ...), lodash merge, deepmerge and Python d.update(...): a call that
// writes into an existing object. Keyed by the line up to the call and the target argument.
const MERGE_CALL = /(?:\bObject\.assign|\b(?:_|lodash)\.(?:merge|assign|defaults|set)|\bdeepmerge|(?<![\w$.])merge|\.update)\s*\(/g;

function mergeCalls(text) {
	const out = new Map();
	for (const m of text.matchAll(MERGE_CALL)) {
		const open = m.index + m[0].length - 1;
		const end = closeParen(text, open);
		const args = splitArgs(text.slice(open + 1, end - 1));
		const start = text.lastIndexOf("\n", m.index) + 1;
		out.set(`${squash(text.slice(start, open))}(${args.length > 1 ? squash(args[0]) : ""})`, squash(text.slice(start, end)));
	}
	return out;
}

function closeBracket(text, open) {
	let depth = 0;
	let quote = null;
	for (let i = open; i < text.length; i++) {
		const c = text[i];
		if (quote) {
			if (c === "\\") i += 1;
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'" || c === "`") quote = c;
		else if ("([{".includes(c)) depth += 1;
		else if (")]}".includes(c)) {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return text.length;
}

// Outermost object, array and dict literals in expression position, keyed by the text from
// the start of the line that leads into them. A block brace after ) or => is not one.
function literalValues(text) {
	const out = new Map();
	const seen = new Map();
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"' || c === "'" || c === "`") {
			for (i += 1; i < text.length && text[i] !== c && text[i] !== "\n"; i++) if (text[i] === "\\") i += 1;
			continue;
		}
		if (c !== "{" && c !== "[") continue;
		let p = i - 1;
		while (p >= 0 && /\s/.test(text[p])) p -= 1;
		const lead = p >= 0 ? text[p] : "";
		const isReturn = /\breturn$/.test(text.slice(Math.max(0, p - 5), p + 1));
		if (!"=(,:[?".includes(lead) && !isReturn) continue;
		if (lead === "=" && /[=!<>]/.test(text[p - 1] || "")) continue;
		const end = closeBracket(text, i);
		const anchor = squash(text.slice(text.lastIndexOf("\n", p) + 1, i));
		const n = seen.get(anchor) || 0;
		seen.set(anchor, n + 1);
		out.set(`${anchor}#${n}`, { anchor, value: squash(text.slice(i, end)) });
		i = end - 1;
	}
	return out;
}

// A flat object literal whose only changed properties have safe names, like { timeout: 5000 }.
function safePropertyChange(from, to) {
	const props = (s) => {
		if (!/^\{.*\}$/s.test(s)) return null;
		const map = new Map();
		for (const part of splitArgs(s.slice(1, -1))) {
			const m = part.match(/^["']?([A-Za-z_$][\w$]*)["']?:(.+)$/s);
			if (!m) return null;
			map.set(m[1], m[2]);
		}
		return map;
	};
	const was = props(from);
	const now = props(to);
	if (!was || !now || was.size !== now.size) return false;
	for (const [key, value] of was) {
		if (!now.has(key)) return false;
		if (now.get(key) !== value && !isSafeBinding(key)) return false;
	}
	return true;
}

const LOCATOR_ARG = /(?:(?:get|query|find)(?:All)?By[A-Z]\w*|locator)\([^()]*$/;

// Snapshot and golden files, and snapshot update flags: every edit needs a human.
const SNAPSHOT_PATH = /(?:^|\/)__snapshots__\/|\.snap$|(?:^|\/)tests?\/(?:[^/]+\/)*[^/]+\.json$|golden|expected/i;
const SNAPSHOT_FLAG = /(?:^|\s)-u(?:\s|$)|-{2}update-?snapshots?\b|updateSnapshot/i;

// Every value a fix in a test file changes, whatever the syntax: bindings (const/let/var,
// bare reassignment, Python NAME =), member and subscript assignments, merges into an
// existing object, and object/array/dict literal contents. A side missing from the fix's
// own before or after is taken from any hunk of that file in the pass, so a binding deleted
// in one hunk and re-added changed in another holds both. The only exceptions are a name
// whose last word is on the safe list and a locator swap under stale-selector.
function valueChanges(fix, target, file = { before: new Map(), after: new Map() }) {
	const before = String(fix.before || "");
	const after = String(fix.after || "");
	const path = String(fix.file || "").replace(/\\/g, "/");
	if ((SNAPSHOT_PATH.test(path) && before !== after) || SNAPSHOT_FLAG.test(`${fix.change || ""}\n${after}`)) {
		return [{ kind: "snapshot", name: fix.file || "?", from: "", to: "" }];
	}
	if (!isTestFile(fix.file)) return [];
	const out = [];
	const was = valueBindings(before);
	const now = valueBindings(after);
	for (const name of new Set([...was.keys(), ...now.keys()])) {
		const prior = was.has(name) ? was.get(name) : file.before.get(name);
		const next = now.has(name) ? now.get(name) : file.after.get(name);
		if (prior === undefined || next === undefined || prior === next) continue;
		if (isSafeBinding(lastSegment(name)) || isLocatorSwap(fix, target, prior, next)) continue;
		out.push({ kind: "binding", name, from: prior, to: next });
	}
	const mergedBefore = mergeCalls(before);
	const mergedAfter = mergeCalls(after);
	for (const [name, prior] of mergedBefore) {
		const next = mergedAfter.get(name);
		if (next !== undefined && next !== prior) out.push({ kind: "value", name, from: prior, to: next });
	}
	const litBefore = literalValues(before);
	const litAfter = literalValues(after);
	const [expectedValue] = expectedActual(target);
	const expectedText = expectedValue.replace(/^["'`]|["'`]$/g, "");
	for (const [key, { anchor, value: prior }] of litBefore) {
		const next = litAfter.get(key)?.value;
		if (next === undefined || next === prior || safePropertyChange(prior, next)) continue;
		if (fix.category === "stale-selector" && LOCATOR_ARG.test(anchor) && !(expectedValue !== "?" && literals(next).includes(expectedText))) continue;
		if (out.some((c) => c.from.includes(prior) && c.to.includes(next))) continue;
		out.push({ kind: "value", name: `literal after ${anchor.slice(-40) || "line start"}`, from: prior, to: next });
	}
	return out;
}

function bindingsByFile(fixes) {
	const byFile = new Map();
	for (const fix of fixes) {
		const entry = byFile.get(fix.file) || { before: new Map(), after: new Map() };
		for (const side of ["before", "after"]) {
			for (const [name, value] of valueBindings(String(fix[side] || ""))) {
				if (!entry[side].has(name)) entry[side].set(name, value);
			}
		}
		byFile.set(fix.file, entry);
	}
	return byFile;
}

// Keyed by file + test. Held fixes are reverted, the test stays failing, and the entry is
// neither healed nor a possible product bug.
const needsHuman = new Map();

function holdForHuman(f, fix, changes, iteration) {
	const key = failureKey(f);
	const entry = needsHuman.get(key) || {
		test: f.test || "",
		file: f.file || fix.file || "?",
		line: f.line,
		category: f.category,
		iteration,
		bindings: [],
		held_fixes: [],
	};
	for (const c of changes) {
		if (!entry.bindings.some((b) => b.name === c.name && b.from === c.from && b.to === c.to)) entry.bindings.push(c);
	}
	entry.report = entry.bindings.length
		? entry.bindings
				.map((c) =>
					c.kind === "snapshot"
						? `snapshot or golden edit needs a human: ${c.name}`
						: `${c.kind === "value" ? "value" : "binding"} change needs a human: ${c.name} ${c.from} -> ${c.to}`,
				)
				.join("; ")
		: "fix edits a test already held for a human";
	entry.held_fixes.push({ file: fix.file, line: fix.line, before: fix.before, after: fix.after, revert_confirmed: false });
	needsHuman.set(key, entry);
	return entry;
}

function assertionChange(before, after, fix = {}, target = {}, fileExpected = new Set(), fileSubjects = new Set()) {
	const was = extractAssertions(before);
	const now = extractAssertions(after);
	const cut = (k) => String(k).slice(0, 120);

	const left = now.map((a) => a.key);
	const missing = [];
	for (const a of was) {
		const i = left.indexOf(a.key);
		if (i >= 0) left.splice(i, 1);
		else missing.push(a.key);
	}
	if (missing.length) {
		const weak = left.find((k) => WEAK_MATCHER.test(k));
		if (weak) return `assertion weakened: ${cut(missing[0])} became ${cut(weak)}`;
		if (now.length < was.length) return `assertion removed: ${cut(missing[0])}`;
		return `assertion expected side changed: ${cut(missing[0])}`;
	}

	const locatorSwap = (from, to) => isLocatorSwap(fix, target, from, to);
	const unpaired = now.filter((a) => a.js);
	for (const o of was.filter((a) => a.js)) {
		const i = unpaired.findIndex((a) => a.key === o.key);
		if (i < 0) continue;
		const [n] = unpaired.splice(i, 1);
		if (n.subject === o.subject) continue;
		if (!locatorSwap(o.subject, n.subject)) {
			return `assertion subject changed: expect(${cut(o.subject)}) became expect(${cut(n.subject)})`;
		}
	}

	// Expected-side names: any change moves the expected value. Subject names: a literal
	// change is held to the same locator-swap rule as a subject rewritten in place.
	const expectedNames = names([...was, ...now].map((a) => a.expectedSide).join(" "));
	for (const n of fileExpected) expectedNames.add(n);
	const subjectNames = names([...was, ...now].map((a) => a.actualSide).join(" "));
	for (const n of fileSubjects) subjectNames.add(n);
	const wasSet = assignments(before);
	const nowSet = assignments(after);
	for (const [name, value] of wasSet) {
		const next = nowSet.get(name);
		if (next === undefined || next === value) continue;
		if (expectedNames.has(name) || EXPECTED_NAME.test(name)) {
			return `expected value changed through ${name}: ${cut(value)} became ${cut(next)}`;
		}
		const literalChange = literals(value).join("\u0000") !== literals(next).join("\u0000");
		if (subjectNames.has(name) && literalChange && !locatorSwap(value, next)) {
			return `assertion subject changed through ${name}: ${cut(value)} became ${cut(next)}`;
		}
	}

	if (now.length) {
		for (const [label, re] of GUARDS) {
			const count = (s) => (s.match(re) || []).length;
			if (count(after) > count(before)) return `fix adds ${label} around or before an assertion`;
		}
	}

	const skips = (s) => (s.match(SKIP_MARKER) || []).length;
	if (skips(after) > skips(before)) return "fix adds skip, only, todo or xfail";
	return null;
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
		classified_by: VALUE_MISMATCH.has(f.category) ? "category" : valueMessage(f) ? "message" : "vetting",
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
function vetFix(fix, target, fileExpected, fileSubjects) {
	if (VALUE_MISMATCH.has(fix.category)) {
		return `fix targets a ${fix.category} failure; value mismatches are never healed`;
	}
	if (fix.touches_expected_value === true) return "fix rewrites an expected value";
	if (typeof fix.before !== "string" || typeof fix.after !== "string") {
		return "fix reported no before/after text, so it cannot be vetted";
	}
	const changed = assertionChange(fix.before, fix.after, fix, target, fileExpected, fileSubjects);
	if (changed) return changed;
	if (EXPECTED_EDIT.test(String(fix.change || ""))) {
		return "fix describes an expected value or snapshot rewrite";
	}
	const fixKey = failureKey({ file: fix.file, test: fix.test });
	if (fix.test && productBugs.has(fixKey)) {
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
		candidates.find((f) => f.file === fix.file && fix.line && f.line === fix.line) ||
		candidates.find((f) => fix.test && f.test === fix.test && SNAPSHOT_PATH.test(String(fix.file || "")));
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
let greenWithOpenBugs = false;
let iterationsUsed = 0;
// Only keys of failures the run agent DIAGNOSED as value mismatches: rejected-repair and
// agent-reported entries can carry incomplete identities and would read as vanished.
const diagnosedValueKeys = new Set();
const vanishedBugs = [];

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

	// A diagnosed value mismatch only stops failing if a test edit changed what it asserts,
	// which is the rewrite this loop forbids. Checked on red runs too: another failure can
	// keep the suite red while the flagged test quietly passes.
	const present = new Set(failures.map(failureKey));
	for (const key of diagnosedValueKeys) {
		const bug = productBugs.get(key);
		if (present.has(key) || bug.vanished_at_iteration) continue;
		bug.vanished_at_iteration = iteration;
		vanishedBugs.push(bug);
		log(
			`Iteration ${iteration}: VANISHED "${bug.test}" (${bug.file}${bug.line ? `:${bug.line}` : ""}) was diagnosed as a value mismatch and no longer fails; heal never rewrites expected values, so inspect its diff.`,
		);
	}

	for (const f of failures.filter(isValueMismatch)) {
		flagProductBug(f, "classified", iteration, "value mismatch; heal never rewrites an expected value");
		diagnosedValueKeys.add(failureKey(f));
	}
	const withheld = failures.filter((f) => isValueMismatch(f) || productBugs.has(failureKey(f)));
	const heldForHuman = failures.filter((f) => !withheld.includes(f) && needsHuman.has(failureKey(f)));
	const repairable = failures.filter((f) => !withheld.includes(f) && !heldForHuman.includes(f));

	ledger.push({
		iteration,
		pass_count: run.pass_count,
		fail_count: run.fail_count,
		categories,
		withheld_value_mismatches: withheld.length,
		withheld_needs_human: heldForHuman.length,
	});

	if (run.passed && failures.length === 0) {
		if (productBugs.size || needsHuman.size) {
			greenWithOpenBugs = true;
			log(
				`Iteration ${iteration}: suite is GREEN but ${productBugs.size} possible product bug(s) and ${needsHuman.size} binding change(s) held for a human were flagged; heal never rewrites expected values or binding values, so this is NOT a heal.`,
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
			`Iteration ${iteration}: every failure is a possible product bug (value mismatch) or held for a human, nothing heal may repair. Stopping.`,
		);
		break;
	}

	// Hand the repair agent the REAL failure text, verbatim, for repairable failures only.
	// The raw tail would carry the withheld diffs too, so it is dropped when any exist.
	const failureText = JSON.stringify(repairable).slice(0, 12000);
	const rawTail =
		withheld.length || heldForHuman.length
			? "(omitted: it contains failures that heal must not touch)"
			: String(run.raw_output || "").slice(0, 3000);
	const doNotTouch = [...productBugs.values(), ...needsHuman.values()]
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
5. Do NOT touch these tests, they are reported as possible product bugs or held for a human:
${doNotTouch || "(none)"}
6. In a test file, do NOT change the value of any const, let, var or Python NAME = binding
   unless its name ENDS in a timeout, delay, retry, wait, interval, poll, port, host, url,
   base url, path, dir, fixture or file word (a unit like Ms may follow: TIMEOUT_MS, apiBaseUrl,
   dataDir), or it is a stale-selector locator swap. The same holds for member and subscript
   assignments (obj.x = v, d['k'] = v), Object.assign, merge or update into an existing object,
   and the contents of object, array and dict literals. Do NOT edit snapshot or golden files and
   do NOT update snapshots. The workflow reverts any such change and hands it to a human.
7. Do NOT suppress: no skip, no try/except swallow, no eslint-disable, no type ignore.
8. Anything you cannot fix within these rules goes in unfixable with the reason.

Report exactly what you changed: one fixes entry per edit, with before and after verbatim and
touches_expected_value set truthfully. The workflow diffs every before/after itself and reverts
any fix that changes, removes or weakens an assertion's expected side, or adds skip, only, todo
or xfail, whatever category you report.`,
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
	const held = [];
	const expectedByFile = assertedNamesByFile(fixes);
	const subjectsByFile = subjectNamesByFile(fixes);
	const bindingsInFile = bindingsByFile(fixes);
	for (const fix of fixes) {
		const target = fixTarget(fix, repairable);
		const reason = vetFix(fix, target, expectedByFile.get(fix.file), subjectsByFile.get(fix.file));
		if (reason) {
			rejected.push({ fix, reason });
			continue;
		}
		const changes = valueChanges(fix, target, bindingsInFile.get(fix.file));
		if (changes.length || (fix.test && needsHuman.has(failureKey({ file: fix.file, test: fix.test })))) {
			held.push({ fix, reason: holdForHuman(target, fix, changes, iteration).report });
		} else accepted.push(fix);
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

	const undo = [...rejected, ...held];
	if (undo.length) {
		const revert = await agent(
			`The heal repair pass made edits that heal is NOT allowed to keep: they rewrite what a test
expects so it matches current output, or they change a binding's value, which needs a human.
Undo EXACTLY these edits and nothing else. For each one, replace the "after" text with the
"before" text in that file, then run git diff on the file to confirm the original text is back.
Do not touch any other line and do not edit source code.

${JSON.stringify(undo.map(({ fix, reason }) => ({ file: fix.file, line: fix.line, test: fix.test, before: fix.before, after: fix.after, reason }))).slice(0, 8000)}

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
		const confirm = (rf) => {
			if (!rf || rf.revert_confirmed) return;
			rf.revert_confirmed = restored.some(
				(r) => r.file === rf.file && (!rf.line || !r.line || r.line === rf.line),
			);
		};
		for (const bug of productBugs.values()) confirm(bug.rejected_fix);
		for (const entry of needsHuman.values()) entry.held_fixes.forEach(confirm);
		log(
			`Iteration ${iteration}: REJECTED ${rejected.length} fix(es) that rewrote an expected value, HELD ${held.length} binding change(s) for a human; reverted ${restored.length}.`,
		);
	}

	const last = ledger[ledger.length - 1];
	last.repaired_files = Array.from(new Set(accepted.map((f) => f.file)));
	last.accepted_fixes = accepted.length;
	last.rejected_fixes = rejected.length;
	last.held_fixes = held.length;
	last.possible_product_bugs = productBugs.size;
	last.needs_human = needsHuman.size;
	log(
		`Iteration ${iteration}: kept ${accepted.length} fix(es) in ${last.repaired_files.length} test file(s)${productBugs.size ? ` · ${productBugs.size} possible product bug(s), left failing on purpose` : ""}${needsHuman.size ? ` · ${needsHuman.size} binding change(s) held for a human, left failing` : ""}`,
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
		needs_human: [],
		iteration_ledger: ledger,
	};
}

// STRUCTURED FAILURE. Never a soft "mostly fine", the caller must be able to gate on this.
//
// `latest` is null only when EVERY diagnose agent returned nothing, so the suite state is
// unknown rather than known-good. Reporting fail_count 0 there would let a caller gating on
// fail_count read a failed run as clean, which is the exact fail-open shape this loop exists
// to avoid. Emit -1 (the same unknown sentinel the ledger uses) so the gate cannot pass.
// A diagnosed value mismatch that vanished, or a green run with a possible product bug
// flagged, is untrusted the same way.
const vanished = vanishedBugs.length > 0;
const unknownState = latest === null || vanished || greenWithOpenBugs;
const residualKeys = new Set(residual.map(failureKey));
const bugs = Array.from(productBugs.values()).map((b) => ({
	...b,
	still_failing: residualKeys.has(failureKey(b)),
}));
const human = Array.from(needsHuman.values()).map((h) => ({
	...h,
	still_failing: residualKeys.has(failureKey(h)),
}));
log(
	latest === null
		? `heal-loop: NOT HEALED after ${iterationsUsed} iteration(s); suite state UNKNOWN, every diagnose run returned nothing.`
		: `heal-loop: NOT HEALED after ${iterationsUsed} iteration(s), ${residual.length} test(s) still failing, ${bugs.length} possible product bug(s), ${human.length} held for a human.`,
);
for (const b of bugs) log(`  ${b.report}`);
for (const h of human) log(`  ${h.report} (${h.file}${h.line ? `:${h.line}` : ""})`);
const humanNote = human.length
	? ` Report each needs_human entry verbatim ("binding change needs a human: NAME old -> new"); heal does not change binding values, so a person decides whether each one is a fix or a product bug.`
	: "";
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
	needs_human: human,
	value_mismatch_vanished: vanished,
	vanished_value_mismatches: vanishedBugs.map((b) => ({
		test: b.test,
		file: b.file,
		line: b.line,
		vanished_at_iteration: b.vanished_at_iteration,
		report: b.report,
	})),
	remaining_failures: residual.map((f) => ({
		test: f.test,
		file: f.file,
		line: f.line,
		category: f.category,
		message: String(f.message || "").slice(0, 600),
		suggested_fix: f.suggested_fix,
	})),
	iteration_ledger: ledger,
	note:
		(vanished
		? `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. Tests diagnosed as value mismatches stopped failing: ${vanishedBugs.map((b) => `"${b.test}" (${b.file}${b.line ? `:${b.line}` : ""})`).join(", ")}. Heal never rewrites expected values, so inspect the test diff for those tests (fail_count -1, state_known false). Do NOT report this run as a success.`
		: greenWithOpenBugs
			? `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. The suite went green while possible product bugs or binding changes held for a human were flagged; heal never rewrites expected values or binding values, so inspect the test diff for those tests (fail_count -1, state_known false). Do NOT report this run as a success.`
			: latest === null
				? `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. Every diagnose run returned nothing, so the suite state is UNKNOWN (fail_count -1, state_known false). Do NOT report this run as a success and do NOT treat fail_count 0 as green.`
				: `Iteration ceiling ${MAX_ITERATIONS} enforced by the script. These tests are STILL FAILING and require manual resolution; report each possible_product_bugs entry verbatim ("possible product bug: expected X, got Y (file:line)"); do not report this run as a success.`) + humanNote,
};
