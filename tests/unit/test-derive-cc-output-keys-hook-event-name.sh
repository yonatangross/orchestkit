#!/usr/bin/env bash
# Regression for #4291: derive-cc-output-keys check mode must arbitrate
# EVENTS_WITH_HOOK_EVENT_NAME bidirectionally. A planted drift MUST fail;
# a clean fixture MUST pass. CI has no Claude Code binary, so the "binary"
# is a committed-style fixture (same shape as tests/ci/fault-arms/verify-cc-keys.sh).
#
# The fixture binary must NOT emit hookEventName:R for events in
# HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS (PostCompact). Emitting R for every
# EVENTS_WITH_HOOK_EVENT_NAME member made the exception set vacuous: emptying
# it still exited 0. Real CC 2.1.278 has no R("PostCompact") in the output
# schema; the fixture must mirror that asymmetry.
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

# Write a fixture claude binary from a generated module path.
# HEN R("...") literals skip HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS so PostCompact
# stays uncorroborated (real binary shape). AC prose still covers the full
# EVENTS_WITH_ADDITIONAL_CONTEXT set (AC reviewed path is separate).
write_fixture_binary() {
  local label="$1"
  local gen_mod="$2"
  {
    echo "hookSpecificOutput fixture binary: ${label}"
    node -e '
      import(process.argv[1]).then((m) => {
        const acSchema =
          m.ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED instanceof Set
            ? m.ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED
            : new Set();
        for (const e of m.EVENTS_WITH_ADDITIONAL_CONTEXT) {
          // Skip schema-accepted: no prose in the real binary either. Emitting
          // prose here would corroborate them and hide the SCHEMA_ACCEPTED path.
          if (acSchema.has(e)) continue;
          console.log(`Hook-specific output for the ${e} event. additionalContext is non-error feedback delivered to the model.`);
        }
        if (m.EVENTS_WITH_ADDITIONAL_CONTEXT.has("PostToolBatch")) {
          console.log("Return additionalContext via hookSpecificOutput to inject context once for the whole batch.");
        }
        const henReviewed =
          m.HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS instanceof Set
            ? m.HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS
            : new Set();
        for (const e of m.EVENTS_WITH_HOOK_EVENT_NAME) {
          if (!henReviewed.has(e)) console.log(`hookEventName:R("${e}")`);
        }
      });
    ' "$gen_mod"
  } > "$FIX/bin/claude"
  chmod +x "$FIX/bin/claude"
}

run_check() {
  local out="$1"
  ( cd "$FIX/tree" && HOME="$FIX/home" PATH="$FIX/bin:$PATH" \
      node scripts/derive-cc-output-keys.mjs --check >"$out" 2>&1 )
}

pass=0
fail=0
ok() { echo "  PASS: $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL: $1"; fail=$((fail + 1)); }

GEN="$FIX/tree/src/hooks/bin/cc-output-keys.generated.mjs"

# ── 1. Control: clean set + real-shape binary (no R PostCompact) passes ─────
write_fixture_binary "control (skip HEN reviewed exceptions)" "$GEN"
OUT="$FIX/control.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 0 ]] && grep -q 'PostCompact' "$OUT"; then
  ok "clean set passes with PostCompact as reviewed exception (no R literal)"
else
  bad "clean set exited $rc or did not mention PostCompact (want 0 + reviewed log)"; cat "$OUT"
fi

# ── 2. Planted missing: binary has CwdChanged, generated set does not ───────
cp "$GEN_SRC" "$GEN"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(/\n  '\''CwdChanged'\'',/, "\n");
  if (s === before) { console.error("plant failed: CwdChanged not found"); process.exit(2); }
  fs.writeFileSync(p, s);
' "$GEN"

# Binary from ORIGINAL so CwdChanged remains in R() extract.
write_fixture_binary "planted-missing" "$GEN_SRC"

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

write_fixture_binary "planted-reverse" "$GEN_SRC"

OUT="$FIX/reverse.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -ne 0 ]] && grep -q 'EVENTS_WITH_HOOK_EVENT_NAME' "$OUT" && grep -q 'FakeEvent' "$OUT"; then
  ok "planted reverse FakeEvent fails and names the event + set"
else
  bad "planted reverse did not fail naming FakeEvent (rc=$rc)"; cat "$OUT"
fi

# ── 4. Cleared HEN reviewed exceptions: PostCompact unreviewed must exit 3 ──
# Binary has no R("PostCompact"); generated still lists PostCompact; exception
# set emptied. This is the arm the vacuous fixture previously could not fail.
cp "$GEN_SRC" "$GEN"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(
    /export const HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS = new Set\(\[[\s\S]*?\]\);/,
    "export const HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS = new Set([]);"
  );
  if (s === before) { console.error("plant failed: HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS not found"); process.exit(2); }
  fs.writeFileSync(p, s);
' "$GEN"

# Binary from the CLEARED module: henReviewed is empty, so R("PostCompact")
# would be emitted if we built from $GEN. Build from GEN_SRC (exceptions still
# present there) so the binary omits PostCompact while the tree module lacks
# the exception. That is the real-CC asymmetry.
write_fixture_binary "cleared-hen-reviewed" "$GEN_SRC"

OUT="$FIX/cleared.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 3 ]] && grep -q 'EVENTS_WITH_HOOK_EVENT_NAME' "$OUT" && grep -q 'PostCompact' "$OUT"; then
  ok "cleared HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS exits 3 naming PostCompact"
else
  bad "cleared exceptions exited $rc (want 3) or did not name PostCompact"; cat "$OUT"
fi

# ── 5. Sanity: emptying exceptions under a vacuous R(PostCompact) binary
#    would pass; prove our fixture builder does NOT emit that literal when
#    GEN_SRC still lists PostCompact as reviewed.
VACUOUS="$FIX/vacuous-probe.txt"
node -e '
  import(process.argv[1]).then((m) => {
    const henReviewed =
      m.HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS instanceof Set
        ? m.HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS
        : new Set();
    const emitted = [];
    for (const e of m.EVENTS_WITH_HOOK_EVENT_NAME) {
      if (!henReviewed.has(e)) emitted.push(e);
    }
    if (emitted.includes("PostCompact")) {
      console.error("fixture would emit R(PostCompact); exception path is vacuous");
      process.exit(1);
    }
    if (!m.EVENTS_WITH_HOOK_EVENT_NAME.has("PostCompact")) {
      console.error("PostCompact missing from HEN set");
      process.exit(1);
    }
    if (!henReviewed.has("PostCompact")) {
      console.error("PostCompact missing from HEN reviewed exceptions");
      process.exit(1);
    }
    console.log("ok: PostCompact in HEN + reviewed, absent from R extract");
  });
' "$GEN_SRC" >"$VACUOUS" 2>&1
if [[ $? -eq 0 ]]; then
  ok "fixture builder omits R(PostCompact) while keeping the reviewed exception"
else
  bad "fixture builder still emits or drops PostCompact inconsistently"; cat "$VACUOUS"
fi

echo ""
echo "derive-cc-output-keys hookEventName arbitration: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
