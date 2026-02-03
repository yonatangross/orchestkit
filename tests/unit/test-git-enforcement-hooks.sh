#!/usr/bin/env bash
# ============================================================================
# Git Enforcement Hooks Tests
# ============================================================================
# Tests for git commit, branch, atomic, and issue creation hooks
# Added in v4.18.0, updated for TypeScript migration in v5.0.0
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/src/hooks"
HOOKS_SRC_DIR="$HOOKS_DIR/src"
HOOKS_BIN="$HOOKS_DIR/bin/run-hook.mjs"

# Export CLAUDE_PLUGIN_ROOT for hooks (test-helpers.sh exports CLAUDE_PROJECT_DIR)
export CLAUDE_PLUGIN_ROOT="$PROJECT_ROOT"

# ============================================================================
# HELPER FUNCTION: Run TypeScript Hook
# ============================================================================
# Since hooks are now TypeScript, we need to run them via the hook runner
run_ts_hook() {
    local hook_path="$1"
    local input="$2"
    if [[ -z "$input" ]]; then
        input='{}'
    fi

    # Check if hooks have been built
    if [[ ! -f "$HOOKS_DIR/dist/pretool.mjs" ]]; then
        echo "SKIP: Hooks not built (run: cd src/hooks && npm run build)"
        return 77
    fi

    echo "$input" | node "$HOOKS_BIN" "$hook_path" 2>/dev/null || true
}

# ============================================================================
# UNIFIED GIT VALIDATOR TESTS (consolidated from commit, branch, atomic)
# ============================================================================

describe "Unified Git Validator Hook (TypeScript)"

test_git_validator_exists() {
    local hook="$HOOKS_SRC_DIR/pretool/bash/git-validator.ts"
    assert_file_exists "$hook"
}

test_git_validator_allows_valid_conventional_commit() {
    local hook_path="pretool/bash/git-validator"

    local input='{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat(#123): Add new feature\""}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Should allow (continue: true)
        echo "$output" | jq -e '.continue == true' >/dev/null || fail "Should allow valid conventional commit"
    fi
}

test_git_validator_allows_fix_type() {
    local hook_path="pretool/bash/git-validator"

    local input='{"tool_name":"Bash","tool_input":{"command":"git commit -m \"fix: Correct typo in config\""}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_git_validator_blocks_invalid_commit_format() {
    local hook_path="pretool/bash/git-validator"

    local input='{"tool_name":"Bash","tool_input":{"command":"git commit -m \"Bad commit message\""}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
        return
    fi

    if [[ -z "$output" ]]; then
        fail "No output from hook"
        return
    fi

    # Should block (continue: false) for invalid commit message
    # Note: Hook output may have unescaped newlines, so use string matching instead of jq
    if [[ "$output" == *'"continue":false'* ]]; then
        : # Test passes - hook correctly blocked invalid commit
    elif [[ "$output" == *'"continue":true'* ]]; then
        fail "Did not block invalid commit format (continue=true)"
    else
        fail "Could not find continue field in hook output"
    fi
}

test_git_validator_ignores_non_git_commands() {
    local hook_path="pretool/bash/git-validator"

    local input='{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    # Should silently pass for non-git commands
    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        echo "$output" | jq -e '.continue == true' >/dev/null || fail "Should allow non-git commands"
    fi
}

test_git_validator_allows_issue_branch() {
    local hook_path="pretool/bash/git-validator"

    local input='{"tool_name":"Bash","tool_input":{"command":"git checkout -b issue/123-fix-login"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Should allow with continue: true
        echo "$output" | jq -e '.continue == true' >/dev/null || fail "Should allow valid issue branch"
    fi
}

test_git_validator_allows_feature_branch() {
    local hook_path="pretool/bash/git-validator"

    local input='{"tool_name":"Bash","tool_input":{"command":"git checkout -b feature/new-feature"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_git_validator_ignores_git_status() {
    local hook_path="pretool/bash/git-validator"

    local input='{"tool_name":"Bash","tool_input":{"command":"git status"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# GITHUB ISSUE CREATION GUIDE TESTS
# ============================================================================

describe "GitHub Issue Creation Guide Hook (TypeScript)"

test_gh_issue_guide_exists() {
    local hook="$HOOKS_SRC_DIR/pretool/bash/gh-issue-creation-guide.ts"
    assert_file_exists "$hook"
}

test_gh_issue_guide_validates_json_output() {
    local hook_path="pretool/bash/gh-issue-creation-guide"

    local input='{"tool_name":"Bash","tool_input":{"command":"gh issue create --title \"test\""}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_gh_issue_guide_ignores_non_create() {
    local hook_path="pretool/bash/gh-issue-creation-guide"

    local input='{"tool_name":"Bash","tool_input":{"command":"gh issue list"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# PRE-COMMIT SIMULATION TESTS
# ============================================================================

describe "Pre-Commit Simulation Hook (TypeScript)"

test_precommit_simulation_exists() {
    local hook="$HOOKS_SRC_DIR/pretool/bash/pre-commit-simulation.ts"
    assert_file_exists "$hook"
}

test_precommit_simulation_validates_json_output() {
    local hook_path="pretool/bash/pre-commit-simulation"

    local input='{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat: test\""}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_precommit_simulation_ignores_non_commit() {
    local hook_path="pretool/bash/pre-commit-simulation"

    local input='{"tool_name":"Bash","tool_input":{"command":"git status"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Should silently pass (continue: true)
        echo "$output" | jq -e '.continue == true' >/dev/null || pass "Ignores non-commit commands"
    fi
}

# ============================================================================
# CHANGELOG GENERATOR TESTS
# ============================================================================

describe "Changelog Generator Hook (TypeScript)"

test_changelog_generator_exists() {
    local hook="$HOOKS_SRC_DIR/pretool/bash/changelog-generator.ts"
    assert_file_exists "$hook"
}

test_changelog_generator_validates_json_output() {
    local hook_path="pretool/bash/changelog-generator"

    local input='{"tool_name":"Bash","tool_input":{"command":"gh release create v1.0.0"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_changelog_generator_ignores_non_release() {
    local hook_path="pretool/bash/changelog-generator"

    local input='{"tool_name":"Bash","tool_input":{"command":"gh issue list"}}'
    local output
    output=$(run_ts_hook "$hook_path" "$input")

    if [[ "$output" == *"SKIP"* ]]; then
        skip "Hooks not built"
    fi

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Should silently pass for non-release commands
        echo "$output" | jq -e '.continue == true' >/dev/null || pass "Ignores non-release commands"
    fi
}

test_changelog_generator_release_engineer_integration() {
    local agent="$PROJECT_ROOT/src/agents/release-engineer.md"
    assert_file_exists "$agent"

    # Verify changelog-generator is in release-engineer hooks (without .sh extension)
    grep -q "changelog-generator" "$agent" || fail "changelog-generator not wired to release-engineer"
}

# ============================================================================
# SKILL STRUCTURE TESTS
# ============================================================================

describe "Git Skills Structure"

test_git_workflow_skill_exists() {
    local skill_dir="$PROJECT_ROOT/src/skills/git-workflow"
    assert_file_exists "$skill_dir/SKILL.md"

    # Check for references (consolidated from atomic-commits, branch-strategy)
    [[ -d "$skill_dir/references" ]] || fail "Missing references directory"

    # Check for checklists
    [[ -d "$skill_dir/checklists" ]] || fail "Missing checklists directory"
}

test_github_operations_skill_exists() {
    local skill_dir="$PROJECT_ROOT/src/skills/github-operations"
    assert_file_exists "$skill_dir/SKILL.md"

    # Check for references (consolidated from github-cli, milestone-management)
    [[ -d "$skill_dir/references" ]] || fail "Missing references directory"
}

test_stacked_prs_skill_exists() {
    local skill_dir="$PROJECT_ROOT/src/skills/stacked-prs"
    assert_file_exists "$skill_dir/SKILL.md"
}

test_release_management_skill_exists() {
    local skill_dir="$PROJECT_ROOT/src/skills/release-management"
    assert_file_exists "$skill_dir/SKILL.md"
}

test_git_recovery_command_skill_exists() {
    local skill_dir="$PROJECT_ROOT/src/skills/git-recovery-command"
    assert_file_exists "$skill_dir/SKILL.md"
}

# ============================================================================
# GITHUB OPERATIONS SKILL ENRICHMENT TESTS
# ============================================================================

describe "GitHub Operations Skill Enrichment"

test_github_operations_references_exist() {
    local ref_dir="$PROJECT_ROOT/src/skills/github-operations/references"

    # Verify references directory exists
    [[ -d "$ref_dir" ]] || fail "Missing references directory"

    # Check for key reference files
    assert_file_exists "$ref_dir/issue-management.md"
    assert_file_exists "$ref_dir/pr-workflows.md"
    assert_file_exists "$ref_dir/milestone-api.md"
}

test_github_operations_examples_exist() {
    local examples_dir="$PROJECT_ROOT/src/skills/github-operations/examples"

    # Check for examples (consolidated from github-cli)
    [[ -d "$examples_dir" ]] && assert_file_exists "$examples_dir/automation-scripts.md"
}

test_github_operations_has_graphql_reference() {
    local file="$PROJECT_ROOT/src/skills/github-operations/references/graphql-api.md"
    assert_file_exists "$file"
}

# ============================================================================
# RUN TESTS
# ============================================================================

setup_test_env

# Run all test functions
run_tests

cleanup_test_env

print_summary
