// Display normalization in scripts/generate-docs-data.js: skill and agent text
// drops em and en dashes for the site, and a lone placeholder dash in a flow
// node's `out` becomes empty (it rendered "-> -"), but only under `out`.
// Run by tests/unit/test-docs-data-display.sh.
const assert = require("node:assert/strict");
const path = require("node:path");
const { displayText, displayMarkdown, displayDeep } = require(
	path.join(__dirname, "..", "..", "scripts", "generate-docs-data.js"),
);
const EM = "—";
const EN = "–";

assert.equal(displayText(`browser testing ${EM} reads the diff`), "browser testing, reads the diff");
assert.equal(displayText(`a 0${EN}20 score`), "a 0-20 score");
assert.equal(displayText(EM), "-");

assert.equal(displayMarkdown(`## Quick Start ${EM} Catalog`), "## Quick Start: Catalog");
assert.equal(displayMarkdown("```\n// keep " + EM + " this\n```"), "```\n// keep " + EM + " this\n```");

// A placeholder under `out` empties; the same "-" under any other key stays.
const flow = displayDeep({
	nodes: [
		{ label: "Discovery", out: EM },
		{ label: "-", out: "plan.md" },
	],
	tier: "table",
});
assert.equal(flow.nodes[0].out, "");
assert.equal(flow.nodes[1].label, "-");
assert.equal(flow.nodes[1].out, "plan.md");
assert.equal(displayDeep(EM), "-");
// A hyphenated value is never a placeholder, under any key.
assert.equal(displayDeep({ out: "a-b" }).out, "a-b");
console.log("ok");
