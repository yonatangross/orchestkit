#!/bin/bash
# Main Test Runner — orchestrator over the CI glob engine (#3235)
#
# Usage: ./run-all-tests.sh [OPTIONS]
#
# Options:
#   --verbose       (kept for compatibility; discovery output is always shown)
#   --quick         Skip integration, E2E, and performance tests
#   --lint          Run only lint/static analysis
#   --unit          Run only unit tests
#   --security      Run only security tests
#   --integration   Run only integration tests
#   --e2e           Run only E2E tests
#   --performance   Run only performance tests
#   --skills        Run only skill/subagent tests
#   --all           Run all tests (default)
#
# Exit codes: 0 = all pass, 1 = failures found
#
# Version: 4.0.0 — ONE DISPATCH MODEL (#3235)
#
# v3 was a hand-curated roster: 133 explicit run_test lines against 231 test
# files on disk. Coverage depended on remembering to wire each new file, and
# the wiring itself was a bug class — "bash <path>"/"node <path>" prefixes
# tripped run_test's [[ -f ]] guard into silent SKIPs three separate times
# (#3231 docs-drift, #3236 hook-execution, and #3220 reclaimed 17 more files
# that were never wired at all). CI never had this problem because
# scripts/ci/run-tests.sh GLOBS each directory. v4 makes that glob the only
# execution engine: this script sequences directories, applies category
# gating, counts the advisory-warning ratchet, and prints the summary.
# A new test file runs everywhere the moment it exists.
#
# Deliberate differences from a bare glob, each with a reason:
#   - tests/fixtures is never globbed: test-helpers.sh is a sourced library
#     whose standalone exit 0 would read as fake coverage.
#   - tests/orphans runs with ORK_UNREACHABLE_SKILLS_ADVISORY=1: the ratchet
#     (test-skill-reachability.mjs, baseline 21 since the gates learned the
#     agent-body Read() path, #3313) is the enforcement gate; the detector
#     exits 1 on ANY unreachable skill and would report a regression that did
#     not happen. Same env CI uses (#3245).
#   - skill-efficiency-scorecard.sh is not test-*.sh, so the glob never sees
#     it; it stays an explicit advisory extra (WARN, never fails the run).
#   - ci/lint.sh is not test-*.sh either; explicit blocking call under --lint.
#   - vitest runs locally only (CI has dedicated sharded jobs for it).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER="$PROJECT_ROOT/scripts/ci/run-tests.sh"

# Parse arguments
RUN_LINT="true"
RUN_UNIT="true"
RUN_SECURITY="true"
RUN_INTEGRATION="true"
RUN_E2E="true"
RUN_PERFORMANCE="true"
RUN_SKILLS="true"

for arg in "$@"; do
    case $arg in
        --verbose) ;; # discovery output is always shown; flag kept for compatibility
        --quick) RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --lint) RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --unit) RUN_LINT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --security) RUN_LINT="false"; RUN_UNIT="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --integration) RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --e2e) RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --performance) RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_SKILLS="false" ;;
        --skills) RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --all) RUN_LINT="true"; RUN_UNIT="true"; RUN_SECURITY="true"; RUN_INTEGRATION="true"; RUN_E2E="true"; RUN_PERFORMANCE="true"; RUN_SKILLS="true" ;;
        --coverage) ;; # accepted for compatibility; no-op
        --help|-h)
            sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Scratch files, without depending on a writable system temp dir.
#
# A bare `mktemp` writes to the system temp dir and dies when that write is
# denied. Under `set -e` that killed this runner on its first scratch file, so
# nothing ran and the pre-commit hook reported "quick lint tests FAILED" with no
# test having executed. Same class as #3564 (a denied mktemp silently zeroed a
# subcount in count-hooks.sh); the blast radius here is larger, because this
# script sits on the commit path and its failure blocks every commit.
#
# An explicit TEMPLATE is what makes TMPDIR effective: macOS `mktemp` called
# with no template ignores TMPDIR entirely and goes to /var/folders regardless,
# which is also why `TMPDIR=/somewhere bash run-all-tests.sh` looks like it
# works and proves nothing.
# ---------------------------------------------------------------------------
scratch_file() {
    local f
    for dir in "${TMPDIR:-/tmp}" /tmp "$SCRIPT_DIR/.tmp"; do
        [ -n "$dir" ] || continue
        mkdir -p "$dir" 2>/dev/null || continue
        if f=$(mktemp "${dir%/}/ork-tests.XXXXXX" 2>/dev/null) && [ -w "$f" ]; then
            printf '%s' "$f"
            return 0
        fi
    done
    echo "run-all-tests: FAILED to create a scratch file in TMPDIR, /tmp or $SCRIPT_DIR/.tmp" >&2
    return 1
}

RESULTS_FILE=$(scratch_file)
TOTAL_PASSED=0
TOTAL_FAILED=0
# Advisory-warning ratchet (2026-08-01): sections print "Warnings: N" lines.
# Summed here and compared against baselines. Since row 12 (2026-11-13) a run FAILS when a
# category's count is above its line in tests/warnings-baselines.txt, BELOW it (a line with
# slack under it lets warnings grow back unseen, so the same change must lower the line),
# has no line, or cannot be read (ratchet_check below). The skills block also keeps the
# aggregate WARNINGS_BASELINE, held to the same rule. The required "Agents & Skills" CI row
# runs the FULL `bash tests/run-all-tests.sh` (all 25 categories, not --skills), so a failing
# test in any category or a count off its line blocks the merge.
# Ratchet DOWN as sections get cleaned; never raise a line to quiet the run.
RATCHET_RAN="false"
RATCHET_FAILED="false"
RATCHET_MSG=""
TOTAL_WARNINGS=0
TOTAL_UNREADABLE=0
TOTAL_TESTS_RUN=0
WARNINGS_BASELINE="${ORK_WARNINGS_BASELINE:-265}"  # ratcheted 348->267 (#3235): two consecutive full v4 runs measured exactly 267. 2026-11-13 row 11: old 267 (the true count then was 271, two colour-coded counts were invisible), measured 267 (colour codes now counted) after the description checks follow the #5043 standard and 8 skills got a Related Skills section. Down only. 2026-11-17 catalog trim stage 1a: 267 -> 265, the memory and ci-debug merges removed two skill warnings (the full run printed 265).

# One "<category>|<warnings>|<unreadable lines>" row per category that ran (row 12). The
# baselines file holds one "<category>=<number>" line per category; the gate before the
# summary compares each row with its line.
CATEGORY_FILE=$(scratch_file)
BASELINES_FILE="${ORK_WARNINGS_BASELINES_FILE:-$SCRIPT_DIR/warnings-baselines.txt}"

trap "rm -f $RESULTS_FILE $CATEGORY_FILE" EXIT

# ---------------------------------------------------------------------------
# Executable-bit preflight (#4084): verify, never mutate.
#
# This used to be two `find ... -exec chmod +x {} \;` passes (over tests/, then
# src/hooks). chmod +x on a tracked .sh whose git mode is 100644 flips the
# on-disk mode and leaves the tree DIRTY: the validator itself mutated the
# worktree it was validating, on the commit path. It dirtied
# tests/test-ascii-density-ratchet.sh for lane fix-4070, whose commit then
# carried a mode change it never asked for.
#
# The replacement is read-only and git-scoped: `git ls-files` names exactly the
# tracked .sh files (no node_modules, no scratch dirs, no sibling worktrees),
# and a file is compliant when git records mode 100755 AND the exec bit is set
# on disk. Anything else fails the run and names the fix command. Outside a
# git work tree (tarball checkout) the check degrades to a skip, like the old
# courtesy chmod's 2>/dev/null. The 100755 rule is deliberately uniform across
# every tracked .sh rather than semantic: it also marks sourced libraries
# executable (.claude/coordination/lib/coordination.sh is sourced from six
# call sites and never invoked directly, same for feedback-lib.sh and
# memory-lib.sh). Regression test:
# tests/ci/test-run-all-tests-no-mutation.sh
#
# The enumeration is NUL-delimited with quoting off (#4180). With
# core.quotePath at its default, `git ls-files -s` printed a non-ASCII path
# C-quoted and octal-escaped, the [ -f ] guard failed on the quoted spelling
# (no file exists under that name), and the file was skipped silently on the
# line whose comment read "staged deletion", fail open on exactly the input
# the gate exists to catch. -z emits raw bytes and never quotes; the explicit
# core.quotePath=false documents that intent and guards the non-z fallback in
# future edits.
# ---------------------------------------------------------------------------
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    non_exec_sh=()
    while IFS= read -r -d '' entry; do
        meta="${entry%%$'\t'*}"                 # "<mode> <sha> <stage>"
        path="${entry#*$'\t'}"                  # raw path bytes, never C-quoted
        [ -n "$path" ] || continue
        # absent from the worktree (deleted, deletion not yet committed, or a
        # submodule gitlink): a real absence, nothing on disk to mode-check
        [ -f "$path" ] || continue
        [[ "${meta##* }" == "0" ]] || continue  # a merge lists 3 stages per path
        if [[ "${meta%% *}" != "100755" || ! -x "$path" ]]; then
            non_exec_sh+=("$path")
        fi
    # silent: best-effort (a git failure here yields an empty list and the run proceeds unguarded, matching the old courtesy chmod's degradation)
    done < <(git -c core.quotePath=false ls-files -s -z -- '*.sh' 2>/dev/null || true)
    if [[ ${#non_exec_sh[@]} -gt 0 ]]; then
        echo -e "${RED}${BOLD}Non-executable tracked .sh files: ${#non_exec_sh[@]}${NC}" >&2
        for f in "${non_exec_sh[@]}"; do
            echo -e "  ${YELLOW}$f${NC}" >&2
            echo "    fix: chmod +x $f && git add $f" >&2
        done
        echo "Run aborted by the exec-bit preflight. This runner modified nothing." >&2
        exit 1
    fi
fi

export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     OrchestKit Test Suite v4.0 — one dispatch engine (#3235)     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# count_warnings and count_tests_run read a section transcript. They stay inline because
# tests/ci/test-run-all-tests-no-mutation.sh runs a lone copy of this file; the markers
# let tests/unit/test-count-warnings.sh extract and exercise exactly this code.
#
# Row 11 (2026-11-13): count_warnings used to match "Warnings: <digits>" on the raw
# transcript. Two tests print the number inside colour codes, either
# "Warnings: <ESC>[1;33m8<ESC>[0m" (test-frontend-skills) or
# "<ESC>[1;33mWarnings:<ESC>[0m 1" (test-plugin-structure-compliance), which that
# regex never matched. The baseline (267) was measured through the same blind spot,
# so the true count then was 271. Colour codes are stripped first now.
# BEGIN warnings-count
# count_warnings <transcript>: sum of every "Warnings: N". awk both matches and sums,
# so an absent match is a clean 0 rather than a grep exit-1 under -e.
count_warnings() {
    awk '{ gsub(/\033\[[0-9;]*m/, "") }
         match($0, /Warnings:[[:space:]]+[0-9]+/) {
           n = substr($0, RSTART, RLENGTH); sub(/^Warnings:[[:space:]]+/, "", n); s += n
         } END {print s + 0}' "$1"
}

# count_tests_run <transcript>: tests the CI engine started (one "[RUN] <path>" line each),
# so a run that executed nothing is visible to the floor in the skills block below.
count_tests_run() {
    awk '{ gsub(/\033\[[0-9;]*m/, "") }
         /^\[RUN\] / { n++ } END {print n + 0}' "$1"
}

# count_unreadable_warnings <transcript>: lines that name "Warnings:" without a number after
# it. count_warnings skips them silently, so a test that starts printing "Warnings: many"
# would lower the count without anyone noticing. Row 12 turns those lines into a failure.
count_unreadable_warnings() {
    awk '{ gsub(/\033\[[0-9;]*m/, "") }
         /Warnings:/ && !match($0, /Warnings:[[:space:]]+[0-9]+/) { n++ } END {print n + 0}' "$1"
}
# END warnings-count

# BEGIN warnings-ratchet
# ratchet_check <count> <baseline> [category]: prints one line and returns 0 only AT the
# baseline, 1 above it (growth), 3 below it (slack), 2 when either number is not a number
# (unknown, never a pass). Four outcomes, four different messages. Strict on purpose (row 12
# ruling): a count below its line fails too, because slack under a line lets warnings grow
# back unseen; the message names the measured count and the exact line to write, and the
# same change that removes warnings lowers the line. With a category name (every category
# has its own baseline) the messages name it.
ratchet_check() {
    local count="$1" baseline="$2" category="${3:-}" where="" fix
    fix="set WARNINGS_BASELINE to $count in tests/run-all-tests.sh"
    if [[ -n "$category" ]]; then
        where=" in category $category"
        fix="write the line '$category=$count' in tests/warnings-baselines.txt"
    fi
    if [[ ! "$count" =~ ^[0-9]+$ || ! "$baseline" =~ ^[0-9]+$ ]]; then
        echo "Warnings ratchet UNREADABLE$where: count '$count', baseline '$baseline'. A count that cannot be read is not a pass."
        return 2
    fi
    if (( 10#$count > 10#$baseline )); then
        echo "Advisory warnings: $count (baseline $baseline) GREW$where. New warnings were added: fix them. Do not raise the baseline."
        return 1
    fi
    if (( 10#$count < 10#$baseline )); then
        echo "Advisory warnings: $count (baseline $baseline) BELOW the baseline$where: $fix, in this change. A line with slack under it lets warnings grow back unseen."
        return 3
    fi
    echo "Advisory warnings: $count (baseline $baseline)"
    return 0
}

# category_baseline <file> <category>: prints the baseline of one category and returns 0, or
# returns 1 when the file has no line "<category>=<number>". Lines starting with # and blank
# lines are ignored. awk, not an associative array: macOS ships bash 3.2.
category_baseline() {
    awk -v key="$2" '
        { line = $0; sub(/[[:space:]]+$/, "", line) }
        line == "" || line ~ /^#/ { next }
        { i = match(line, /=[^=]*$/) }
        i && substr(line, 1, i - 1) == key { print substr(line, i + 1); found = 1; exit }
        END { exit found ? 0 : 1 }' "$1"
}
# END warnings-ratchet

# run_dir <label> <dir> — glob-execute one tests/ subdirectory through the CI
# engine. Failures tally into TOTAL_FAILED and fail the run at the summary.
# Always --verbose: the engine's non-verbose mode hides per-test output
# entirely, which would blind both the operator and the warning ratchet.
run_dir() {
    local label="$1"
    local dir="$2"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Category: $label${NC}  ${CYAN}(tests/$dir)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [[ ! -d "$SCRIPT_DIR/$dir" ]]; then
        echo -e "${YELLOW}SKIP: tests/$dir not found${NC}"
        echo "$label:SKIP" >> "$RESULTS_FILE"
        return 0
    fi

    local exit_code=0
    local section_out
    section_out=$(scratch_file)
    # tee so the operator sees everything AND the ratchet can count warnings.
    # `|| exit_code=$?` captures the engine's real exit (pipefail) without
    # tripping set -e; the code is recorded below, never swallowed.
    bash "$RUNNER" "$SCRIPT_DIR/$dir" --verbose 2>&1 | tee "$section_out" || exit_code=$?

    local section_warnings section_tests section_unreadable
    section_warnings=$(count_warnings "$section_out")
    section_tests=$(count_tests_run "$section_out")
    section_unreadable=$(count_unreadable_warnings "$section_out")
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + section_warnings))
    TOTAL_TESTS_RUN=$((TOTAL_TESTS_RUN + section_tests))
    TOTAL_UNREADABLE=$((TOTAL_UNREADABLE + section_unreadable))
    printf '%s|%s|%s\n' "$label" "$section_warnings" "$section_unreadable" >> "$CATEGORY_FILE"
    rm -f "$section_out"
    echo ""

    if [[ $exit_code -eq 0 ]]; then
        echo "$label:PASS" >> "$RESULTS_FILE"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
    else
        echo "$label:FAIL" >> "$RESULTS_FILE"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
    fi
    return 0
}

# run_script <label> <path> [advisory] — explicit non-glob entries: scripts
# that are not test-*.sh (lint.sh, the scorecard). advisory=true records WARN
# on failure instead of failing the run.
run_script() {
    local label="$1"
    local script="$2"
    local advisory="${3:-false}"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Running: $label${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [[ ! -f "$script" ]]; then
        echo -e "${YELLOW}SKIP: not found${NC}"
        echo "$label:SKIP" >> "$RESULTS_FILE"
        return 0
    fi

    local exit_code=0
    local section_out
    section_out=$(scratch_file)
    # Same capture contract as run_dir: recorded, never swallowed.
    bash "$script" 2>&1 | tee "$section_out" || exit_code=$?
    local section_warnings section_unreadable
    section_warnings=$(count_warnings "$section_out")
    section_unreadable=$(count_unreadable_warnings "$section_out")
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + section_warnings))
    TOTAL_UNREADABLE=$((TOTAL_UNREADABLE + section_unreadable))
    printf '%s|%s|%s\n' "$label" "$section_warnings" "$section_unreadable" >> "$CATEGORY_FILE"
    rm -f "$section_out"
    echo ""

    if [[ $exit_code -eq 0 ]]; then
        echo "$label:PASS" >> "$RESULTS_FILE"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
    elif [[ "$advisory" == "true" ]]; then
        echo "$label:WARN" >> "$RESULTS_FILE"
        echo -e "${YELLOW}Advisory script failed (non-blocking)${NC}"
    else
        echo "$label:FAIL" >> "$RESULTS_FILE"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
    fi
    return 0
}

# ============================================================
# LINT / STATIC ANALYSIS
# ============================================================
if [[ "$RUN_LINT" == "true" ]]; then
    echo -e "${BOLD}${CYAN}LINT / STATIC ANALYSIS${NC}"
    run_script "Static Analysis Suite" "$SCRIPT_DIR/ci/lint.sh"
    run_dir "CI Meta" "ci"
    run_dir "Indexes" "indexes"
fi

# ============================================================
# UNIT TESTS
# ============================================================
if [[ "$RUN_UNIT" == "true" ]]; then
    echo -e "${BOLD}${CYAN}UNIT TESTS${NC}"
    run_dir "Unit" "unit"
    run_dir "Build" "build"
    run_dir "Config" "config"
    run_dir "Compliance" "compliance"
    run_dir "Hook Structure" "hooks"
    run_dir "Worktree" "worktree"
    run_dir "Evals (deterministic)" "evals"

    # TypeScript hook tests (vitest). CI runs these in dedicated sharded jobs.
    if [[ -n "${CI:-}" ]]; then
        echo -e "  ${CYAN}Vitest runs in dedicated CI job (hook-typescript-tests) — skipping here${NC}"
    elif [[ -d "$PROJECT_ROOT/src/hooks/node_modules" ]]; then
        echo -e "${BOLD}${CYAN}TYPESCRIPT HOOK TESTS (vitest)${NC}"
        # silent: best-effort — arch probe only; a missing node falls through to the mismatch SKIP path
        VITEST_NODE_ARCH=$(node -p "process.arch" 2>/dev/null || true)
        VITEST_HAS_ARM64="false"
        VITEST_HAS_X64="false"
        if [[ -d "$PROJECT_ROOT/src/hooks/node_modules/@rollup/rollup-darwin-arm64" ]]; then VITEST_HAS_ARM64="true"; fi
        if [[ -d "$PROJECT_ROOT/src/hooks/node_modules/@rollup/rollup-darwin-x64" ]]; then VITEST_HAS_X64="true"; fi

        if [[ "$VITEST_NODE_ARCH" == "arm64" && "$VITEST_HAS_ARM64" != "true" ]] || \
           [[ "$VITEST_NODE_ARCH" == "x64" && "$VITEST_HAS_X64" != "true" ]]; then
            echo -e "${YELLOW}SKIP: Node architecture ($VITEST_NODE_ARCH) mismatch with installed modules${NC}"
            echo -e "${YELLOW}      Run 'cd src/hooks && rm -rf node_modules && npm i' to fix${NC}"
            echo "TypeScript Hook Tests (vitest):SKIP" >> "$RESULTS_FILE"
        else
            VITEST_EXIT=0
            VITEST_OUTPUT=$(cd "$PROJECT_ROOT/src/hooks" && npx vitest run --reporter=verbose 2>&1) || VITEST_EXIT=$?
            VITEST_PASSED=$(echo "$VITEST_OUTPUT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1 || echo "0")
            VITEST_FAILED=$(echo "$VITEST_OUTPUT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1 || echo "0")
            if [[ $VITEST_EXIT -eq 0 ]]; then
                TOTAL_PASSED=$((TOTAL_PASSED + 1))
                echo "TypeScript Hook Tests (vitest):PASS" >> "$RESULTS_FILE"
                echo -e "TypeScript Hook Tests (vitest)          ${GREEN}PASS${NC} (${VITEST_PASSED} passed)"
            else
                TOTAL_FAILED=$((TOTAL_FAILED + 1))
                echo "TypeScript Hook Tests (vitest):FAIL" >> "$RESULTS_FILE"
                echo -e "TypeScript Hook Tests (vitest)          ${RED}FAIL${NC} (${VITEST_FAILED} failed)"
                echo "$VITEST_OUTPUT" | tail -40
            fi
        fi
    fi
fi

# ============================================================
# SECURITY TESTS (CRITICAL - ZERO TOLERANCE)
# ============================================================
if [[ "$RUN_SECURITY" == "true" ]]; then
    echo -e "${BOLD}${RED}SECURITY TESTS (CRITICAL - ZERO TOLERANCE)${NC}"
    run_dir "Security" "security"
fi

# ============================================================
# INTEGRATION TESTS
# ============================================================
if [[ "$RUN_INTEGRATION" == "true" ]]; then
    echo -e "${BOLD}${CYAN}INTEGRATION TESTS${NC}"
    run_dir "Integration" "integration"
    run_dir "External Installation" "external"
    run_dir "Feedback System" "feedback"
fi

# ============================================================
# E2E TESTS
# ============================================================
if [[ "$RUN_E2E" == "true" ]]; then
    echo -e "${BOLD}${CYAN}E2E TESTS${NC}"
    run_dir "E2E" "e2e"
fi

# ============================================================
# SKILL / AGENT / PLUGIN TESTS
# ============================================================
if [[ "$RUN_SKILLS" == "true" ]]; then
    echo -e "${BOLD}${CYAN}SKILL / AGENT / PLUGIN TESTS${NC}"
    skills_warnings_before=$TOTAL_WARNINGS
    skills_tests_before=$TOTAL_TESTS_RUN
    skills_unreadable_before=$TOTAL_UNREADABLE
    run_dir "Skills" "skills"
    run_dir "Agents" "agents"
    run_dir "Subagents" "subagents"
    run_dir "Manifests" "manifests"
    run_dir "Schemas" "schemas"
    run_dir "Plugins" "plugins"
    run_dir "Quality" "quality"
    # Detector-vs-ratchet split: see header. Same env CI uses (#3245).
    ORK_UNREACHABLE_SKILLS_ADVISORY=1 run_dir "Orphans" "orphans"
    run_script "Skill Efficiency Scorecard (advisory)" "$SCRIPT_DIR/skills/functional/skill-efficiency-scorecard.sh" "true"

    # Undercount floor (row 11): the warning ratchet only means something if the run
    # really looked at the skills. A transcript that reports no warnings, or far fewer
    # tests than a normal run, is an undercount (a skipped or crashed section, a
    # changed output format), and an undercount must never lower the baseline.
    # ORK_SKILLS_MIN_TESTS: measured 163 tests on 2026-11-13; raise it as tests are
    # added, never lower it to quiet a failing run.
    skills_warnings=$((TOTAL_WARNINGS - skills_warnings_before))
    skills_tests=$((TOTAL_TESTS_RUN - skills_tests_before))
    SKILLS_MIN_TESTS="${ORK_SKILLS_MIN_TESTS:-150}"
    if [[ $skills_tests -lt $SKILLS_MIN_TESTS ]]; then
        echo -e "${RED}Skills run floor: only $skills_tests tests ran (expected at least $SKILLS_MIN_TESTS). The warning count cannot be trusted.${NC}"
        echo "Skills undercount floor:FAIL" >> "$RESULTS_FILE"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
    elif [[ $skills_warnings -eq 0 ]]; then
        echo -e "${RED}Skills run floor: $skills_tests tests ran but 0 warnings were counted. The count is an undercount, not a clean run.${NC}"
        echo "Skills undercount floor:FAIL" >> "$RESULTS_FILE"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
    else
        echo -e "${GREEN}Skills run floor ok: $skills_tests tests (min $SKILLS_MIN_TESTS), $skills_warnings warnings counted.${NC}"

        # The ratchet gate (row 12). A count above the baseline fails the run, locally and in
        # the required CI row that calls this script, so growth can no longer exit 0. A count
        # that cannot be read fails too, with its own message. Only the skills block is
        # compared: the baseline was measured on it, not on the other categories.
        skills_unreadable=$((TOTAL_UNREADABLE - skills_unreadable_before))
        ratchet_rc=0
        if [[ $skills_unreadable -gt 0 ]]; then
            RATCHET_MSG="Warnings ratchet UNREADABLE: $skills_unreadable line(s) name \"Warnings:\" without a number after it. A count that cannot be read is not a pass."
            ratchet_rc=2
        else
            RATCHET_MSG="$(ratchet_check "$skills_warnings" "$WARNINGS_BASELINE")" || ratchet_rc=$?
        fi
        RATCHET_RAN="true"
        if [[ $ratchet_rc -eq 0 ]]; then
            echo -e "${YELLOW}$RATCHET_MSG${NC}"
            echo "Warnings ratchet:PASS" >> "$RESULTS_FILE"
        else
            echo -e "${RED}$RATCHET_MSG${NC}"
            echo "Warnings ratchet:FAIL" >> "$RESULTS_FILE"
            TOTAL_FAILED=$((TOTAL_FAILED + 1))
            RATCHET_FAILED="true"
        fi
    fi
fi

# ============================================================
# PERFORMANCE TESTS
# ============================================================
if [[ "$RUN_PERFORMANCE" == "true" ]]; then
    echo -e "${BOLD}${CYAN}PERFORMANCE TESTS${NC}"
    run_dir "Performance" "performance"
fi

# ============================================================
# PER-CATEGORY WARNINGS GATE (row 12 ruling)
#
# Every category that ran is compared with its own line of tests/warnings-baselines.txt. A
# category above its line fails, a category BELOW its line fails (strict: the message names
# the category, the measured count and the exact line to write, and the same change lowers
# it), a category with no line fails, and a count that cannot be read fails, each with its
# own message. Baselines only fall, and no slack is left under them.
# ============================================================
CATEGORY_SUM=0
if [[ -s "$CATEGORY_FILE" ]]; then
    echo -e "${BOLD}${CYAN}WARNINGS PER CATEGORY${NC}"
    # The table is printed either way, so a missing baselines file still shows the measured counts.
    if [[ ! -r "$BASELINES_FILE" ]]; then
        echo -e "${RED}Warnings ratchet UNREADABLE: the baselines file $BASELINES_FILE is missing or unreadable, so no category can be compared. This is not a pass.${NC}"
        echo "Warnings baselines file:FAIL" >> "$RESULTS_FILE"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        printf "  %-42s %8s\n" "Category" "Warnings"
        while IFS='|' read -r cat_label cat_count cat_unreadable; do
            CATEGORY_SUM=$((CATEGORY_SUM + cat_count))
            printf "  %-42s %8s\n" "$cat_label" "$cat_count"
        done < "$CATEGORY_FILE"
        echo "  Sum over the categories that ran: $CATEGORY_SUM"
    else
        printf "  %-42s %8s %9s\n" "Category" "Warnings" "Baseline"
        while IFS='|' read -r cat_label cat_count cat_unreadable; do
            CATEGORY_SUM=$((CATEGORY_SUM + cat_count))
            cat_rc=0
            cat_baseline="-"
            if ! cat_baseline="$(category_baseline "$BASELINES_FILE" "$cat_label")"; then
                cat_baseline="-"
                cat_msg="Warnings ratchet NO BASELINE in category $cat_label: it counted $cat_count and tests/warnings-baselines.txt has no '$cat_label=<number>' line. A category without a baseline is not a pass: write the line '$cat_label=$cat_count'."
                cat_rc=4
            elif [[ "$cat_unreadable" -gt 0 ]]; then
                cat_msg="Warnings ratchet UNREADABLE in category $cat_label: $cat_unreadable line(s) name \"Warnings:\" without a number after it. A count that cannot be read is not a pass."
                cat_rc=2
            else
                cat_msg="$(ratchet_check "$cat_count" "$cat_baseline" "$cat_label")" || cat_rc=$?
            fi
            printf "  %-42s %8s %9s\n" "$cat_label" "$cat_count" "$cat_baseline"
            if [[ $cat_rc -ne 0 ]]; then
                echo -e "${RED}$cat_msg${NC}"
                echo "Warnings ratchet $cat_label:FAIL" >> "$RESULTS_FILE"
                TOTAL_FAILED=$((TOTAL_FAILED + 1))
            fi
        done < "$CATEGORY_FILE"
        echo "  Sum over the categories that ran: $CATEGORY_SUM"
    fi
    echo ""
fi

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                        TEST SUMMARY                              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

printf "%-45s %s\n" "Category" "Result"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
while IFS=: read -r test_name result; do
    case $result in
        PASS) color="${GREEN}" ;;
        FAIL) color="${RED}" ;;
        WARN|SKIP) color="${YELLOW}" ;;
        *) color="${NC}" ;;
    esac
    printf "%-45s ${color}%s${NC}\n" "$test_name" "$result"
done < "$RESULTS_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Categories: ${GREEN}$TOTAL_PASSED passed${NC}, ${RED}$TOTAL_FAILED failed${NC}"
if [[ "$RATCHET_RAN" == "true" ]]; then
    if [[ "$RATCHET_FAILED" == "true" ]]; then
        echo -e "${RED}$RATCHET_MSG${NC}"
    else
        echo -e "${YELLOW}$RATCHET_MSG${NC}"
    fi
elif [[ $TOTAL_WARNINGS -gt 0 ]]; then
    # Not a skills run: the baseline was measured on the skills block, so it is not compared.
    echo -e "${YELLOW}Advisory warnings this run: $TOTAL_WARNINGS (not ratcheted, only a skills run is compared with the baseline)${NC}"
fi
echo ""

if [[ $TOTAL_FAILED -gt 0 ]]; then
    echo -e "${RED}${BOLD}TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}${BOLD}ALL TESTS PASSED${NC}"
    exit 0
fi
