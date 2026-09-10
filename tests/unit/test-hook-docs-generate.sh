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
