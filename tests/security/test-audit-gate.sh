#!/usr/bin/env bash
# Proof for the npm audit gate that judges the CHANGE (orchestkit row 10, part 2; conductor335's
# ruling and its addendum): the pre-push hook and the pull_request runs of "Security Tests" and
# "Dependency Audit" decide through ONE script, .github/scripts/audit-gate.sh, and push to main and
# the schedule stay whole-tree.
#
# Every row runs a REAL entry point against a throwaway git repo whose lockfiles are committed text
# (no network, no install): the advisory source is the same stub seam Part 1 uses
# (ORK_AUDIT_WRAPPER), keyed by the repo's directory name, with advisory ids shaped like npm's.
#   layer A  .github/scripts/audit-gate.sh                 (the "Dependency Audit" pull_request step)
#   layer B  tests/security/test-npm-audit.sh              (the "Security Tests" row, on pull_request
#                                                           and on push)
#   layer C  bin/git-hooks/pre-push, security stage        (the hook, through run-security-tests.sh
#                                                           into the real test-npm-audit.sh)
#   layer D  structure: ci.yml, the scheduled workflow and the hook name the gate and the base fetch
# Acceptance rows (ruling): 1 an added vulnerable package fails; 2 an untouched moderate transitive
# advisory passes and is named as deferred; 3 an untouched high fails; 4 an unreadable diff, an
# unreachable advisory source and zero packages each fail with their own message; 5 push and schedule
# stay whole-tree; 6 red first (each row fails at main, shown in the artifact's red log).

set -euo pipefail

# The fixture repos are disposable; never let an inherited GIT_* redirect git into the caller's repo.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# expect_classification lives here. Sourcing it puts this file on the mutation protocol
# tests/security/mutation-gate.sh reads, so the gate can prove the first assertion below can fail.
# The helper sets its own SCRIPT_DIR and EXIT trap; nothing below reads SCRIPT_DIR, and this file
# installs its own EXIT trap after the source.
# shellcheck source=../fixtures/test-helpers.sh
source "$REPO_ROOT/tests/fixtures/test-helpers.sh"
# shellcheck source=../fixtures/git-isolate.sh
source "$REPO_ROOT/tests/fixtures/git-isolate.sh"

PASS=0
FAIL=0
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
check() {
    local label="$1" got="$2" want="$3"
    if [[ "$got" == "$want" ]]; then ok "$label (got: $got)"; else bad "$label (got: $got, want: $want)"; fi
}
# count_lines <file> <fixed text>: how many lines of the file contain the text (awk, so no grep exit status to mask)
count_lines() { awk -v needle="$2" 'index($0, needle) { n++ } END { print n + 0 }' "$1"; }
# state <exit status>: refused for any nonzero status, passed for zero
state() { if [[ "$1" -ne 0 ]]; then echo refused; else echo passed; fi; }
# present <count>: yes when the count is above zero
present() { if [[ "$1" -gt 0 ]]; then echo yes; else echo no; fi; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork.auditgate.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
git_isolate "$TMP"

# ─── the advisory source: a stub of npm-audit-with-retry.sh, keyed by the directory name ──
# Prints $STUB_REPORTS/<dir name>.json (exit 1 when it lists vulnerabilities, as npm does), else a
# <dir name>.raw file as-is with exit 1, else nothing with exit 1 (npm failing without a report).
STUB="$TMP/stub-wrapper.sh"
cat > "$STUB" <<'EOF'
#!/usr/bin/env bash
name="$(basename "$1")"
f="$STUB_REPORTS/$name.json"
if [[ -f "$f" ]]; then
  cat "$f"
  if jq -e '(.metadata.vulnerabilities.total // 0) > 0' "$f" > /dev/null; then exit 1; fi
  exit 0
fi
if [[ -f "$STUB_REPORTS/$name.raw" ]]; then
  cat "$STUB_REPORTS/$name.raw"
fi
exit 1
EOF
chmod +x "$STUB"
export STUB_REPORTS="$TMP/reports"
mkdir -p "$STUB_REPORTS"

# adv_report <packages examined> <severity> <advisory id> <package>: one advisory in one package
adv_report() {
    jq -n --argjson total "$1" --arg sev "$2" --argjson id "$3" --arg pkg "$4" '
      {vulnerabilities: {($pkg): {name: $pkg, severity: $sev,
         via: [{source: $id, name: $pkg, title: "Stub advisory \($id) in \($pkg)", severity: $sev, range: "<9.9.9"}]}},
       metadata: {vulnerabilities: {info: 0, low: 0, moderate: (if $sev == "moderate" then 1 else 0 end),
                                    high: (if $sev == "high" then 1 else 0 end), critical: 0, total: 1},
                  dependencies: {total: $total}}}'
}
clean_report() {
    jq -n --argjson total "$1" '{vulnerabilities: {}, metadata: {vulnerabilities: {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0}, dependencies: {total: $total}}}'
}

# write_lock <file> <name@version>...: a lockfileVersion 3 lockfile with exactly those packages
write_lock() {
    local file="$1"; shift
    printf '%s\n' "$@" | jq -Rsc '
      split("\n") | map(select(length > 0)) | map(split("@") | {key: ("node_modules/" + .[0]), value: {version: .[1]}}) | from_entries
      | {name: "fixture", version: "1.0.0", lockfileVersion: 3, requires: true,
         packages: ({"": {name: "fixture", version: "1.0.0"}} + .)}' > "$file"
}

# ─── scenario repos: a base commit, then the change, with every entry point copied in ──
# mk_scenario <name> <base packages|-> <head packages|NOTJSON> [no-origin]
# "-" as base packages means no lockfile at the base. origin/main is the base commit unless no-origin.
# The package lists are plain words (name@version), split on spaces on purpose.
mk_scenario() {
    local name="$1" base_pkgs="$2" head_pkgs="$3" no_origin="${4:-}"
    local repo="$TMP/repos/$name"
    local pkgs=() p
    mkdir -p "$repo/.github/scripts" "$repo/bin/git-hooks" "$repo/scripts/ci" "$repo/scripts/lib" \
             "$repo/tests/security" "$repo/tests/unit" "$repo/tests/agents" "$repo/tests/skills/structure" \
             "$repo/tests/performance"
    cp "$REPO_ROOT/.github/scripts/audit-gate.sh" "$REPO_ROOT/.github/scripts/audit-whole-tree.sh" \
       "$REPO_ROOT/.github/scripts/npm-audit-with-retry.sh" "$repo/.github/scripts/"
    cp "$REPO_ROOT/tests/security/test-npm-audit.sh" "$repo/tests/security/"
    mkdir -p "$repo/tests/fixtures"
    cp "$REPO_ROOT/tests/fixtures/test-helpers.sh" "$repo/tests/fixtures/"
    cp "$REPO_ROOT/bin/git-hooks/pre-push" "$repo/bin/git-hooks/pre-push"
    printf 'VERSION_SKIP_PATTERN=%s\n' "'^release-please'" > "$repo/scripts/ci/version-skip-pattern.sh"
    printf 'touch agents-ran\nexit 0\n' > "$repo/tests/agents/test-agent-frontmatter.sh"
    printf 'touch skills-ran\nexit 0\n' > "$repo/tests/skills/structure/test-skill-md.sh"
    printf 'touch budget-ran\nexit 0\n' > "$repo/tests/performance/test-token-overhead.sh"
    printf 'acquire_test_slot() { :; }\nrelease_test_slot() { :; }\n' > "$repo/scripts/lib/test-slot.sh"
    # The hook's security stage runs this; it runs the REAL test-npm-audit.sh and keeps its output.
    cat > "$repo/tests/security/run-security-tests.sh" <<'RUNNER'
#!/usr/bin/env bash
rc=0
bash tests/security/test-npm-audit.sh > audit-out.txt 2>&1 || rc=$?
cat audit-out.txt
exit "$rc"
RUNNER
    chmod +x "$repo/tests/security/run-security-tests.sh"
    printf '{"name":"fixture","version":"0.0.0","scripts":{"build":"true"}}\n' > "$repo/package.json"
    git -C "$repo" init -q
    git -C "$repo" checkout -q -b release-please--branches--main
    if [[ "$base_pkgs" != "-" ]]; then
        for p in $base_pkgs; do pkgs+=("$p"); done
        write_lock "$repo/package-lock.json" "${pkgs[@]}"
    fi
    git -C "$repo" add -A
    git -C "$repo" commit -qm base
    if [[ -z "$no_origin" ]]; then
        git -C "$repo" update-ref refs/remotes/origin/main HEAD
        git -C "$repo" update-ref refs/heads/main HEAD
    fi
    if [[ "$head_pkgs" == "NOTJSON" ]]; then
        echo 'this is not json' > "$repo/package-lock.json"
    else
        pkgs=()
        for p in $head_pkgs; do pkgs+=("$p"); done
        write_lock "$repo/package-lock.json" "${pkgs[@]}"
    fi
    git -C "$repo" add -A
    # allow-empty: the "identical" scenario changes no lockfile, and the hook still wants a second commit
    git -C "$repo" commit -q --allow-empty -m change
}

# run_in <repo> <out file> <command...>: runs from inside the repo with a clean audit environment
# (the stub on) and prints the exit status. NAME=value words before the command set the event.
run_in() {
    local repo="$1" out="$2" rc=0
    shift 2
    ( cd "$repo" && env -u GITHUB_EVENT_NAME -u GITHUB_BASE_REF -u ORK_AUDIT_MODE -u ORK_AUDIT_BASE \
        -u NPM_AUDIT_LEVEL -u CI -u GITHUB_ACTIONS -u ORK_PRE_PUSH_MODE ORK_AUDIT_WRAPPER="$STUB" \
        "$@" > "$out" 2>&1 ) || rc=$?
    echo "$rc"
}
PR_ENV=(GITHUB_EVENT_NAME=pull_request GITHUB_BASE_REF=main)

UNT="legacy@1.0.0 other@1.0.0"
mk_scenario add       "safe@1.0.0"                  "safe@1.0.0 vuln@1.0.0"
mk_scenario untouched "$UNT"                        "$UNT newok@1.0.0"
mk_scenario identical "$UNT"                        "$UNT"
mk_scenario high      "legacy@1.0.0"                "legacy@1.0.0 newok@1.0.0"
mk_scenario bump      "vuln@1.0.0"                  "vuln@1.0.1"
mk_scenario newlock   "-"                           "vuln@1.0.0"
mk_scenario badlock   "safe@1.0.0"                  "NOTJSON"
mk_scenario neterr    "safe@1.0.0"                  "safe@1.0.0 newok@1.0.0"
mk_scenario zero      "safe@1.0.0"                  "safe@1.0.0 newok@1.0.0"
mk_scenario clean     "safe@1.0.0"                  "safe@1.0.0 newok@1.0.0"
mk_scenario nobase    "safe@1.0.0"                  "safe@1.0.0 vuln@1.0.0" no-origin
# severity scenarios: an advisory whose severity is missing, or a string npm does not use
mk_scenario sevmiss-added     "safe@1.0.0"          "safe@1.0.0 vuln@1.0.0"
mk_scenario sevmiss-untouched "$UNT"                "$UNT newok@1.0.0"
mk_scenario sevodd-added      "safe@1.0.0"          "safe@1.0.0 vuln@1.0.0"
mk_scenario sevodd-untouched  "$UNT"                "$UNT newok@1.0.0"

adv_report 2 moderate 111 vuln     > "$STUB_REPORTS/add.json"
adv_report 3 moderate 222 legacy   > "$STUB_REPORTS/untouched.json"
adv_report 2 moderate 222 legacy   > "$STUB_REPORTS/identical.json"
adv_report 2 high     333 legacy   > "$STUB_REPORTS/high.json"
adv_report 1 moderate 444 vuln     > "$STUB_REPORTS/bump.json"
adv_report 1 moderate 555 vuln     > "$STUB_REPORTS/newlock.json"
clean_report 1                     > "$STUB_REPORTS/badlock.json"
echo '{"error":{"code":"ENOTFOUND","summary":"audit endpoint unreachable"}}' > "$STUB_REPORTS/neterr.raw"
clean_report 0                     > "$STUB_REPORTS/zero.json"
clean_report 2                     > "$STUB_REPORTS/clean.json"
adv_report 2 moderate 111 vuln     > "$STUB_REPORTS/nobase.json"
# adv_report_nosev <packages examined> <advisory id> <package>: an advisory with NO severity field
adv_report_nosev() {
    jq -n --argjson total "$1" --argjson id "$2" --arg pkg "$3" '
      {vulnerabilities: {($pkg): {name: $pkg,
         via: [{source: $id, name: $pkg, title: "Stub advisory \($id) in \($pkg)", range: "<9.9.9"}]}},
       metadata: {vulnerabilities: {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 1},
                  dependencies: {total: $total}}}'
}
adv_report_nosev 2 901 vuln        > "$STUB_REPORTS/sevmiss-added.json"
adv_report_nosev 3 902 legacy      > "$STUB_REPORTS/sevmiss-untouched.json"
adv_report 2 severe 903 vuln       > "$STUB_REPORTS/sevodd-added.json"
adv_report 3 severe 904 legacy     > "$STUB_REPORTS/sevodd-untouched.json"

OUT="$TMP/out.txt"
# gate_rc <scenario> [NAME=value ...]: exit status of audit-gate.sh run in that scenario's repo
gate_rc() { local s="$1"; shift; run_in "$TMP/repos/$s" "$OUT" "$@" bash .github/scripts/audit-gate.sh; }
# audit_rc <scenario> [NAME=value ...]: exit status of tests/security/test-npm-audit.sh there
audit_rc() { local s="$1"; shift; run_in "$TMP/repos/$s" "$OUT" "$@" bash tests/security/test-npm-audit.sh; }

# The real decision under test, first assertion of the file: on a pull_request run, does the gate
# reject a change that ADDS a vulnerable package (exit 1 = yes, exit 0 = no, anything else is ERROR,
# which the helper reports as a failure and never as a pass).
gate_rejects_scenario() {
    local rc=0
    rc="$(gate_rc "$1" "${PR_ENV[@]}")"
    case "$rc" in
        1) return 0 ;;
        0) return 1 ;;
        *) return 2 ;;
    esac
}

echo "Layer A: .github/scripts/audit-gate.sh on a pull_request (the Dependency Audit step)"

expect_classification yes gate_rejects_scenario "row 1: an added vulnerable moderate package fails" add
check "row 1: ...and the output names the advisory and why"   "$(count_lines "$OUT" '111 [moderate] vuln: Stub advisory 111 in vuln (in a package this change adds or changes)')" "1"
check "row 1: ...and the result line is ADVISORIES"            "$(count_lines "$OUT" 'RESULT: ADVISORIES (exit 1)')" "1"

check "row 1: a package whose VERSION changed fails"          "$(gate_rc bump "${PR_ENV[@]}")" "1"
check "row 1: a package in a NEW lockfile fails"              "$(gate_rc newlock "${PR_ENV[@]}")" "1"

check "row 2: an untouched moderate advisory passes"          "$(gate_rc untouched "${PR_ENV[@]}")" "0"
check "row 2: ...and is named"                                "$(count_lines "$OUT" '222 [moderate] legacy')" "1"
check "row 2: ...as deferred to the scheduled whole-tree audit" "$(count_lines "$OUT" 'deferred to the scheduled whole-tree audit')" "3"
check "row 2: ...with a clean-for-this-change result"         "$(count_lines "$OUT" 'RESULT: clean for this change (exit 0); 1 advisory(ies) in untouched packages deferred')" "1"
check "row 2: an unchanged lockfile passes the same way"      "$(gate_rc identical "${PR_ENV[@]}")" "0"
check "row 2: ...and names the deferred advisory"             "$(count_lines "$OUT" '222 [moderate] legacy')" "1"
check "a clean change passes"                                 "$(gate_rc clean "${PR_ENV[@]}")" "0"
check "...with no deferred advisory line"                     "$(count_lines "$OUT" "⚠ ")" "0"

check "row 3: an untouched HIGH advisory fails"               "$(gate_rc high "${PR_ENV[@]}")" "1"
check "row 3: ...for being high, not for being changed"       "$(count_lines "$OUT" 'high or critical, which fails anywhere in the tree')" "1"

check "row 4: no base ref fails closed"                       "$(gate_rc nobase GITHUB_EVENT_NAME=pull_request)" "2"
check "row 4: ...with the diff message"                       "$(count_lines "$OUT" 'RESULT: CANNOT COMPUTE THE LOCKFILE DIFF (exit 2)')" "1"
check "row 4: ...saying there is no base ref"                 "$(count_lines "$OUT" 'no base ref')" "1"
check "row 4: ...and it is not an advisory hit or a pass"     "$(count_lines "$OUT" 'RESULT: ADVISORIES')$(count_lines "$OUT" 'RESULT: clean')" "00"
check "row 4: a base ref git cannot resolve fails closed"     "$(gate_rc add GITHUB_EVENT_NAME=pull_request GITHUB_BASE_REF=no-such-branch)" "2"
check "row 4: ...with the diff message"                       "$(count_lines "$OUT" 'RESULT: CANNOT COMPUTE THE LOCKFILE DIFF (exit 2)')" "1"
check "row 4: an unreadable lockfile fails closed"            "$(gate_rc badlock "${PR_ENV[@]}")" "2"
check "row 4: ...with the diff message"                       "$(count_lines "$OUT" 'RESULT: CANNOT COMPUTE THE LOCKFILE DIFF (exit 2)')" "1"
check "row 4: an unreachable advisory source fails closed"    "$(gate_rc neterr "${PR_ENV[@]}")" "2"
check "row 4: ...with the audit message, not the diff one"    "$(count_lines "$OUT" 'RESULT: CANNOT AUDIT (exit 2)')$(count_lines "$OUT" 'CANNOT COMPUTE')" "10"
check "row 4: ...naming the unreachable source"               "$(count_lines "$OUT" 'ENOTFOUND')" "1"
check "row 4: zero packages examined fails closed"            "$(gate_rc zero "${PR_ENV[@]}")" "2"
check "row 4: ...saying zero packages"                        "$(count_lines "$OUT" 'zero packages')" "1"
check "row 4: ...and it is the audit message"                 "$(count_lines "$OUT" 'RESULT: CANNOT AUDIT (exit 2)')" "1"

echo "Row 5, layer A: push, schedule and a plain local run stay whole-tree"
check "row 5: on push an untouched moderate advisory FAILS"   "$(gate_rc untouched GITHUB_EVENT_NAME=push)" "1"
check "row 5: ...in whole mode"                               "$(count_lines "$OUT" 'mode=whole (event push)')" "1"
check "row 5: on schedule an untouched moderate advisory FAILS" "$(gate_rc untouched GITHUB_EVENT_NAME=schedule)" "1"
check "row 5: on workflow_dispatch it FAILS too"              "$(gate_rc untouched GITHUB_EVENT_NAME=workflow_dispatch)" "1"
check "row 5: an env var cannot narrow a push"                "$(gate_rc untouched GITHUB_EVENT_NAME=push ORK_AUDIT_MODE=change ORK_AUDIT_BASE=origin/main)" "1"
check "row 5: ...nor can the flag"                            "$(run_in "$TMP/repos/untouched" "$OUT" GITHUB_EVENT_NAME=push bash .github/scripts/audit-gate.sh --mode change --base origin/main)" "1"
check "row 5: a local run that asks for nothing is whole-tree" "$(gate_rc untouched)" "1"
check "row 5: a local run that asks for change narrows"       "$(gate_rc untouched ORK_AUDIT_MODE=change ORK_AUDIT_BASE=origin/main)" "0"
check "the mode rule: pull_request is change"                 "$(run_in "$TMP/repos/add" "$OUT" GITHUB_EVENT_NAME=pull_request bash .github/scripts/audit-gate.sh --print-mode)$(cat "$OUT")" "0change"
check "the mode rule: push is whole"                          "$(run_in "$TMP/repos/add" "$OUT" GITHUB_EVENT_NAME=push bash .github/scripts/audit-gate.sh --print-mode)$(cat "$OUT")" "0whole"

echo "Layer B: tests/security/test-npm-audit.sh (the Security Tests row)"
check "row 1: pull_request, an added vulnerable package fails" "$(audit_rc add "${PR_ENV[@]}")" "1"
check "row 1: ...through the one gate script"                 "$(count_lines "$OUT" 'audit-gate: mode=change (event pull_request)')" "1"
check "row 1: ...and names why"                               "$(count_lines "$OUT" '(in a package this change adds or changes)')" "1"
check "row 2: pull_request, an untouched moderate advisory passes" "$(audit_rc untouched "${PR_ENV[@]}")" "0"
check "row 2: ...named as deferred"                           "$(count_lines "$OUT" 'deferred to the scheduled whole-tree audit')" "3"
check "row 3: pull_request, an untouched high fails"          "$(audit_rc high "${PR_ENV[@]}")" "1"
check "row 4: pull_request with no base ref fails closed"     "$(audit_rc nobase GITHUB_EVENT_NAME=pull_request)" "2"
check "row 4: ...with the diff message"                       "$(count_lines "$OUT" 'RESULT: CANNOT COMPUTE THE LOCKFILE DIFF (exit 2)')" "1"
check "row 4: pull_request, an unreachable advisory source fails closed" "$(audit_rc neterr "${PR_ENV[@]}")" "2"
check "row 4: ...with the audit message"                      "$(count_lines "$OUT" 'RESULT: CANNOT AUDIT (exit 2)')" "1"
check "row 4: pull_request, zero packages fails closed"       "$(audit_rc zero "${PR_ENV[@]}")" "2"
check "row 5: push, an untouched moderate advisory FAILS (whole tree)" "$(audit_rc untouched GITHUB_EVENT_NAME=push GITHUB_BASE_REF=main)" "1"
check "row 5: ...by the whole-tree walk, not the change gate" "$(count_lines "$OUT" 'audit-gate')" "0"
check "row 5: ...naming the advisory"                         "$(count_lines "$OUT" '222 [moderate] Stub advisory 222 in legacy')" "1"
check "row 5: push cannot be narrowed by the hook's variables" "$(audit_rc untouched GITHUB_EVENT_NAME=push ORK_AUDIT_MODE=change ORK_AUDIT_BASE=origin/main)" "1"
check "row 5: a local run with no event is the whole tree"    "$(audit_rc untouched)" "1"
check "row 5: ...and the clean whole tree passes"             "$(audit_rc clean GITHUB_EVENT_NAME=push)" "0"

echo "Layer C: bin/git-hooks/pre-push, security stage (the hook)"
# hook_rc <scenario>: the hook with the unit tier skipped (HQ_CI_ONLY=1), the security stage real
hook_rc() {
    local s="$1" repo rc=0
    repo="$TMP/repos/$s"
    rm -f "$repo/audit-out.txt"
    ( cd "$repo" && env -u GITHUB_EVENT_NAME -u GITHUB_BASE_REF -u ORK_AUDIT_MODE -u ORK_AUDIT_BASE \
        -u CI -u GITHUB_ACTIONS -u ORK_PRE_PUSH_MODE HQ_CI_ONLY=1 ORK_AUDIT_WRAPPER="$STUB" \
        bash bin/git-hooks/pre-push origin https://example.invalid/x.git < /dev/null > "$TMP/hook-out.txt" 2>&1 ) || rc=$?
    echo "$rc"
}
audit_out_count() {
    local s="$1" text="$2"
    if [[ -f "$TMP/repos/$s/audit-out.txt" ]]; then count_lines "$TMP/repos/$s/audit-out.txt" "$text"; else echo "no-audit-output"; fi
}

check "row 1: the hook refuses a push that adds a vulnerable package" "$(state "$(hook_rc add)")" "refused"
check "row 1: ...at the security stage"                        "$(count_lines "$TMP/hook-out.txt" 'Security tests failed!')" "1"
check "row 1: ...by the change gate, with the reason"          "$(audit_out_count add '(in a package this change adds or changes)')" "1"
check "row 1: ...against the merge base with origin/main"      "$(audit_out_count add 'audit-gate: mode=change (no event, asked for change), base=')" "1"
check "row 2: the hook lets an untouched moderate advisory through" "$(hook_rc untouched)" "0"
check "row 2: ...reaching the success line"                    "$(count_lines "$TMP/hook-out.txt" 'Pre-push validation passed')" "1"
check "row 2: ...and names it as deferred"                     "$(audit_out_count untouched 'deferred to the scheduled whole-tree audit')" "3"
check "row 3: the hook refuses an untouched high advisory"     "$(state "$(hook_rc high)")" "refused"
check "row 3: ...as high or critical"                          "$(audit_out_count high 'high or critical, which fails anywhere in the tree')" "1"
check "row 4: the hook refuses when the merge base cannot be computed" "$(state "$(hook_rc nobase)")" "refused"
check "row 4: ...with the diff message, not an advisory"       "$(audit_out_count nobase 'RESULT: CANNOT COMPUTE THE LOCKFILE DIFF (exit 2)')" "1"
check "row 4: the hook refuses on an unreachable advisory source" "$(state "$(hook_rc neterr)")" "refused"
check "row 4: ...with the audit message"                       "$(audit_out_count neterr 'RESULT: CANNOT AUDIT (exit 2)')" "1"

echo "Layer E: an advisory with a missing or unknown severity is never dropped and never deferred"
# A severity that is absent, or a word npm does not use, cannot be ranked. It must FAIL (exit 1) in
# every mode and at every entry point, named with its id and "[unknown severity]". Dropping it (as
# severity "low") passes a gate on an advisory nobody could rank: a fail-open (verifier H1).
for scen in sevmiss-added sevmiss-untouched sevodd-added sevodd-untouched; do
    case "$scen" in
        sevmiss-added) want_id=901 ;;
        sevmiss-untouched) want_id=902 ;;
        sevodd-added) want_id=903 ;;
        *) want_id=904 ;;
    esac
    check "$scen: the gate on a pull_request fails"              "$(gate_rc "$scen" "${PR_ENV[@]}")" "1"
    check "$scen: ...naming the id and the unknown severity"      "$(count_lines "$OUT" "$want_id [unknown severity]")" "1"
    check "$scen: ...as a failure, not a deferral"                "$(count_lines "$OUT" "⚠ ")" "0"
    check "$scen: ...with the result ADVISORIES"                  "$(count_lines "$OUT" 'RESULT: ADVISORIES (exit 1)')" "1"
    check "$scen: test-npm-audit.sh on a pull_request fails"      "$(audit_rc "$scen" "${PR_ENV[@]}")" "1"
    check "$scen: ...naming the unknown severity"                 "$(count_lines "$OUT" "$want_id [unknown severity]")" "1"
    check "$scen: the hook refuses the push"                      "$(state "$(hook_rc "$scen")")" "refused"
    check "$scen: ...naming the unknown severity"                 "$(audit_out_count "$scen" "$want_id [unknown severity]")" "1"
    check "$scen: whole-tree (push) fails too"                    "$(gate_rc "$scen" GITHUB_EVENT_NAME=push)" "1"
done

echo "Layer F: the whole-tree walk of test-npm-audit.sh never drops a missing or unknown severity"
# On every event except pull_request, test-npm-audit.sh walks the tree itself (it does not call the
# change gate). That walk used to decide from npm's moderate, high and critical COUNTS, so an advisory
# with no severity or an unknown word counted 0 and the lockfile passed (verifier H1 of the second
# round). These rows drive the script itself, not the gate, on each whole-tree event.
for evt in push schedule workflow_dispatch merge_group; do
    for scen in sevmiss-untouched sevodd-untouched sevmiss-added sevodd-added; do
        case "$scen" in
            sevmiss-untouched) want_id=902 ;;
            sevodd-untouched) want_id=904 ;;
            sevmiss-added) want_id=901 ;;
            *) want_id=903 ;;
        esac
        check "$evt: test-npm-audit.sh fails on $scen"           "$(audit_rc "$scen" "GITHUB_EVENT_NAME=$evt")" "1"
        check "$evt: ...naming $want_id and the unknown severity" "$(count_lines "$OUT" "$want_id [unknown severity]")" "1"
    done
done
check "a local run with no event fails on a missing severity"     "$(audit_rc sevmiss-untouched)" "1"
check "...and on an unknown severity word"                        "$(audit_rc sevodd-untouched)" "1"
check "control: push still fails a moderate advisory"             "$(audit_rc untouched GITHUB_EVENT_NAME=push)" "1"
check "control: push still passes a clean tree"                   "$(audit_rc clean GITHUB_EVENT_NAME=push)" "0"

echo "Layer D: the wiring names the one gate and the base fetch"
CI_YML="$REPO_ROOT/.github/workflows/ci.yml"
SCHEDULED_YML="$REPO_ROOT/.github/workflows/npm-audit-scheduled.yml"
HOOK="$REPO_ROOT/bin/git-hooks/pre-push"
check "ci.yml: the Dependency Audit pull_request step runs the gate" "$(count_lines "$CI_YML" 'run: bash .github/scripts/audit-gate.sh')" "1"
check "ci.yml: both audit jobs fetch the base branch"          "$(count_lines "$CI_YML" 'name: Fetch the base branch for the change audit')$(count_lines "$CI_YML" 'name: Fetch the base branch for the npm audit gate')" "11"
check "ci.yml: the whole-tree Dependency Audit steps run off pull_request only" "$(count_lines "$CI_YML" "if: github.event_name != 'pull_request'")" "2"
check "the scheduled workflow runs the whole-tree script"      "$(present "$(count_lines "$SCHEDULED_YML" 'audit-whole-tree.sh')")" "yes"
check "the scheduled workflow does not call the change gate"   "$(count_lines "$SCHEDULED_YML" 'audit-gate.sh')" "0"
check "the hook asks for the change gate"                      "$(count_lines "$HOOK" 'ORK_AUDIT_MODE=change ORK_AUDIT_BASE="$audit_base"')" "1"
check "the hook takes the merge base with origin/main"         "$(count_lines "$HOOK" 'audit_base="$(git merge-base origin/main HEAD')" "1"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
