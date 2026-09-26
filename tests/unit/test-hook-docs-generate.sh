#!/usr/bin/env bash
# The hook reference tables must name real hooks, not the `node` binary,
# and must not emit mute/stop emojis that Fumadocs turns into broken <img>.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GEN="$PROJECT_ROOT/scripts/_build-docs-generate.py"

python3 - "$GEN" <<'PY'
import importlib.util
import sys
from pathlib import Path

path = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("docs_gen", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

entry = {
    "type": "command",
    "command": "node",
    "args": [
        "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs",
        "lifecycle/pre-compact-guard",
    ],
}
cmd = mod.hook_invocation(entry)
path, name = mod.hook_name_from_command(cmd)
assert name == "pre-compact-guard", name
assert path == "lifecycle/pre-compact-guard", path

legacy = mod.hook_name_from_command(
    "node hooks/bin/run-hook.mjs pretool/bash/dangerous-command-blocker"
)
assert legacy[1] == "dangerous-command-blocker", legacy

# Inline code renders literally in MDX, so the escapers must leave it alone
# (a visible `$\{VAR\}` on the reference pages, 2026-09-25) and still escape
# the prose around it.
body = mod.sanitize_mdx_body("`${ENV_VAR}` and `<style>` in {x} <foo>")
assert body.startswith("`${ENV_VAR}` and `<style>`"), body
assert "\\{x\\}" in body and "&lt;foo&gt;" in body, body
cell = mod._ref_table_cell("`/goal <c>` a|b {x}")
assert cell == "`/goal <c>` a\\|b \\{x\\}", cell

# HTML comments are invalid MDX; escaped, the SYNCED provenance markers
# printed as page text. Comment-only lines drop, inline comments vanish,
# and a comment inside a code fence or inline code stays as written.
synced = mod.sanitize_mdx_body(
    "<!-- SYNCED from vercel-labs/agent-browser -->\n# Title\n"
    "Text <!-- note --> more\n`<!-- kept -->`\n```html\n<!-- in fence -->\n```"
)
assert "SYNCED" not in synced and "&lt;!--" not in synced, synced
assert synced.startswith("# Title"), synced
assert "Text  more" in synced, synced
assert "`<!-- kept -->`" in synced and "<!-- in fence -->" in synced, synced

for label in mod.BEHAVIOR_BADGES.values():
    assert "🔇" not in label, label
    assert "\U0001f507" not in label, label
    assert not any(ord(ch) > 127 for ch in label), label

wrapped = """
/**
 * Usage Summary Reporter — SessionEnd Hook
 *
 * Posts OrchestKit-specific session data to HQ API that CC's native
 * HTTP hooks can't provide: hooks_triggered, event_counts, decisions,
 * problems, solutions.
 */
"""
desc = mod._extract_jsdoc_description(wrapped)
assert "CC's native HTTP hooks can't provide" in desc, desc
assert not desc.endswith("native"), desc

cc_prose = """
/**
 * Agent View Titler — SubagentStart Hook
 *
 * Derives a short, human-readable title for each subagent at spawn and emits
 * it on hookSpecificOutput.sessionTitle so the agent-view row is readable.
 *
 * CC 2.1.139 introduced claude agents (Research Preview), which lists every
 * active CC session.
 */
"""
titler = mod._extract_jsdoc_description(cc_prose)
assert "Derives a short, human-readable title" in titler, titler
assert "CC 2.1.139" not in titler, titler

compliant = """
/**
 * Coverage Threshold Gate Hook
 * Blocks Stop when coverage after implementation is below the skill threshold.
 * CC 2.1.7 Compliant
 */
"""
gate = mod._extract_jsdoc_description(compliant)
assert "Blocks Stop when coverage" in gate, gate
assert "Compliant" not in gate, gate

title_paren = """
/**
 * Goal Tracker — Stop Hook (M140 G3 #1790)
 *
 * Closes the most recent open /goal entry for this session by appending a
 * second JSONL line with ended_at.
 */
"""
goal = mod._extract_jsdoc_description(title_paren)
assert "Closes the most recent open" in goal, goal
assert "M140" not in goal, goal

block_src = "import { outputBlock, outputSilentSuccess } from './lib/common.js';\nexport function f() { return outputBlock('x'); }\n"
assert mod._detect_behavior(block_src, "node run-hook.mjs skill/coverage-threshold-gate") == "blocks"

# House writing rule (QA #19): generated prose carries no em dash, en dash or
# spaced double hyphen, while fenced code and inline code stay byte-exact.
EM, EN = "\u2014", "\u2013"
DD = "-" * 2  # a prose double hyphen, spelled without typing one
undash = mod.undash_line
assert undash(f"- **`fork`** {EM} Isolated context.") == "- **`fork`**: Isolated context."
assert undash(f"- [Skills](/docs/skills) {EM} the list") == "- [Skills](/docs/skills): the list"
assert undash(f"## search {DD} Find Past Decisions") == "## search: Find Past Decisions"
assert undash(f'title: "Yonyon {EM} the studio"') == 'title: "Yonyon: the studio"'
assert undash(f'description: "Hooks {EM} the runtime."') == 'description: "Hooks, the runtime."'
assert undash(f"a 0{EN}20 score for 2.1.210{EN}212") == "a 0-20 score for 2.1.210-212"
assert undash(f"| `x` | {EM} |") == "| `x` | - |"
assert undash(f"| 1 | Fetch | {DD} |") == "| 1 | Fetch | - |"
assert undash(f"| {DD} | :{DD}: |") == f"| {DD} | :{DD}: |"
assert undash(f"a `b {EM} c` d {EM} e") == f"a `b {EM} c` d, e"
assert undash(f"keep `git checkout {DD} f` and {DD}force") == f"keep `git checkout {DD} f` and {DD}force"
assert undash(f"wrapped at the end {EM}") == "wrapped at the end,"
page = mod.undash_page(f"```\nx {EM} y\n```\nx {EM} y")
assert page == f"```\nx {EM} y\n```\nx, y", page
# A plain (unquoted) YAML value must never gain ": ", or the page fails to
# parse and the dev server 500s on every route (2026-09-25).
fm = mod.undash_page(
    f"---\ntitle: Yonyon {EM} studio\ndescription: One command {EM} the loop\n---\n# T"
)
assert fm == "---\ntitle: Yonyon, studio\ndescription: One command, the loop\n---\n# T", fm
for line in fm.split("\n")[1:3]:
    assert ": " not in line.split(": ", 1)[1], line
quoted = mod.undash_page(f'---\ntitle: "Yonyon {EM} the studio"\n---\n')
assert quoted == '---\ntitle: "Yonyon: the studio"\n---\n', quoted

# QA N02: a chunked file's pages carry no duplicate title heading, and an
# over-budget section's parts say "part N of M" so the title and the
# positional description cannot disagree.
big_row = "| " + "x" * 400 + " |"
entry = {
    "title": "Version Compatibility",
    "frontmatter": {},
    "body": "# CC Matrix\n\nIntro line.\n\n## Feature Matrix\n\n| A |\n|---|\n"
    + "\n".join([big_row] * int(mod.CHUNK_BUDGET / 300))
    + "\n\n## Tail\n\nDone.\n",
}
chunks = mod.chunk_file_sections(entry)
titles = [c[0] for c in chunks]
parts = [t for t in titles if "Feature Matrix (part" in t]
assert len(parts) >= 2, titles
assert all(f"of {len(parts)})" in t for t in parts), titles
for _, _, lines in chunks:
    assert "### Version Compatibility" not in lines, lines[:3]
    assert "# CC Matrix" not in lines, lines[:3]
# Later parts repeat the table header so they still render as a table.
assert chunks[titles.index(parts[1])][2][:2] == ["| A |", "|---|"], chunks[2][2][:2]

# QA #7: the Command Skills page lists every user-invocable skill once and its
# title count is derived, never typed.
import re as _re
import tempfile
root = Path(sys.argv[1]).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "command-skills.mdx"
    n = mod.generate_command_skills(str(root / "src" / "skills"), str(out), 1)
    page = out.read_text()
    invocable = sorted(
        d.name
        for d in (root / "src" / "skills").iterdir()
        if (d / "SKILL.md").is_file()
        and _re.search(r"^user-invocable:\s*true", (d / "SKILL.md").read_text(), _re.M)
    )
    assert n == len(invocable), (n, len(invocable))
    assert f'title: "{n} Commands You Can Invoke"' in page
    rows = _re.findall(r"^\| \[`/ork:([a-z0-9-]+)`\]", page, _re.M)
    assert sorted(rows) == invocable, set(rows) ^ set(invocable)
    assert "\u2014" not in page and "\u2013" not in page

print("ok")
PY

HOOKS_MDX="$PROJECT_ROOT/docs/site/content/docs/reference/hooks"
if [[ -d "$HOOKS_MDX" ]]; then
  if grep -R --include='*.mdx' '| `node` |' "$HOOKS_MDX"; then
    echo "generated hook tables still name the binary \`node\` — rerun scripts/build-docs.sh" >&2
    exit 1
  fi
  if grep -R --include='*.mdx' '🔇' "$HOOKS_MDX"; then
    echo "generated hook tables still emit mute emoji" >&2
    exit 1
  fi
  if ! grep -q "HTTP hooks can't provide" "$HOOKS_MDX/session-end.mdx"; then
    echo "usage-summary-reporter description missing joined JSDoc" >&2
    exit 1
  fi
  if grep -R --include='*.mdx' '<system-reminder>' "$HOOKS_MDX"; then
    echo "hook tables still contain raw JSX-like tags; escape them in _ref_table_cell" >&2
    exit 1
  fi
  if grep -q '| `coverage-threshold-gate` | `*` | Fire-and-forget |' "$HOOKS_MDX/stop.mdx"; then
    echo "coverage-threshold-gate should be Blocks (uses outputBlock), not Fire-and-forget" >&2
    exit 1
  fi
fi
