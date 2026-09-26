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

mkdir -p "$FIX/tree/scripts" "$FIX/tree/src/hooks/bin" "$FIX/tree/spec" "$FIX/bin" "$FIX/empty-bin" "$FIX/home"
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
  local prose_event="${3:-}"
  local extension_event="${4:-}"
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
          if (henReviewed.has(e)) continue;
          const nested = acSchema.has(e) ? ",metadata:{unrelated:o().optional()}" : "";
          const additionalContext = acSchema.has(e) ? ",additionalContext:o().optional()" : "";
          if (e === process.argv[3] && acSchema.has(e)) {
            console.log(`u({hookEventName:R("${e}")}).extend({additionalContext:o().optional()})`);
          } else {
            console.log(`({hookEventName:R("${e}")${nested}${additionalContext}})`);
          }
        }
        if (process.argv[2]) {
          console.log(`Hook-specific output for the ${process.argv[2]} event. additionalContext is non-error feedback delivered to the model.`);
        }
        console.log(`({hookEventName:R("CwdChanged")})({additionalContext:o().optional()})`);
        console.log(`({hookEventName:R("CwdChanged"),nested:{additionalContext:o().optional()}})`);
        console.log(`({hookEventName:R("CwdChanged"),extraadditionalContext:o().optional()})`);
      });
    ' "$gen_mod" "$prose_event" "$extension_event"
  } > "$FIX/bin/claude"
  chmod +x "$FIX/bin/claude"
}

run_check() {
  local out="$1"
  ( cd "$FIX/tree" && HOME="$FIX/home" PATH="$FIX/bin:$PATH" \
      node scripts/derive-cc-output-keys.mjs --check >"$out" 2>&1 )
}

run_check_with_pinned_binary() {
  local out="$1"
  local node_dir
  local option_dash=-
  local check_option="${option_dash}${option_dash}check"
  node_dir="$(dirname "$(command -v node)")"
  ( cd "$FIX/tree" && HOME="$FIX/home" PATH="$FIX/empty-bin:/usr/bin:$node_dir" \
      CC_OUTPUT_KEYS_BINARY="$FIX/bin/claude" \
      node scripts/derive-cc-output-keys.mjs "$check_option" >"$out" 2>&1 )
}

has_schema_drift() {
  local out="$1"
  local event="$2"
  awk -v event="$event" '
    /^DRIFT \[ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED\]:/ { active = 1; next }
    active && $0 == "  " event { found = 1 }
    active && /^[^ ]/ { active = 0 }
    END { exit found ? 0 : 1 }
  ' "$out"
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

# 1a. A named binary path resolves the same fixture and reports its check.
OUT="$FIX/pinned-binary.out"
rc=0
run_check_with_pinned_binary "$OUT" || rc=$?
if [[ "$rc" -eq 0 ]] && grep -q 'SCHEMA EVIDENCE' "$OUT"; then
  ok "pinned binary path runs the schema check"
else
  bad "pinned binary path exited $rc or omitted schema evidence"; cat "$OUT"
fi

# 1aa. An invalid pin must not fall back to the fixture found on PATH.
OUT="$FIX/pinned-binary-missing.out"
rc=0
pin_option_dash=-
pin_check_option="${pin_option_dash}${pin_option_dash}check"
( cd "$FIX/tree" && HOME="$FIX/home" PATH="$FIX/bin:$PATH" \
    CC_OUTPUT_KEYS_BINARY="$FIX/missing-claude" \
    node scripts/derive-cc-output-keys.mjs "$pin_check_option" >"$OUT" 2>&1 ) || rc=$?
if [[ "$rc" -eq 2 ]] && grep -q 'explicit binary pin is authoritative' "$OUT"; then
  ok "invalid binary pin exits cannot-observe without PATH fallback"
else
  bad "invalid binary pin exited $rc or fell back to PATH"; cat "$OUT"
fi

# 1b. A direct field supplied by the schema's immediate extend call is proof.
write_fixture_binary "schema extension evidence" "$GEN" "" "Notification"
OUT="$FIX/schema-extension.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 0 ]] && grep -q '^  Notification: resolved in this binary output-schema variant$' "$OUT"; then
  ok "schema extension resolves Notification with explicit evidence output"
else
  bad "schema extension exited $rc or omitted Notification evidence"; cat "$OUT"
fi

# 1c. Removing chained-extension recognition makes that schema entry fail.
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(" ||\n        hasAdditionalContextExtension(strings, schemaObject.end, '\''additionalContext'\'')", "");
  if (s === before) { console.error("mutation failed: extension check not found"); process.exit(2); }
  fs.writeFileSync(p, s);
' "$FIX/tree/scripts/derive-cc-output-keys.mjs"

OUT="$FIX/schema-extension-removed.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 3 ]] && has_schema_drift "$OUT" "Notification"; then
  ok "removing extension recognition fails Notification on the schema DRIFT line"
else
  bad "removing extension recognition exited $rc or missed schema DRIFT"; cat "$OUT"
fi

cp "$SCRIPT" "$FIX/tree/scripts/derive-cc-output-keys.mjs"

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

# 6. A neighbouring or nested key does not count as CwdChanged schema evidence.
cp "$GEN_SRC" "$GEN"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const needle = "export const ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED = new Set([";
  const i = s.indexOf(needle);
  if (i < 0) { console.error("plant failed: schema set not found"); process.exit(2); }
  const insertAt = i + needle.length;
  s = s.slice(0, insertAt) + "\n  '\''CwdChanged'\''," + s.slice(insertAt);
  fs.writeFileSync(p, s);
' "$GEN"

write_fixture_binary "schema-evidence-missing" "$GEN_SRC"
OUT="$FIX/schema-evidence-missing.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 3 ]] && grep -q 'ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED' "$OUT" && grep -q 'CwdChanged' "$OUT"; then
  ok "schema-accepted CwdChanged without a local variant exits 3"
else
  bad "schema evidence gate exited $rc or did not name CwdChanged"; cat "$OUT"
fi

# 7. Removing the schema gate reproduces the former false pass.
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(" || acSchemaEvidence.invalid", "");
  if (s === before) { console.error("mutation failed: schema gate condition not found"); process.exit(2); }
  fs.writeFileSync(p, s);
' "$FIX/tree/scripts/derive-cc-output-keys.mjs"

OUT="$FIX/schema-gate-removed.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 0 ]]; then
  ok "removing the schema gate makes planted CwdChanged pass"
else
  bad "removing the schema gate exited $rc (want 0)"; cat "$OUT"
fi

cp "$SCRIPT" "$FIX/tree/scripts/derive-cc-output-keys.mjs"

# 8. A schema-only entry cannot also claim trace-and-observe evidence.
cp "$GEN_SRC" "$GEN"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");
  const needle = "export const ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS = new Set([";
  const i = s.indexOf(needle);
  if (i < 0) { console.error("plant failed: reviewed set not found"); process.exit(2); }
  const insertAt = i + needle.length;
  s = s.slice(0, insertAt) + "\n  '\''Notification'\''," + s.slice(insertAt);
  fs.writeFileSync(p, s);
' "$GEN"

write_fixture_binary "schema-reviewed-overlap" "$GEN_SRC"
OUT="$FIX/schema-reviewed-overlap.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 3 ]] && has_schema_drift "$OUT" "Notification"; then
  ok "overlapping schema and reviewed entries exit 3"
else
  bad "classification overlap exited $rc or did not name Notification"; cat "$OUT"
fi

# 9. A binary-prose-correlated schema entry is stale and should be removed.
cp "$GEN_SRC" "$GEN"
write_fixture_binary "schema-entry-now-prose-corroborated" "$GEN_SRC" "Notification"
OUT="$FIX/schema-stale.out"
rc=0
run_check "$OUT" || rc=$?
if [[ "$rc" -eq 0 ]] && grep -q 'STALE \[ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED\]' "$OUT" && grep -q 'Notification' "$OUT"; then
  ok "schema entry with binary prose evidence is reported stale"
else
  bad "stale schema report exited $rc or did not name Notification"; cat "$OUT"
fi

echo ""
echo "derive-cc-output-keys hookEventName arbitration: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
