#!/bin/bash
# Main Test Runner
# Executes all tests for the OrchestKit Claude Plugin
#
# Usage: ./run-all-tests.sh [OPTIONS]
#
# Options:
#   --verbose       Show detailed output
#   --quick         Skip integration tests (faster)
#   --unit          Run only unit tests
#   --security      Run only security tests
#   --integration   Run only integration tests
#   --e2e           Run only E2E tests
#   --performance   Run only performance tests
#   --lint          Run only lint/static analysis
#   --all           Run all tests (default)
#   --coverage      Generate coverage report
#
# Exit codes: 0 = all pass, 1 = failures found
#
# Version: 3.0.0 - Comprehensive Test Suite with CI Integration

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
VERBOSE=""
QUICK=""
RUN_LINT="true"
RUN_UNIT="true"
RUN_SECURITY="true"
RUN_INTEGRATION="true"
RUN_E2E="true"
RUN_PERFORMANCE="true"
RUN_SKILLS="true"
COVERAGE=""
SPECIFIC_CATEGORY=""

for arg in "$@"; do
    case $arg in
        --verbose) VERBOSE="--verbose" ;;
        --quick) QUICK="true"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --lint) SPECIFIC_CATEGORY="lint"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --unit) SPECIFIC_CATEGORY="unit"; RUN_LINT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --security) SPECIFIC_CATEGORY="security"; RUN_LINT="false"; RUN_UNIT="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --integration) SPECIFIC_CATEGORY="integration"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_E2E="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --e2e) SPECIFIC_CATEGORY="e2e"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_PERFORMANCE="false"; RUN_SKILLS="false" ;;
        --performance) SPECIFIC_CATEGORY="performance"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_SKILLS="false" ;;
        --skills) SPECIFIC_CATEGORY="skills"; RUN_LINT="false"; RUN_UNIT="false"; RUN_SECURITY="false"; RUN_INTEGRATION="false"; RUN_E2E="false"; RUN_PERFORMANCE="false" ;;
        --all) RUN_LINT="true"; RUN_UNIT="true"; RUN_SECURITY="true"; RUN_INTEGRATION="true"; RUN_E2E="true"; RUN_PERFORMANCE="true"; RUN_SKILLS="true" ;;
        --coverage) COVERAGE="true" ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --verbose       Show detailed output"
            echo "  --quick         Skip integration, E2E, and performance tests"
            echo "  --lint          Run only lint/static analysis"
            echo "  --unit          Run only unit tests"
            echo "  --security      Run only security tests (CRITICAL)"
            echo "  --integration   Run only integration tests"
            echo "  --e2e           Run only E2E tests"
            echo "  --performance   Run only performance tests"
            echo "  --skills        Run only skill/subagent tests"
            echo "  --all           Run all tests (default)"
            echo "  --coverage      Generate coverage report"
            echo "  --help          Show this help"
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

# Results tracking (using files for bash 3.x compatibility)
RESULTS_FILE=$(mktemp)
TOTAL_PASSED=0
TOTAL_FAILED=0
# Advisory-warning ratchet (2026-08-01): sections printed "Warnings: N" lines
# totalling 348 across a full run with nothing counting them — an unowned mass
# that reads as noise precisely because no number ever moves. Summed here and
# compared against a baseline at the summary; growth is reported LOUDLY but
# stays advisory (a hard gate on 348 pre-existing advisories would report a
# regression that did not happen — same reasoning as UNREACHABLE_BASELINE).
# Ratchet DOWN as sections get cleaned; never raise it to quiet the summary.
TOTAL_WARNINGS=0
WARNINGS_BASELINE="${ORK_WARNINGS_BASELINE:-348}"

trap "rm -f $RESULTS_FILE" EXIT

# Make all test scripts executable
find "$SCRIPT_DIR" -name "*.sh" -exec chmod +x {} \;
find "$PROJECT_ROOT/src/hooks" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        OrchestKit Claude Plugin - Test Suite v3.0                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

run_test() {
    local name="$1"
    local script="$2"
    local optional="${3:-false}"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Running: $name${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [[ ! -f "$script" ]]; then
        echo -e "${YELLOW}SKIP: Test script not found${NC}"
        echo "$name:SKIP" >> "$RESULTS_FILE"
        return 0
    fi

    # Pick the interpreter from the file, do not assume bash. Wiring the
    # reclaimed tests added .mjs suites here for the first time, and `bash`
    # on a Node file is a shell syntax error (exit 2), so test-import-symbols
    # and test-registry-resolve reported FAIL in the suite while passing
    # standalone. That is the exact "suite context differs" trap, and it looked
    # like a flaky test rather than a runner bug.
    local runner=bash
    case "$script" in
        *.mjs|*.js) runner=node ;;
        *.py)       runner=python3 ;;
    esac

    local exit_code=0
    # tee through a temp file so the warning ratchet can count "Warnings: N"
    # lines without changing what the operator sees. PIPESTATUS[0] preserves
    # the test's real exit code (the pipeline's own exit is tee's 0).
    local section_out
    section_out=$(mktemp)
    if [[ -n "$VERBOSE" ]]; then
        "$runner" "$script" $VERBOSE 2>&1 | tee "$section_out"
        exit_code=${PIPESTATUS[0]}
    else
        "$runner" "$script" 2>&1 | tee "$section_out"
        exit_code=${PIPESTATUS[0]}
    fi
    local section_warnings
    section_warnings=$(grep -oE "Warnings:[[:space:]]+[0-9]+" "$section_out" | awk '{s+=$2} END {print s+0}')
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + section_warnings))
    rm -f "$section_out"

    echo ""

    if [[ $exit_code -eq 0 ]]; then
        echo "$name:PASS" >> "$RESULTS_FILE"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
        return 0
    else
        if [[ "$optional" == "true" ]]; then
            echo "$name:WARN" >> "$RESULTS_FILE"
            echo -e "${YELLOW}Optional test failed (non-blocking)${NC}"
            return 0
        else
            echo "$name:FAIL" >> "$RESULTS_FILE"
            TOTAL_FAILED=$((TOTAL_FAILED + 1))
            return 1
        fi
    fi
}

# ============================================================
# LINT / STATIC ANALYSIS
# ============================================================

if [[ "$RUN_LINT" == "true" ]]; then
    echo -e "${BOLD}${CYAN}LINT / STATIC ANALYSIS${NC}"
    echo ""

    run_test "Static Analysis Suite" "$SCRIPT_DIR/ci/lint.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Playground Gate Inertness (#3193)" "$SCRIPT_DIR/ci/test-playground-gate-inertness.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Passive Index Generation" "$SCRIPT_DIR/indexes/test-index-generation.sh" || true
fi

# ============================================================
# UNIT TESTS
# ============================================================

if [[ "$RUN_UNIT" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}UNIT TESTS${NC}"
    echo ""

    run_test "Shell Syntax Validation" "$SCRIPT_DIR/unit/test-shell-syntax.sh" || true  # silent: known-noise
    run_test "Build Install Preflight (#1899)" "$SCRIPT_DIR/build/test-check-install.sh" || true  # silent: known-noise
    run_test "Build mcp-server Fresh-Deps Guard (#1796)" "$SCRIPT_DIR/unit/test-build-mcp-deps-fresh.sh" || true  # silent: known-noise
    run_test "MCP Memory Persistence Guard (#2631)" "$SCRIPT_DIR/unit/test-mcp-memory-path.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Hook Registry Closure (#959/#2886)" "$SCRIPT_DIR/unit/test-hook-registry-closure.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "JSON Validity Check" "$SCRIPT_DIR/unit/test-json-validity.sh" || true
    run_test "Hook Executability" "$SCRIPT_DIR/unit/test-hook-executability.sh" || true
    run_test "Context Schema Validation" "$SCRIPT_DIR/unit/test-context-schemas.sh" || true
    run_test "Graph Utils Unit Tests" "$SCRIPT_DIR/unit/test-graph-utils.sh" || true
    run_test "MDX Compile Guard" "$SCRIPT_DIR/unit/test-mdx-compile.sh" || true
    run_test "Version Sync Round-Trip" "$SCRIPT_DIR/unit/test-sync-versions.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Memory Index Budget Check" "$SCRIPT_DIR/unit/test-memory-index-budget.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Audit-Activation Script" "$SCRIPT_DIR/unit/test-audit-activation.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Eval Coverage Ratchet (#2192)" "$SCRIPT_DIR/evals/test-eval-coverage.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Dead-Generation Guard (#3036)" "$SCRIPT_DIR/evals/test-dead-generation-guard.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Changed Fan-Out Exit Propagation (#3032)" "$SCRIPT_DIR/evals/test-changed-fanout-exit.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Quality Index Gate (#2194)" "$SCRIPT_DIR/evals/test-quality-index-gate.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Handoff Bundle Schema" "$SCRIPT_DIR/unit/test-handoff-bundle-schema.sh" || true
    run_test "Stub Fallback Integration" "$SCRIPT_DIR/unit/test-stub-fallback.sh" || true  # silent: known-noise
    run_test "M127 Boot Helpers + Clerk Mapping" "$SCRIPT_DIR/unit/test-m127-boot-helpers.sh" || true  # silent: known-noise
    run_test "ASCII Snapshots (4 patterns x 5 sets)" "$SCRIPT_DIR/unit/test-ascii-snapshots.sh" || true  # silent: known-noise
    run_test "ASCII Token-set Scan (advisory)" "$SCRIPT_DIR/unit/test-ascii-tokens.sh" || true  # silent: known-noise
    run_test "ASCII Density Scan (advisory)" "$SCRIPT_DIR/unit/test-ascii-density.sh" || true  # silent: known-noise
    run_test "ASCII i18n Alignment (CJK + Devanagari)" "$SCRIPT_DIR/unit/test-ascii-i18n.sh" || true  # silent: known-noise

    # --- reclaimed by #3220: these existed but no runner referenced them,
    #     so they had never executed. All verified passing before wiring.
    run_test "Cc 216 Compliance" "$SCRIPT_DIR/compliance/test-cc-216-compliance.sh" || true
    run_test "Config System" "$SCRIPT_DIR/config/test-config-system.sh" || true
    run_test "Bundle No External Deps" "$SCRIPT_DIR/hooks/test-bundle-no-external-deps.sh" || true
    run_test "Context Injection Budget" "$SCRIPT_DIR/hooks/test-context-injection-budget.sh" || true
    run_test "Migrations Shipped" "$SCRIPT_DIR/hooks/test-migrations-shipped.sh" || true
    run_test "Native Binary Compat" "$SCRIPT_DIR/hooks/test-native-binary-compat.sh" || true
    run_test "Claude Md Injection" "$SCRIPT_DIR/indexes/test-claude-md-injection.sh" || true
    run_test "Keyword Extraction" "$SCRIPT_DIR/indexes/test-keyword-extraction.sh" || true
    run_test "Vercel Format" "$SCRIPT_DIR/indexes/test-vercel-format.sh" || true
    run_test "Cc Version Ceiling" "$SCRIPT_DIR/manifests/test-cc-version-ceiling.sh" || true
    run_test "Hook Exec Form" "$SCRIPT_DIR/manifests/test-hook-exec-form.sh" || true
    run_test "Build Drift" "$SCRIPT_DIR/plugins/test-build-drift.sh" || true
    run_test "Marketplace Structure" "$SCRIPT_DIR/plugins/test-marketplace-structure.sh" || true
    run_test "Async Hooks" "$SCRIPT_DIR/unit/test-async-hooks.sh" || true
    run_test "Cdn Video Pipeline" "$SCRIPT_DIR/unit/test-cdn-video-pipeline.sh" || true
    run_test "Hook Stdin Consumption" "$SCRIPT_DIR/unit/test-hook-stdin-consumption.sh" || true
    run_test "Import Symbols" "$SCRIPT_DIR/unit/test-import-symbols.mjs" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    # Python half of the phantom-symbol gate. Skips unless ORK_PYTHON_SYMBOLS=1
    # because it downloads wheels from PyPI, and a network-dependent hard gate is
    # one people learn to ignore. Wired here so it is not an orphaned test.
    run_test "Python Symbols (network, opt-in)" "$SCRIPT_DIR/skills/structure/test-python-symbols.sh" || true  # silent: best-effort — run_test records FAIL in TOTAL_FAILED; || true keeps the suite running
    run_test "Parse Frontmatter" "$SCRIPT_DIR/unit/test-parse-frontmatter.sh" || true
    run_test "Registry Resolve" "$SCRIPT_DIR/unit/test-registry-resolve.mjs" || true
    run_test "Whats New" "$SCRIPT_DIR/unit/test-whats-new.sh" || true
    run_test "Worktree Discovery" "$SCRIPT_DIR/worktree/test-worktree-discovery.sh" || true

    # TypeScript hook tests (vitest)
    if [[ -n "${CI:-}" ]]; then
        echo -e "  ${CYAN}Vitest runs in dedicated CI job (hook-typescript-tests) — skipping here${NC}"
        # Don't count as PASS or SKIP — vitest has its own CI job
    elif [[ -d "$PROJECT_ROOT/src/hooks/node_modules" ]]; then
        echo ""
        echo -e "${BOLD}${CYAN}TYPESCRIPT HOOK TESTS (vitest)${NC}"
        echo ""

        # Check for node architecture mismatch (common on macOS with mixed arm64/x64)
        VITEST_NODE_ARCH=$(node -p "process.arch" 2>/dev/null)
        VITEST_HAS_ARM64="false"
        VITEST_HAS_X64="false"
        [[ -d "$PROJECT_ROOT/src/hooks/node_modules/@rollup/rollup-darwin-arm64" ]] && VITEST_HAS_ARM64="true"
        [[ -d "$PROJECT_ROOT/src/hooks/node_modules/@rollup/rollup-darwin-x64" ]] && VITEST_HAS_X64="true"

        if [[ "$VITEST_NODE_ARCH" == "arm64" && "$VITEST_HAS_ARM64" != "true" ]] || \
           [[ "$VITEST_NODE_ARCH" == "x64" && "$VITEST_HAS_X64" != "true" ]]; then
            echo -e "${YELLOW}SKIP: Node architecture ($VITEST_NODE_ARCH) mismatch with installed modules${NC}"
            echo -e "${YELLOW}      Run 'cd src/hooks && rm -rf node_modules && npm i' to fix${NC}"
            echo -e "TypeScript Hook Tests (vitest)          ${YELLOW}SKIP${NC}"
        else
            VITEST_OUTPUT=$(cd "$PROJECT_ROOT/src/hooks" && npx vitest run --reporter=verbose 2>&1) && VITEST_EXIT=0 || VITEST_EXIT=$?

            # Parse vitest output for pass/fail/skip counts
            VITEST_PASSED=$(echo "$VITEST_OUTPUT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo "0")
            VITEST_FAILED=$(echo "$VITEST_OUTPUT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' || echo "0")
            VITEST_SKIPPED=$(echo "$VITEST_OUTPUT" | grep -oE '[0-9]+ skipped' | grep -oE '[0-9]+' || echo "0")

            if [[ $VITEST_EXIT -eq 0 ]]; then
                TOTAL_PASSED=$((TOTAL_PASSED + 1))
                echo -e "TypeScript Hook Tests (vitest)          ${GREEN}PASS${NC}"
            else
                TOTAL_FAILED=$((TOTAL_FAILED + 1))
                echo -e "TypeScript Hook Tests (vitest)          ${RED}FAIL${NC}"
            fi
            echo -e "  vitest: ${GREEN}${VITEST_PASSED} passed${NC}, ${RED}${VITEST_FAILED} failed${NC}, ${YELLOW}${VITEST_SKIPPED} skipped${NC}"
        fi
    fi
fi

# ============================================================
# SECURITY TESTS (CRITICAL - ZERO TOLERANCE)
# ============================================================

if [[ "$RUN_SECURITY" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${RED}SECURITY TESTS (CRITICAL - ZERO TOLERANCE)${NC}"
    echo ""

    run_test "Command Injection Tests" "$SCRIPT_DIR/security/test-command-injection.sh" || true
    run_test "JQ Injection Tests" "$SCRIPT_DIR/security/test-jq-injection.sh" || true
    run_test "Path Traversal Tests" "$SCRIPT_DIR/security/test-path-traversal.sh" || true
    run_test "Unicode Attack Tests" "$SCRIPT_DIR/security/test-unicode-attacks.sh" || true
    run_test "Symlink Attack Tests" "$SCRIPT_DIR/security/test-symlink-attacks.sh" || true
    run_test "Input Validation Tests" "$SCRIPT_DIR/security/test-input-validation.sh" || true
    run_test "Additional Security Tests" "$SCRIPT_DIR/security/test-additional-security.sh" || true

    # --- reclaimed by #3220: these existed but no runner referenced them,
    #     so they had never executed. All verified passing before wiring.
    run_test "Npm Audit Coverage" "$SCRIPT_DIR/security/test-npm-audit-coverage.sh" || true
    # Mem0 removed — security tests deleted
fi

# ============================================================
# INTEGRATION TESTS
# ============================================================

if [[ "$RUN_INTEGRATION" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}INTEGRATION TESTS${NC}"
    echo ""

    run_test "Hook Chain Integration" "$SCRIPT_DIR/integration/test-hook-chains.sh" || true
    run_test "Context System Integration" "$SCRIPT_DIR/integration/test-context-system.sh" || true
    run_test "Plugin Installation Validation" "$SCRIPT_DIR/integration/test-plugin-installation.sh" || true

    # OTEL fixture tests must fail CI on regression — exit-code suppression intentionally absent.
    # Catches drift between the documented jq queries in otel-fields.md and fixture-expected output.
    run_test "OTEL Panel Fixtures (M129)" "$SCRIPT_DIR/integration/test-otel-panels.sh"

    # M130 #1486 — CC release watch end-to-end against synthetic fixture.
    # Must fail CI: regression here means the auto-adoption pipeline broke.
    run_test "CC Release Watch (M130)" "$SCRIPT_DIR/integration/test-cc-release-watch.sh"

    # Step 3 issue-filer (cc-file-adoption-issues.sh) — was authored (#1696) but
    # never registered in the runner; activates it + the issues_filed_at stamp guard.
    run_test "CC Release Watch Step 3 (M134)" "$SCRIPT_DIR/integration/test-cc-release-watch-step3.sh"

    # Visual-style validator + local pre-flight (shared engine with the CI lint).
    run_test "Visual-Style Validator" "$SCRIPT_DIR/integration/test-visual-style-validator.sh"

    # M130 #1488 — CC support-window stamper idempotence and propagation.
    run_test "CC Support Stamper (M130)" "$SCRIPT_DIR/integration/test-cc-support-stamper.sh"

    # M130 hotfix — cc-triage.mjs LLM extraction, sentinel, and slug sanitization.
    run_test "CC Triage (M130 hotfix)" "$SCRIPT_DIR/integration/test-cc-triage.sh"

    # Regression: workflows installing claude-code with --ignore-scripts must
    # also run install.cjs to fetch the native binary. See run 25443026871.
    run_test "CC CLI install pattern" "$SCRIPT_DIR/integration/test-cc-cli-install-pattern.sh"

    # Mem0 removed — integration tests deleted

    # External Installation Tests (v4.12.0)
    run_test "External Installation Tests" "$SCRIPT_DIR/external/test-installation.sh" || true

    # Feedback System Tests (v4.12.0)
    run_test "Feedback System Tests" "$SCRIPT_DIR/feedback/test-feedback-system.sh" || true

    # --- reclaimed by #3220: these existed but no runner referenced them,
    #     so they had never executed. All verified passing before wiring.
    run_test "Output Guard Dispatcher" "$SCRIPT_DIR/integration/hooks/test-output-guard-dispatcher.sh" || true
    run_test "Cc Backfill Changelog Ref" "$SCRIPT_DIR/integration/test-cc-backfill-changelog-ref.sh" || true
    run_test "Cc Stale Belowfloor" "$SCRIPT_DIR/integration/test-cc-stale-belowfloor.sh" || true
    run_test "Context Deferral" "$SCRIPT_DIR/integration/test-context-deferral.sh" || true
    run_test "Full Mcp Integration" "$SCRIPT_DIR/integration/test-full-mcp-integration.sh" || true
    run_test "Image Paste Pipeline" "$SCRIPT_DIR/integration/test-image-paste-pipeline.sh" || true
    run_test "Multi Instance Gates" "$SCRIPT_DIR/integration/test-multi-instance-gates.sh" || true
fi

# ============================================================
# E2E TESTS
# ============================================================

if [[ "$RUN_E2E" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}E2E TESTS${NC}"
    echo ""

    run_test "Agent Lifecycle E2E" "$SCRIPT_DIR/e2e/test-agent-lifecycle.sh" || true
    run_test "Coordination System E2E" "$SCRIPT_DIR/e2e/test-coordination-e2e.sh" || true
    # Bare path, no `bash ` prefix: run_test's own `[[ ! -f "$script" ]]` guard
    # sees a filename starting with "bash " and SKIPs silently — this exact
    # line was dead in every local run until 2026-08-01 (CI's dir glob was the
    # only thing executing the file). Same class as the Docs-Site Drift wiring
    # fix; swept the file, this was the last interpreter-prefixed run_test.
    run_test "Hook Execution E2E" "tests/e2e/test-hook-execution.sh" || true  # silent: best-effort (run_test records failures; suite exits non-zero at end)

    # Agent Lifecycle E2E Tests (v4.12.0)
    run_test "Agent Lifecycle E2E (New)" "$SCRIPT_DIR/agents/test-agent-lifecycle-e2e.sh" || true

    # --- reclaimed by #3220: these existed but no runner referenced them,
    #     so they had never executed. All verified passing before wiring.
    run_test "Progressive Loading" "$SCRIPT_DIR/e2e/test-progressive-loading.sh" || true
fi

# ============================================================
# PERFORMANCE TESTS

# ============================================================
# SKILL / SUBAGENT TESTS
# ============================================================

if [[ "$RUN_SKILLS" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}SKILL / SUBAGENT TESTS${NC}"
    echo ""

    # Run skill tests via the skill test runner (uses quick mode in main runner)
    if [[ -f "$SCRIPT_DIR/skills/run-skill-tests.sh" ]]; then
        run_test "SKILL.md Validation" "$SCRIPT_DIR/skills/structure/test-skill-md.sh" || true
        run_test "Rule File Validation" "$SCRIPT_DIR/skills/structure/test-rule-validation.sh" || true  # silent: best-effort (run_test records failures; suite exits non-zero at end)
        run_test "AskUserQuestion Schema" "$SCRIPT_DIR/skills/structure/test-askuserquestion-schema.sh" || true  # silent: best-effort
        run_test "Model ID Vocabulary" "$SCRIPT_DIR/skills/structure/test-model-id-vocab.sh" || true  # silent: best-effort
        run_test "Rubric Schema (ork-rubric/1.0)" "$SCRIPT_DIR/skills/structure/test-rubric-schema.sh" || true  # silent: best-effort
        run_test "Semantic Matching" "$SCRIPT_DIR/skills/semantic-matching/test-skill-discovery.sh" || true
        run_test "Skill-Agent Integration" "$SCRIPT_DIR/skills/integration/test-skill-agent-integration.sh" || true
        run_test "Agent Definitions" "$SCRIPT_DIR/subagents/definition/test-agent-definitions.sh" || true
        # Reachability gate: a skill with no slash command AND model invocation
        # disabled AND no skills: frontmatter wiring cannot be invoked by anyone.
        #
        # ADVISORY here on purpose. Two gates read the same signal and they are
        # not redundant: tests/skills/structure/test-skill-reachability.mjs is
        # the RATCHET (UNREACHABLE_BASELINE=29, fails only on an increase), and
        # this script is the DETECTOR, which has no baseline and exits 1 on any
        # unreachable skill at all. Running the detector as a hard gate would
        # fail the suite on the 29 the ratchet has already accepted, i.e. it
        # would report a regression that did not happen. Enforcement stays with
        # the ratchet; this reports the current list.
        ORK_UNREACHABLE_SKILLS_ADVISORY=1 \
          run_test "Unreachable Skills (advisory)" "$SCRIPT_DIR/orphans/test-unreachable-skills.sh" || true  # silent: best-effort (run_test records failures; suite exits non-zero at end)
        # Docs-site drift gate: bin/validate-counts.sh gates the repo's own
        # count surfaces but never looked at docs/site/content/**, which is how
        # the 2026-08-01 audit found 12 wrong totals and 5 dead /ork: commands
        # there while validate-counts.sh was green. Ground truth is derived from
        # src/ at runtime, so this gate cannot itself go stale.
        # Bare path, no `node ` prefix: run_test guards on `[[ ! -f "$script" ]]`,
        # so "node <path>" is not a file and SKIPs silently every run. run_test
        # already selects node for *.mjs a few lines below that guard.
        run_test "Docs-Site Drift" "$SCRIPT_DIR/skills/structure/test-docs-site-drift.mjs" || true  # silent: best-effort (run_test records failures; suite exits non-zero at end)
        # Policy gate: a workflow that invokes an LLM must be manually
        # triggered. Max-plan OAuth is $0 in dollars but draws on the shared
        # weekly quota, so an automatic run competes with the operator's own
        # interactive sessions.
        run_test "No Automatic LLM in CI" "$SCRIPT_DIR/unit/test-no-llm-in-ci.sh" || true  # silent: best-effort (run_test records failures; suite exits non-zero at end)
        # Tool-coverage gate: allowed-tools must cover the tools the body
        # instructs. Wrapper translates the audit's 0/1/2/3 into pass/fail; see
        # its header. The underlying audit had never run in any CI path.
        run_test "Skill Tool Coverage" "$SCRIPT_DIR/skills/test-skill-tool-coverage.sh" || true  # silent: best-effort (run_test records failures; suite exits non-zero at end)
        # Model-recency gate: catches prose model claims ("requires Opus 4.8")
        # while exempting historical prose ("landed in Opus 4.8"). Also never
        # referenced by a runner before this line.
        run_test "Model Recency" "$SCRIPT_DIR/skills/structure/test-model-recency.sh" || true  # silent: best-effort (run_test records failures; suite exits non-zero at end)
    fi

    # Functional tests (rule traceability, efficiency scorecard)
    # silent: best-effort (run_test records failures; suite exits non-zero at end)
    run_test "Rule Traceability" "$SCRIPT_DIR/skills/functional/test-rule-traceability.sh" || true
    # silent: best-effort (run_test records failures; suite exits non-zero at end)
    run_test "Skill Efficiency Scorecard" "$SCRIPT_DIR/skills/functional/skill-efficiency-scorecard.sh" "true" || true

    # Plugin structure validation (CC 2.1.16 compliance)
    run_test "Plugin JSON Schema" "$SCRIPT_DIR/plugins/test-plugin-json-schema.sh" || true
    # silent: gating-relaxed - run_test records the failure in the suite tally; `|| true` only
    # stops `set -e` from aborting the remaining tests. A red test still fails the overall run.
    run_test "No Commands Directory" "$SCRIPT_DIR/plugins/test-no-commands-directory.sh" || true
    # silent: gating-relaxed - same contract as above
    run_test "Command Frontmatter Passthrough" "$SCRIPT_DIR/plugins/test-command-frontmatter-passthrough.sh" || true

    # Plugin structure compliance tests (hooks location)
    run_test "Plugin Structure Compliance" "$SCRIPT_DIR/plugins/structure/test-plugin-structure-compliance.sh" || true
    run_test "Hooks Location" "$SCRIPT_DIR/plugins/structure/test-hooks-location.sh" || true

    # --- reclaimed by #3220: these existed but no runner referenced them,
    #     so they had never executed. All verified passing before wiring.
    run_test "Agent Context Modes" "$SCRIPT_DIR/agents/test-agent-context-modes.sh" || true
    run_test "Agent Model Selection" "$SCRIPT_DIR/agents/test-agent-model-selection.sh" || true
    run_test "Agent Multi Agent Tools" "$SCRIPT_DIR/agents/test-agent-multi-agent-tools.sh" || true
    run_test "Agent Required Hooks" "$SCRIPT_DIR/agents/test-agent-required-hooks.sh" || true
    run_test "Agent Skill Validation" "$SCRIPT_DIR/agents/test-agent-skill-validation.sh" || true
    run_test "Ai Ml Agents" "$SCRIPT_DIR/agents/test-ai-ml-agents.sh" || true
    run_test "All Agent Skill Refs" "$SCRIPT_DIR/agents/test-all-agent-skill-refs.sh" || true
    run_test "Auto Mode In Description" "$SCRIPT_DIR/agents/test-auto-mode-in-description.sh" || true
    run_test "Hook Paths" "$SCRIPT_DIR/agents/test-hook-paths.sh" || true
    run_test "Script Activation" "$SCRIPT_DIR/skills/scripts/integration/test-script-activation.sh" || true
    run_test "Script Execution" "$SCRIPT_DIR/skills/scripts/integration/test-script-execution.sh" || true
    run_test "Command Execution" "$SCRIPT_DIR/skills/scripts/test-command-execution.sh" || true
    run_test "Script Content" "$SCRIPT_DIR/skills/scripts/test-script-content.sh" || true
    run_test "Script Structure" "$SCRIPT_DIR/skills/scripts/test-script-structure.sh" || true
    run_test "Assets Directory" "$SCRIPT_DIR/skills/structure/test-assets-directory.sh" || true
    run_test "Provenance Sediment" "$SCRIPT_DIR/skills/structure/test-provenance-sediment.sh" || true
    run_test "Quality Bar" "$SCRIPT_DIR/skills/structure/test-quality-bar.sh" || true
    run_test "Scripts Directory" "$SCRIPT_DIR/skills/structure/test-scripts-directory.sh" || true
    run_test "Skill Delta" "$SCRIPT_DIR/skills/structure/test-skill-delta.sh" || true
    run_test "Cross Skill Refs" "$SCRIPT_DIR/skills/test-cross-skill-refs.sh" || true
    run_test "Dashboard Specs" "$SCRIPT_DIR/skills/test-dashboard-specs.sh" || true
    run_test "Frontend Skills" "$SCRIPT_DIR/skills/test-frontend-skills.sh" || true
    run_test "Remember Memory Integration" "$SCRIPT_DIR/skills/test-remember-memory-integration.sh" || true
    run_test "Shared Scripts Drift" "$SCRIPT_DIR/skills/test-shared-scripts-drift.sh" || true
    run_test "Skill Context Modes" "$SCRIPT_DIR/skills/test-skill-context-modes.sh" || true
    run_test "Storybook Catalog Import" "$SCRIPT_DIR/skills/test-storybook-catalog-import.sh" || true
fi
# ============================================================

if [[ "$RUN_PERFORMANCE" == "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}PERFORMANCE TESTS${NC}"
    echo ""

    run_test "Token Budget Validation" "$SCRIPT_DIR/performance/test-token-budget.sh" || true
    run_test "Hook Timing Tests" "$SCRIPT_DIR/performance/test-hook-timing.sh" || true
fi

# ============================================================
# SUMMARY
# ============================================================

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                        TEST SUMMARY                              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

printf "%-40s %s\n" "Test" "Result"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while IFS=: read -r test_name result; do
    case $result in
        PASS) color="${GREEN}" ;;
        FAIL) color="${RED}" ;;
        WARN) color="${YELLOW}" ;;
        SKIP) color="${YELLOW}" ;;
        *) color="${NC}" ;;
    esac
    printf "%-40s ${color}%s${NC}\n" "$test_name" "$result"
done < "$RESULTS_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total: ${GREEN}$TOTAL_PASSED passed${NC}, ${RED}$TOTAL_FAILED failed${NC}"
if [[ $TOTAL_WARNINGS -gt $WARNINGS_BASELINE ]]; then
    echo -e "${RED}Advisory warnings: $TOTAL_WARNINGS (baseline $WARNINGS_BASELINE) — GREW. New warnings were added; triage them or they join the unowned mass.${NC}"
elif [[ $TOTAL_WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}Advisory warnings: $TOTAL_WARNINGS (baseline $WARNINGS_BASELINE)${NC}"
fi
echo ""

if [[ $TOTAL_FAILED -gt 0 ]]; then
    echo -e "${RED}${BOLD}TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}${BOLD}ALL TESTS PASSED${NC}"
    exit 0
fi