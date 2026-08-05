#!/bin/bash
# Security Tests: dangerous-command-blocker
#
# Priority: CRITICAL
# Reference: OWASP Command Injection, CWE-77/78
#
# =============================================================================
# WHAT THIS FILE USED TO BE
# =============================================================================
# 9 of 10 functions could not fail. Every one called
# `pretool/input-mod/bash-defaults.sh` or `pretool/bash/git-branch-protection.sh`
# through run_hook_capture. Neither has existed since the TypeScript migration,
# so run_hook returned 127, the `if [[ $HOOK_EXIT_CODE -eq 0 ]]` branch was
# skipped, and each function ended in an unconditional `return 0`.
#
# =============================================================================
# WHY THE OLD FIXTURES ARE NOT SIMPLY RETARGETED
# =============================================================================
# The old tests asserted that subshells, backticks and ${IFS} expansion get
# blocked. That was bash-defaults' threat model, and bash-defaults was deleted
# on purpose (e844b4b25, "consolidate to 24 hooks").
#
# Measured against every current candidate before rewriting:
#
#   19 command_injection fixtures -> dangerous-command-blocker      2 deny
#                                 -> compound-command-validator     1 deny
#                                 -> network-egress-guard           0 deny
#
# That is not a hole. dangerous-command-blocker.ts:34 states its own scope:
# "DENY tier — catastrophic system damage, NEVER legitimate". Blocking every
# `$(whoami)` would break ordinary work, and it does not claim to. Pointing the
# old fixtures at it would manufacture ~17 failures and create pressure to make
# the hook over-block, which is worse than the theatre it replaced.
#
# So this file asserts what the hook DOES promise: the catastrophic set, matched
# after compound-splitting, with no false positives on normal commands.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

BLOCKER="pretool/bash/dangerous-command-blocker"
PASS=0
FAIL=0

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
log_pass() { echo "  ${GREEN}✓${NC} $1"; }
log_fail() { echo "  ${RED}✗${NC} $1"; }
section()  { echo; echo "${YELLOW}$1${NC}"; }

bash_input() { jq -n --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
expect_cmd() { expect_decision "$1" "$BLOCKER" "$(bash_input "$2")" "$3"; }

echo "=========================================="
echo "  dangerous-command-blocker: DENY tier"
echo "=========================================="

if ! assert_hook_registered "$BLOCKER"; then
  echo "${RED}✗ $BLOCKER is not registered — aborting rather than reporting green${NC}"
  exit 1
fi

section "1. Filesystem destruction (DENY_PATTERNS + DENY_REGEX at :38-70)"
expect_cmd deny 'rm -rf /'                            "rm -rf / (anchored regex)"
expect_cmd deny 'rm -rf ~'                            "rm -rf ~ (home wipe)"
expect_cmd deny 'rm -fr ~'                            "rm -fr ~ (flag order swapped)"

section "2. Device wiping"
expect_cmd deny 'dd if=/dev/zero of=/dev/sda'         "dd zero over a block device"
expect_cmd deny 'mkfs.ext4 /dev/sda1'                 "mkfs on a device"

section "3. Permission abuse and database destruction"
expect_cmd deny 'chmod -R 777 /'                      "recursive 777 on root"
expect_cmd deny 'psql -c "drop database prod"'        "drop database"

section "4. Compound splitting — a dangerous segment anywhere is caught"
# containsDangerousCommand() splits on && || | ; and newlines before matching,
# so hiding the payload behind a benign first segment must not help.
expect_cmd deny 'git status; rm -rf /'                "dangerous segment after ;"
expect_cmd deny 'echo ok && rm -rf ~'                 "dangerous segment after &&"
printf -v NEWLINE_CMD 'git status\nrm -rf /'
expect_cmd deny "$NEWLINE_CMD"                        "dangerous segment on a new line"

section "5. ASK tier — dangerous but sometimes legitimate (:73)"
# Three tiers, not two: deny > ask > allow. ASK escalates to the user rather
# than refusing, which is the right answer for a recursive delete of a path that
# might be junk or might be someone's work.
#
# Found by this rewrite: `rm -rf ./node_modules` returns ask, and the first
# draft of this file asserted allow. The hook was right and the assertion was
# wrong, so the assertion changed. Tuning it the other way would have quietly
# documented a weaker contract than the code actually provides.
expect_cmd ask   'rm -rf ./node_modules'              "recursive delete of a relative path escalates"

section "6. No false positives on ordinary work"
# The hook is only useful if it stays out of the way. These are the commands the
# old fixtures wrongly expected to be blocked.
# Verdict is `abstain`, not `allow`: the blocker emits no permissionDecision here,
# so the request falls through to the normal permission flow. It does not
# auto-approve and skip the prompt, which is what `allow` would claim.
expect_cmd abstain 'ls -la'                           "plain ls"
expect_cmd abstain 'git status && whoami'             "benign compound"
expect_cmd abstain 'echo "$(date)"'                   "subshell in normal use"
expect_cmd abstain 'npm install'                      "package install"
expect_cmd abstain 'git commit -m "wip"'              "ordinary git"

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ $FAIL -eq 0 ]]
