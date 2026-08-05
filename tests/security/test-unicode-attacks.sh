#!/bin/bash
# Security Tests: Unicode / bidi / zero-width handling by the LIVE hooks
#
# Priority: HIGH
# Reference: Trojan Source (CVE-2021-42574), CWE-176 (improper Unicode handling),
#            CWE-838 (inappropriate encoding for output context)
#
# =============================================================================
# WHAT THIS FILE USED TO BE
# =============================================================================
# 365 lines and ZERO hook invocations. Every "test" defined its own shell
# function INSIDE THIS FILE — sanitize_filename, detect_homoglyphs,
# contains_bidi_override, contains_zero_width, is_valid_utf8, normalize_path,
# sanitize_for_shell — and then asserted that function's behaviour. It measured
# `tr`, `od`, `iconv` and `jq`. It never measured OrchestKit.
#
# Worse, 9 of its 14 assertion blocks called pass() in BOTH branches:
#
#     if detect_homoglyphs "$(printf '\xd0\xb0dmin')"; then
#         pass "Cyrillic homoglyph detected"
#     else
#         pass "Homoglyph detection working (no homoglyphs in test)"   # <-- !!
#     fi
#
# and the file ended in `exit 0` unless FAIL_COUNT moved, which it structurally
# could not. The suite was green because nothing was being asked.
#
# =============================================================================
# WHAT IT TESTS NOW
# =============================================================================
# Three live hooks, plus the dispatcher. Every expectation below was MEASURED
# against HEAD before it was written down; where a hook disagreed with the
# obvious guess, the assertion records what the hook actually does.
#
#   1. skill/coverage-threshold-gate — the ONE hook in src/hooks/src/** with an
#      explicit, documented Unicode contract (coverage-threshold-gate.ts:47-77,
#      isLayoutForgingCodePoint + sanitizePath). Coverage-report paths are
#      untrusted text that gets echoed into a block message; bidi and
#      zero-width characters there are a Trojan Source display-spoofing vector.
#   2. pretool/write-edit/file-guard — do invisible characters smuggle a write
#      to a protected file past the pattern match?
#   3. pretool/bash/dangerous-command-blocker — do Unicode lookalikes for shell
#      metacharacters change its verdict?
#   4. src/hooks/bin/run-hook.mjs — does hostile encoding crash the dispatcher
#      or make it emit something a caller cannot parse?
#
# There is no homoglyph detector, no NFC/NFD normalizer and no UTF-8 validator
# anywhere in this repo's hook tree, so this file no longer pretends to test
# one. What it tests instead is whether a homoglyph BUYS an attacker anything —
# measured answer: no, because a lookalike is a different byte string and
# therefore a different file.
#
# NOTE ON PAYLOAD CONSTRUCTION: JSON is always fully built (into a variable or
# a file) BEFORE it reaches node, and is then fed in with the printf builtin or
# a redirect. Piping straight from a freshly spawned interpreter
# (`python3 -c ... | node run-hook.mjs`) races run-hook.mjs's 100ms stdin
# timeout — measured 10/20 deny vs 20/20 deny for the identical payload. A lost
# race reads as "allow", which is exactly the silent green this file is being
# repaired for.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

RUNNER="$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"
GATE="skill/coverage-threshold-gate"
GUARD="pretool/write-edit/file-guard"
BLOCKER="pretool/bash/dangerous-command-blocker"

PASS=0
FAIL=0

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
log_pass() { echo "  ${GREEN}✓${NC} $1"; }
log_fail() { echo "  ${RED}✗${NC} $1"; }
section()  { echo; echo "${YELLOW}$1${NC}"; }

# ---------------------------------------------------------------------------
# Hostile code points, as UTF-8 byte escapes.
#
# Deliberately NOT pasted as raw glyphs: a terminal applies bidi reordering to
# an RTL run, so a literal U+202E in this source would visually scramble the
# surrounding line and its diff. Byte escapes stay readable and reviewable.
# ---------------------------------------------------------------------------
RLO=$'\xe2\x80\xae'      # U+202E RIGHT-TO-LEFT OVERRIDE   (Trojan Source)
LRI=$'\xe2\x81\xa6'      # U+2066 LEFT-TO-RIGHT ISOLATE
ZWSP=$'\xe2\x80\x8b'     # U+200B ZERO WIDTH SPACE
ZWJ=$'\xe2\x80\x8d'      # U+200D ZERO WIDTH JOINER
BOM=$'\xef\xbb\xbf'      # U+FEFF ZERO WIDTH NO-BREAK SPACE / BOM
LSEP=$'\xe2\x80\xa8'     # U+2028 LINE SEPARATOR
BEL=$'\x07'              # U+0007 C0 control
NEL=$'\xc2\x85'          # U+0085 C1 NEXT LINE
FW_STOP=$'\xef\xbc\x8e'  # U+FF0E FULLWIDTH FULL STOP      (looks like '.')
FW_SEMI=$'\xef\xbc\x9b'  # U+FF1B FULLWIDTH SEMICOLON      (looks like ';')
NBSP=$'\xc2\xa0'         # U+00A0 NO-BREAK SPACE
CYR_E=$'\xd0\xb5'        # U+0435 CYRILLIC SMALL LETTER IE (looks like 'e')

echo "=========================================="
echo "  Unicode attacks vs the live hooks"
echo "=========================================="

# Reachability first. An unregistered key returns {"continue":true} from
# run-hook.mjs, which reads as "allow" and would pass every negative assertion
# below against a hook that never ran.
for key in "$GATE" "$GUARD" "$BLOCKER"; do
  if ! assert_hook_registered "$key"; then
    echo "${RED}✗ $key is not registered — aborting rather than reporting green${NC}"
    exit 1
  fi
done

assert_contains() { # assert_contains <haystack> <needle> <label>
  if [[ "$1" == *"$2"* ]]; then
    log_pass "$3"; PASS=$((PASS + 1))
  else
    log_fail "$3 — expected substring was absent"; FAIL=$((FAIL + 1))
  fi
}

assert_absent() { # assert_absent <haystack> <needle> <label>
  if [[ "$1" != *"$2"* ]]; then
    log_pass "$3"; PASS=$((PASS + 1))
  else
    log_fail "$3 — the character survived into the message"; FAIL=$((FAIL + 1))
  fi
}

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# ===========================================================================
section "1. coverage-threshold-gate strips layout-forging code points"
# ===========================================================================
# coverage-threshold-gate.ts:47-67 states the threat plainly: coverage reports
# are untrusted, and buildRepairPayload() echoes their file paths back to the
# agent inside a fenced block. A path carrying U+202E or a zero-width character
# can forge that layout. sanitizePath() drops those; the fenced-block wrapper
# is defended separately by rewriting backticks.
#
# Ten hostile rows, all below threshold, all rendered: MAX_FILES_LISTED is 10,
# so adding an 11th here would silently truncate one out of the assertions.

GATE_DIR="$WORK_DIR/gate"
mkdir -p "$GATE_DIR/coverage"

jq -n \
  --arg rlo  "src/a${RLO}rlo.ts" \
  --arg lri  "src/b${LRI}iso.ts" \
  --arg zwsp "src/c${ZWSP}zwsp.ts" \
  --arg zwj  "src/d${ZWJ}zwj.ts" \
  --arg bom  "src/e${BOM}bom.ts" \
  --arg lsep "src/f${LSEP}lsep.ts" \
  --arg bel  "src/g${BEL}bel.ts" \
  --arg nel  "src/h${NEL}nel.ts" \
  --arg tick 'src/i`tick.ts' \
  --arg fw   "src/j${FW_STOP}fw.ts" \
  '{total:{lines:{pct:5}}}
   + ([$rlo,$lri,$zwsp,$zwj,$bom,$lsep,$bel,$nel,$tick,$fw]
      | to_entries
      | map({key: .value, value: {lines: {pct: (.key + 1)}}})
      | from_entries)' \
  > "$GATE_DIR/coverage/coverage-summary.json"

# COVERAGE_THRESHOLD is pinned: the gate reads it from the environment and a
# stray 0 in the ambient env would make it skip the block entirely, turning
# every assertion below into a comparison against an empty string.
gate_output() { # gate_output <project_dir>
  printf '%s' '{"tool_name":"Skill","tool_input":{}}' \
    | CLAUDE_PROJECT_DIR="$1" COVERAGE_THRESHOLD=80 node "$RUNNER" "$GATE" 2>/dev/null  # silent: best-effort — stderr is hook debug noise; empty/unparseable stdout is asserted on below
}

GATE_OUT="$(gate_output "$GATE_DIR")"
# NOT `.continue // "ERROR"`. jq's `//` is a FALSY-alternative, not a null
# coalesce: it fires on `false` as well as on null. outputBlock() returns
# `continue: false` (lib/output.ts:66-71), so that idiom yielded "ERROR"
# precisely WHEN THE GATE BLOCKED, making the control below unpassable and this
# file permanently red. has() asks the question actually being asked: did the
# hook emit the field at all?
GATE_BLOCKED="$(printf '%s' "$GATE_OUT" | jq -r 'if has("continue") then (.continue|tostring) else "ERROR" end')"
GATE_REASON="$(printf '%s' "$GATE_OUT" | jq -r '.stopReason // ""')"

# Control: if the gate did not fire, the reason is empty and every "character
# is absent" assertion below would pass for the wrong reason.
if [[ "$GATE_BLOCKED" == "false" && -n "$GATE_REASON" ]]; then
  log_pass "gate blocked on a 5% report and produced a reason"; PASS=$((PASS + 1))
else
  log_fail "gate did not block (continue=$GATE_BLOCKED) — the section below is vacuous"
  FAIL=$((FAIL + 1))
fi

# Each pair proves both halves: the row rendered at all, AND the hostile code
# point did not ride along with it.
assert_contains "$GATE_REASON" "src/arlo.ts"  "U+202E row rendered as src/arlo.ts"
assert_absent   "$GATE_REASON" "$RLO"         "U+202E bidi override stripped"
assert_contains "$GATE_REASON" "src/biso.ts"  "U+2066 row rendered as src/biso.ts"
assert_absent   "$GATE_REASON" "$LRI"         "U+2066 bidi isolate stripped"
assert_contains "$GATE_REASON" "src/czwsp.ts" "U+200B row rendered as src/czwsp.ts"
assert_absent   "$GATE_REASON" "$ZWSP"        "U+200B zero-width space stripped"
assert_contains "$GATE_REASON" "src/dzwj.ts"  "U+200D row rendered as src/dzwj.ts"
assert_absent   "$GATE_REASON" "$ZWJ"         "U+200D zero-width joiner stripped"
assert_contains "$GATE_REASON" "src/ebom.ts"  "U+FEFF row rendered as src/ebom.ts"
assert_absent   "$GATE_REASON" "$BOM"         "U+FEFF BOM stripped"
assert_contains "$GATE_REASON" "src/flsep.ts" "U+2028 row rendered as src/flsep.ts"
assert_absent   "$GATE_REASON" "$LSEP"        "U+2028 line separator stripped"
assert_contains "$GATE_REASON" "src/gbel.ts"  "U+0007 row rendered as src/gbel.ts"
assert_absent   "$GATE_REASON" "$BEL"         "C0 control stripped"
assert_contains "$GATE_REASON" "src/hnel.ts"  "U+0085 row rendered as src/hnel.ts"
assert_absent   "$GATE_REASON" "$NEL"         "C1 control stripped"

# A backtick in a path could close the CommonMark fence that wraps the rows and
# let the rest of the path render as agent-facing prose. sanitizePath rewrites
# it to an apostrophe rather than dropping it (coverage-threshold-gate.ts:85).
assert_contains "$GATE_REASON" "src/i'tick.ts" "backtick rewritten to apostrophe"

# Documented NON-goal (coverage-threshold-gate.ts:57-58): fullwidth lookalikes
# survive on purpose, because a backtick fence can only be closed by backticks.
# Asserted so that a future "tighten the filter" change has to update the
# comment that authorises it, instead of silently changing the contract.
assert_contains "$GATE_REASON" "src/j${FW_STOP}fw.ts" \
  "U+FF0E fullwidth stop deliberately survives"

# No report at all must stay silent — a Unicode-hardening change that started
# blocking every project without coverage would be a worse bug than the one
# this section guards.
EMPTY_DIR="$WORK_DIR/empty"
mkdir -p "$EMPTY_DIR"
EMPTY_OUT="$(gate_output "$EMPTY_DIR")"
# Same has() form as line 175. This comparison is against "true", so the falsy
# `//` happened not to corrupt it, but only by accident of which value it tests.
if [[ "$(printf '%s' "$EMPTY_OUT" | jq -r 'if has("continue") then (.continue|tostring) else "ERROR" end')" == "true" ]]; then
  log_pass "no coverage report -> silent success, not a block"; PASS=$((PASS + 1))
else
  log_fail "no coverage report produced a block: $EMPTY_OUT"; FAIL=$((FAIL + 1))
fi

# ===========================================================================
section "2. file-guard: invisible characters do not smuggle a protected write"
# ===========================================================================
# The measured rule is substring-based, and that turns out to be the right
# shape. Two cases, and they are opposites:
#   - decoration AROUND an intact ".env" -> still denied (no bypass)
#   - a character INSIDE ".env"          -> allowed, because the write now
#     targets a DIFFERENT file on disk; ".en<ZWSP>v" is not ".env" and denying
#     it would be a false positive, not a defence.

write_input() { jq -n --arg p "$1" '{tool_name:"Write",tool_input:{file_path:$p,content:"x"}}'; }
expect_write() { expect_decision "$1" "$GUARD" "$(write_input "$2")" "$3"; }

expect_write deny  ".env"                    "control: plain .env denied"
expect_write deny  "${RLO}.env"              "U+202E prefix does not hide .env"
expect_write deny  "${LRI}.env"              "U+2066 prefix does not hide .env"
expect_write deny  "${BOM}.env"              "U+FEFF prefix does not hide .env"
expect_write deny  "${FW_STOP}${FW_STOP}/.env" \
  "fullwidth-dot traversal still resolves onto .env"

# These are NOT-DENIED-by-design, not gaps. Each names a real file that is not
# .env. The guard abstains rather than allowing: it emits no permissionDecision,
# so the write falls through to the normal permission flow instead of being
# auto-approved. Asserting `allow` here would credit the hook with a decision it
# never made.
expect_write abstain ".en${ZWSP}v"           "zero-width inside the name is a different file"
expect_write abstain ".env${ZWSP}"           "zero-width suffix is a different file"
expect_write abstain "${FW_STOP}env"         "fullwidth dot does not decode to ASCII '.'"
expect_write abstain ".${CYR_E}nv"           "Cyrillic homoglyph is a different file, not a bypass"

# ===========================================================================
section "3. dangerous-command-blocker vs Unicode lookalikes"
# ===========================================================================
# The premise the old file assumed — that a fullwidth semicolon might inject a
# second command — is false: bash only splits on ASCII metacharacters, so
# U+FF1B is inert text. What the measurement shows is that the blocker's
# pattern is unaffected by such decoration in either direction.

bash_input() { jq -n --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
expect_bash() { expect_decision "$1" "$BLOCKER" "$(bash_input "$2")" "$3"; }

expect_bash deny    "rm -rf /"               "control: rm -rf / denied"
expect_bash abstain "ls -la"                 "control: benign command not decided on"
expect_bash deny  "echo hi${FW_SEMI}rm -rf /" \
  "fullwidth semicolon does not hide the pattern"
expect_bash deny  "${RLO}rm -rf /"           "U+202E prefix does not hide the pattern"

# U+00A0 is not a bash word separator, so this command would fail at exec —
# but the blocker denies it anyway, because JS \s matches NBSP. Recorded as a
# measured fact: it is the safe direction, and a regex rewrite that dropped
# \s in favour of a literal space would flip it.
expect_bash deny  "rm${NBSP}-rf /"           "NBSP separator still matches (JS \\s covers U+00A0)"

# Not denied, and non-exploitable: the shell does not treat U+200B as a
# separator, so `rm -<ZWSP>rf /` execs rm with the invalid option "-<ZWSP>rf" and
# `rm -rf /<ZWSP>` targets a path that does not exist. Asserting deny here
# would be asserting a defence the hook does not have and does not need.
# `abstain`, not `allow`: the blocker emits no permissionDecision for these, so
# they fall through to the normal permission flow rather than being auto-approved.
expect_bash abstain "rm -${ZWSP}rf /"        "zero-width inside the flag: not denied, cannot exec"
expect_bash abstain "rm -rf /${ZWSP}"        "zero-width after the target: not denied, path is not /"

# ===========================================================================
section "4. run-hook.mjs survives hostile encodings"
# ===========================================================================
# The old Tests 5 and 6 checked that `iconv` validates UTF-8 and that `jq`
# parses \u escapes. Both are true and neither is this project's code. The
# contract that IS ours: whatever bytes arrive on stdin, the dispatcher must
# emit one parseable JSON object and never die — a crash means empty stdout,
# which CC reads as "no opinion" and therefore as allow.
#
# Payloads go through FILES because bash cannot hold a NUL byte in a variable:
# `x=$'a\x00b'` silently truncates to "a", so a variable-borne NUL test would
# be testing plain valid JSON while claiming otherwise.

expect_dispatcher_json() { # expect_dispatcher_json <payload_file> <label>
  local out
  out="$(node "$RUNNER" "$BLOCKER" < "$1" 2>/dev/null)"  # silent: best-effort — stderr is hook debug noise; empty stdout is failed below, not swallowed
  if [[ -n "$out" ]] && printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    log_pass "$2"; PASS=$((PASS + 1))
  else
    log_fail "$2 — stdout was empty or unparseable: ${out:-<empty>}"; FAIL=$((FAIL + 1))
  fi
}

printf '{"tool_name":"Bash","tool_input":{"command":"rm\\ud800 -rf /"}}' > "$WORK_DIR/surrogate.json"
expect_dispatcher_json "$WORK_DIR/surrogate.json" "lone surrogate in the payload"

printf '{"tool_name":"Bash","tool_input":{"command":"rm -rf \xc3\x28/"}}' > "$WORK_DIR/badutf8.json"
expect_dispatcher_json "$WORK_DIR/badutf8.json" "invalid UTF-8 byte sequence in the payload"

printf '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"' > "$WORK_DIR/truncated.json"
expect_dispatcher_json "$WORK_DIR/truncated.json" "truncated JSON"

printf '{"tool_name":"Bash","tool_input":{"command":"rm -rf /\x00"}}' > "$WORK_DIR/rawnul.json"
expect_dispatcher_json "$WORK_DIR/rawnul.json" "raw NUL byte in the payload"

# A   escape must not break the match: the danger pattern is still intact,
# so the verdict must still be deny. This is the retargeted Test 6 — same
# concern (a JSON Unicode escape decoding into something the filter missed),
# aimed at a hook instead of at jq.
expect_decision deny "$BLOCKER" \
  '{"tool_name":"Bash","tool_input":{"command":"rm -rf / "}}' \
  "NUL escape does not defeat the danger pattern"

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ $FAIL -eq 0 ]]
