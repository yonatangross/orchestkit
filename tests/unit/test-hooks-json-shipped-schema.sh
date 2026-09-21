#!/bin/bash
# Test: shipped hooks.json field-key schema (#4306 durable half)
#
# Fail CI when any SHIPPED hooks.json carries a key outside the Claude Code
# hook schema. Parse JSON itself. Do not call `claude plugin validate`
# (measured: it does not check hooks.json field keys on CC 2.1.278).
#
# Scope (shipped only):
#   src/hooks/hooks.json
#   plugins/ork/hooks/hooks.json
#   mods/*/hooks/hooks.json
# Excludes: node_modules, .lane-cache, .worktrees, tests/fixtures, tests/probes,
# and any deliberate bad-input fixtures (this suite never scans those paths).
#
# Allowlists:
#   top-level: description, hooks, modules
#   matcher-group / event array entry: matcher, hooks
#   hook handler entry (union of documented command/http/mcp/prompt/agent fields):
#     type, if, timeout, statusMessage, once,
#     command, args, async, asyncRewake, shell, continueOnBlock,
#     url, headers, allowedEnvVars, server, tool, input, prompt, model
#   (per-hook `if` is documented by CC; matcher-group `if` is NOT, see #4060/#4062)
#
# This suite is broader than test-hooks-schema-keys.sh (#4060 matcher-group
# only on src/hooks/hooks.json via validate-registry.mjs). Do not route the
# shipped scan through that validator.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FAILED=0
CHECKED=0

TMP="$(mktemp -d "${TMPDIR:-/tmp}/hooks-json-shipped-schema.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# Inline key walker: prints FAIL lines (repo-relative path, location, key) and
# exits 1 when any unknown key is found. Args: <abs-path> <repo-relative-label>
check_hooks_json() {
  local abs="$1"
  local rel="$2"
  node -e '
const fs = require("fs");
const abs = process.argv[1];
const rel = process.argv[2];
const TOP = new Set(["description", "hooks", "modules"]);
const GROUP = new Set(["matcher", "hooks"]);
const HOOK = new Set([
  "type", "if", "timeout", "statusMessage", "once",
  "command", "args", "async", "asyncRewake", "shell", "continueOnBlock",
  "url", "headers", "allowedEnvVars", "server", "tool", "input",
  "prompt", "model",
]);
const data = JSON.parse(fs.readFileSync(abs, "utf8"));
const errs = [];
for (const k of Object.keys(data)) {
  if (!TOP.has(k)) {
    errs.push(`FAIL: ${rel} top-level unknown key "${k}"`);
  }
}
const hooksObj = data.hooks;
if (hooksObj && typeof hooksObj === "object" && !Array.isArray(hooksObj)) {
  for (const [event, groups] of Object.entries(hooksObj)) {
    if (!Array.isArray(groups)) continue;
    groups.forEach((g, i) => {
      if (!g || typeof g !== "object" || Array.isArray(g)) return;
      for (const k of Object.keys(g)) {
        if (!GROUP.has(k)) {
          errs.push(`FAIL: ${rel} hooks.${event}[${i}] unknown key "${k}"`);
        }
      }
      const entries = g.hooks;
      if (!Array.isArray(entries)) return;
      entries.forEach((h, j) => {
        if (!h || typeof h !== "object" || Array.isArray(h)) return;
        for (const k of Object.keys(h)) {
          if (!HOOK.has(k)) {
            errs.push(
              `FAIL: ${rel} hooks.${event}[${i}].hooks[${j}] unknown key "${k}"`,
            );
          }
        }
      });
    });
  }
}
if (errs.length) {
  console.log(errs.join("\n"));
  process.exit(1);
}
' "$abs" "$rel"
}

# Discover shipped hooks.json paths (explicit allowlist of locations).
SHIPPED=()
if [[ -f "$REPO_ROOT/src/hooks/hooks.json" ]]; then
  SHIPPED+=("src/hooks/hooks.json")
fi
if [[ -f "$REPO_ROOT/plugins/ork/hooks/hooks.json" ]]; then
  SHIPPED+=("plugins/ork/hooks/hooks.json")
fi
shopt -s nullglob
for f in "$REPO_ROOT"/mods/*/hooks/hooks.json; do
  SHIPPED+=("${f#"$REPO_ROOT"/}")
done
shopt -u nullglob

# Fail closed: zero shipped files means the discovery glob broke.
CHECKED=$((CHECKED + 1))
if [[ "${#SHIPPED[@]}" -eq 0 ]]; then
  echo "FAIL: zero shipped hooks.json files found (discovery fail-closed)"
  FAILED=$((FAILED + 1))
  echo ""
  echo "Result: FAIL ($FAILED of $CHECKED checks failed)"
  exit 1
fi
echo "PASS: discovered ${#SHIPPED[@]} shipped hooks.json file(s)"

# 1. Positive: every shipped file passes the allowlist as-is on HEAD.
for rel in "${SHIPPED[@]}"; do
  CHECKED=$((CHECKED + 1))
  out="$TMP/check-${CHECKED}.txt"
  if check_hooks_json "$REPO_ROOT/$rel" "$rel" >"$out" 2>&1; then
    echo "PASS: $rel schema keys within allowlist"
  else
    echo "FAIL: $rel carries unknown schema key(s):"
    sed 's/^/    /' "$out"
    FAILED=$((FAILED + 1))
  fi
done

SRC_JSON="$REPO_ROOT/src/hooks/hooks.json"
if [[ ! -f "$SRC_JSON" ]]; then
  echo "FAIL: src/hooks/hooks.json missing (needed for negative controls)"
  exit 1
fi

# 2. Negative: matcher-group `if` on a temp copy (never mutate shipped files).
# Must FAIL naming event, index, and key. PreToolUse[0] is always present.
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!d.hooks || !Array.isArray(d.hooks.PreToolUse) || !d.hooks.PreToolUse[0]) {
  console.error("missing hooks.PreToolUse[0]");
  process.exit(2);
}
d.hooks.PreToolUse[0].if = "Bash(git *)";
fs.writeFileSync(process.argv[2], JSON.stringify(d, null, 2));
' "$SRC_JSON" "$TMP/matcher-group-if.json"
CHECKED=$((CHECKED + 1))
out="$TMP/neg-if.txt"
set +e
check_hooks_json "$TMP/matcher-group-if.json" "src/hooks/hooks.json" >"$out" 2>&1
rc=$?
set -e
if [[ "$rc" -ne 0 ]] && grep -Fq 'hooks.PreToolUse[0] unknown key "if"' "$out"; then
  echo "PASS: matcher-group if on temp copy fails, naming PreToolUse[0]/if"
else
  echo "FAIL: matcher-group if negative control did not fail as required (exit $rc)"
  sed 's/^/    /' "$out" || true
  FAILED=$((FAILED + 1))
fi

# 3. Negative: top-level `_doc` on a temp copy.
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
d._doc = "off-schema";
fs.writeFileSync(process.argv[2], JSON.stringify(d, null, 2));
' "$SRC_JSON" "$TMP/top-doc.json"
CHECKED=$((CHECKED + 1))
out="$TMP/neg-doc.txt"
set +e
check_hooks_json "$TMP/top-doc.json" "src/hooks/hooks.json" >"$out" 2>&1
rc=$?
set -e
if [[ "$rc" -ne 0 ]] && grep -Fq 'top-level unknown key "_doc"' "$out"; then
  echo "PASS: top-level _doc on temp copy fails, naming _doc"
else
  echo "FAIL: top-level _doc negative control did not fail as required (exit $rc)"
  sed 's/^/    /' "$out" || true
  FAILED=$((FAILED + 1))
fi

# 4. Negative (optional strength): hook-entry unknown key `_doc`.
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const entry = d.hooks.PreToolUse[0].hooks[0];
if (!entry) {
  console.error("missing hooks.PreToolUse[0].hooks[0]");
  process.exit(2);
}
entry._doc = "off-schema";
fs.writeFileSync(process.argv[2], JSON.stringify(d, null, 2));
' "$SRC_JSON" "$TMP/hook-entry-doc.json"
CHECKED=$((CHECKED + 1))
out="$TMP/neg-hook-doc.txt"
set +e
check_hooks_json "$TMP/hook-entry-doc.json" "src/hooks/hooks.json" >"$out" 2>&1
rc=$?
set -e
if [[ "$rc" -ne 0 ]] && grep -Fq 'hooks.PreToolUse[0].hooks[0] unknown key "_doc"' "$out"; then
  echo "PASS: hook-entry _doc on temp copy fails, naming hooks[0]._doc"
else
  echo "FAIL: hook-entry _doc negative control did not fail as required (exit $rc)"
  sed 's/^/    /' "$out" || true
  FAILED=$((FAILED + 1))
fi

# 5. Allowlist sanity: per-hook `if` is documented and must PASS on a temp copy.
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
d.hooks.PreToolUse[0].hooks[0].if = "Bash(git *)";
fs.writeFileSync(process.argv[2], JSON.stringify(d, null, 2));
' "$SRC_JSON" "$TMP/hook-entry-if-ok.json"
CHECKED=$((CHECKED + 1))
out="$TMP/pos-hook-if.txt"
if check_hooks_json "$TMP/hook-entry-if-ok.json" "src/hooks/hooks.json" >"$out" 2>&1; then
  echo "PASS: per-hook if on temp copy is allowlisted (does not fail)"
else
  echo "FAIL: per-hook if should be allowlisted but check failed:"
  sed 's/^/    /' "$out"
  FAILED=$((FAILED + 1))
fi

# 6. Allowlist sanity: documented command-hook `shell` must PASS on a temp copy.
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
d.hooks.PreToolUse[0].hooks[0].shell = "bash";
fs.writeFileSync(process.argv[2], JSON.stringify(d, null, 2));
' "$SRC_JSON" "$TMP/hook-entry-shell-ok.json"
CHECKED=$((CHECKED + 1))
out="$TMP/pos-hook-shell.txt"
if check_hooks_json "$TMP/hook-entry-shell-ok.json" "src/hooks/hooks.json" >"$out" 2>&1; then
  echo "PASS: per-hook shell on temp copy is allowlisted (does not fail)"
else
  echo "FAIL: per-hook shell should be allowlisted but check failed:"
  sed 's/^/    /' "$out"
  FAILED=$((FAILED + 1))
fi

echo ""
if [[ "$FAILED" -gt 0 ]]; then
  echo "Result: FAIL ($FAILED of $CHECKED checks failed)"
  exit 1
fi
echo "Result: PASS ($CHECKED checks)"
