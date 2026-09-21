#!/usr/bin/env bash
# Regression for #4291: derive-cc-output-keys check mode must arbitrate
# EVENTS_WITH_HOOK_EVENT_NAME bidirectionally. A planted drift MUST fail;
# a clean fixture MUST pass. CI has no Claude Code binary, so the "binary"
# is a committed-style fixture (same shape as tests/ci/fault-arms/verify-cc-keys.sh).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/derive-cc-output-keys.mjs"
GEN_SRC="$REPO_ROOT/src/hooks/bin/cc-output-keys.generated.mjs"
SPEC_SRC="$REPO_ROOT/spec/cc-output-keys.spec.yml"

FIX="$(mktemp -d "${TMPDIR:-/tmp}/ork-hen-arbitrate.XXXXXX")"
cleanup() { rm -rf "$FIX"; }
trap cleanup EXIT

mkdir -p "$FIX/tree/scripts" "$FIX/tree/src/hooks/bin" "$FIX/tree/spec" "$FIX/bin" "$FIX/home"
cp "$SCRIPT" "$FIX/tree/scripts/"
cp "$GEN_SRC" "$FIX/tree/src/hooks/bin/"
cp "$SPEC_SRC" "$FIX/tree/spec/"

# Fixture binary: embed additionalContext prose + hookEventName:R literals for
# every event the generated Sets assert. Mirrors verify-cc-keys.sh so the
# binary comparison is satisfied and only the generated Set varies between arms.
{
  echo "hookSpecificOutput fixture binary for tests/unit/test-derive-cc-output-keys-hook-event-name.sh"
  node -e '
    import(process.argv[1]).then((m) => {
      for (const e of m.EVENTS_WITH_ADDITIONAL_CONTEXT) {
        console.log(`Hook-specific output for the ${e} event. additionalContext is non-error feedback delivered to the model.`);
      }
      if (m.EVENTS_WITH_ADDITIONAL_CONTEXT.has("PostToolBatch")) {
        console.log("Return additionalContext via hookSpecificOutput to inject context once for the whole batch.");
      }
      for (const e of m.EVENTS_WITH_HOOK_EVENT_NAME) {
        console.log(`hookEventName:R("${e}")`);
      }
    });
  ' "$FIX/tree/src/hooks/bin/cc-output-keys.generated.mjs"
} > "$FIX/bin/claude"
chmod +x "$FIX/bin/claude"

run_check() {
  local out="$1"
  ( cd "$FIX/tree" && HOME="$FIX/home" PATH="$FIX/bin:$PATH" \
      node scripts/derive-cc-output-keys.mjs --check >"$out" 2>&1 )
}

pass=0
fail=0
ok() { echo "  PASS: $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL: $1"; fail=$((fail + 1)); }

# ── 1. Control: clean generated set passes ──────────────────────────────────
OUT="$FIX/control.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 0 ]]; then
  ok "clean EVENTS_WITH_HOOK_EVENT_NAME passes check mode"
else
  bad "clean set exited $rc (want 0)"; cat "$OUT"
fi

# ── 2. Planted missing: binary has CwdChanged, generated set does not ───────
GEN="$FIX/tree/src/hooks/bin/cc-output-keys.generated.mjs"
cp "$GEN_SRC" "$GEN"
# Drop CwdChanged from the Set literal (fixture binary still emits it because
# we rebuild the binary from the PRE-mutation file below).
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(/\n  '\''CwdChanged'\'',/, "\n");
  if (s === before) { console.error("plant failed: CwdChanged not found"); process.exit(2); }
  fs.writeFileSync(p, s);
' "$GEN"

# Rebuild fixture binary from the ORIGINAL generated module so CwdChanged remains
# in the binary while the mutated module lacks it.
{
  echo "hookSpecificOutput fixture binary for planted-missing arm"
  node -e '
    import(process.argv[1]).then((m) => {
      for (const e of m.EVENTS_WITH_ADDITIONAL_CONTEXT) {
        console.log(`Hook-specific output for the ${e} event. additionalContext is non-error feedback delivered to the model.`);
      }
      if (m.EVENTS_WITH_ADDITIONAL_CONTEXT.has("PostToolBatch")) {
        console.log("Return additionalContext via hookSpecificOutput to inject context once for the whole batch.");
      }
      for (const e of m.EVENTS_WITH_HOOK_EVENT_NAME) {
        console.log(`hookEventName:R("${e}")`);
      }
    });
  ' "$GEN_SRC"
} > "$FIX/bin/claude"
chmod +x "$FIX/bin/claude"

OUT="$FIX/missing.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -ne 0 ]] && grep -q 'EVENTS_WITH_HOOK_EVENT_NAME' "$OUT" && grep -q 'CwdChanged' "$OUT"; then
  ok "planted missing CwdChanged fails and names the event + set"
else
  bad "planted missing did not fail naming CwdChanged (rc=$rc)"; cat "$OUT"
fi

# ── 3. Planted reverse: generated has FakeEvent, binary does not ────────────
cp "$GEN_SRC" "$GEN"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const needle = "export const EVENTS_WITH_HOOK_EVENT_NAME = new Set([";
  const i = s.indexOf(needle);
  if (i < 0) { console.error("plant failed: Set not found"); process.exit(2); }
  const insertAt = i + needle.length;
  s = s.slice(0, insertAt) + "\n  '\''FakeEvent'\''," + s.slice(insertAt);
  fs.writeFileSync(p, s);
' "$GEN"

# Binary from ORIGINAL (no FakeEvent)
{
  echo "hookSpecificOutput fixture binary for planted-reverse arm"
  node -e '
    import(process.argv[1]).then((m) => {
      for (const e of m.EVENTS_WITH_ADDITIONAL_CONTEXT) {
        console.log(`Hook-specific output for the ${e} event. additionalContext is non-error feedback delivered to the model.`);
      }
      if (m.EVENTS_WITH_ADDITIONAL_CONTEXT.has("PostToolBatch")) {
        console.log("Return additionalContext via hookSpecificOutput to inject context once for the whole batch.");
      }
      for (const e of m.EVENTS_WITH_HOOK_EVENT_NAME) {
        console.log(`hookEventName:R("${e}")`);
      }
    });
  ' "$GEN_SRC"
} > "$FIX/bin/claude"
chmod +x "$FIX/bin/claude"

OUT="$FIX/reverse.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -ne 0 ]] && grep -q 'EVENTS_WITH_HOOK_EVENT_NAME' "$OUT" && grep -q 'FakeEvent' "$OUT"; then
  ok "planted reverse FakeEvent fails and names the event + set"
else
  bad "planted reverse did not fail naming FakeEvent (rc=$rc)"; cat "$OUT"
fi

echo ""
echo "derive-cc-output-keys hookEventName arbitration: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
