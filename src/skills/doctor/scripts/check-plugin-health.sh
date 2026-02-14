#!/bin/bash
# Check Plugin Health
# Validates OrchestKit plugin ecosystem: manifests, skills, hooks, and build output.
#
# Usage: ./check-plugin-health.sh [OPTIONS]
#
# Options:
#   --json    Output results as JSON
#   --help    Show this help message
#
# Exit codes:
#   0 = all checks pass
#   1 = one or more checks failed
#   2 = usage error (not in repo root)

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

OUTPUT_FORMAT="table"
PROJECT_ROOT=""

# Detect project root (walk up to find manifests/)
find_project_root() {
    local dir
    dir=$(pwd)
    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/manifests" && -d "$dir/src/skills" ]]; then
            echo "$dir"
            return 0
        fi
        dir=$(dirname "$dir")
    done
    return 1
}

# =============================================================================
# ARGUMENT PARSING
# =============================================================================

while [[ $# -gt 0 ]]; do
    case "$1" in
        --json)
            OUTPUT_FORMAT="json"
            shift
            ;;
        --help|-h)
            echo "Check Plugin Health"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --json    Output results as JSON"
            echo "  --help    Show this help message"
            echo ""
            echo "Checks:"
            echo "  1. plugins/ directory populated"
            echo "  2. Manifest files are valid JSON"
            echo "  3. Skill count matches manifest expectations"
            echo "  4. Hook dist/ compiled output exists"
            echo "  5. Agent definitions present"
            echo ""
            echo "Exit codes:"
            echo "  0 = all healthy"
            echo "  1 = issues found"
            echo "  2 = usage error"
            exit 0
            ;;
        *)
            echo "Error: Unknown option '$1'. Use --help for usage." >&2
            exit 2
            ;;
    esac
done

# =============================================================================
# DETECT PROJECT ROOT
# =============================================================================

PROJECT_ROOT=$(find_project_root) || {
    echo "Error: Could not find OrchestKit project root (manifests/ + src/skills/)." >&2
    echo "Run this script from within the OrchestKit repository." >&2
    exit 2
}

# =============================================================================
# HEALTH CHECKS
# =============================================================================

declare -a CHECK_NAMES=()
declare -a CHECK_STATUSES=()
declare -a CHECK_DETAILS=()

add_result() {
    CHECK_NAMES+=("$1")
    CHECK_STATUSES+=("$2")
    CHECK_DETAILS+=("$3")
}

OVERALL_STATUS=0

# --- Check 1: plugins/ directory populated ---
if [[ -d "$PROJECT_ROOT/plugins" ]]; then
    plugin_count=$(find "$PROJECT_ROOT/plugins" -name "*.md" -o -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$plugin_count" -gt 0 ]]; then
        add_result "plugins/ populated" "OK" "$plugin_count files found"
    else
        add_result "plugins/ populated" "FAIL" "Directory exists but is empty (run npm run build)"
        OVERALL_STATUS=1
    fi
else
    add_result "plugins/ populated" "FAIL" "Directory missing (run npm run build)"
    OVERALL_STATUS=1
fi

# --- Check 2: Manifest files valid JSON ---
manifest_ok=0
manifest_fail=0
manifest_errors=""
for manifest in "$PROJECT_ROOT"/manifests/*.json; do
    if [[ -f "$manifest" ]]; then
        manifest_name=$(basename "$manifest")
        if python3 -c "import json; json.load(open('$manifest'))" 2>/dev/null; then
            manifest_ok=$((manifest_ok + 1))
        else
            manifest_fail=$((manifest_fail + 1))
            manifest_errors="${manifest_errors}${manifest_name}, "
            OVERALL_STATUS=1
        fi
    fi
done

if [[ $manifest_fail -eq 0 ]]; then
    add_result "Manifests valid JSON" "OK" "$manifest_ok manifest(s) validated"
else
    add_result "Manifests valid JSON" "FAIL" "Invalid: ${manifest_errors%, }"
fi

# --- Check 3: Skill count matches manifest ---
src_skill_count=$(find "$PROJECT_ROOT/src/skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

# Check ork.json skill count
if [[ -f "$PROJECT_ROOT/manifests/ork.json" ]]; then
    manifest_skill_count=$(python3 -c "
import json, sys
with open('$PROJECT_ROOT/manifests/ork.json') as f:
    data = json.load(f)
skills = data.get('skills', [])
print(len(skills))
" 2>/dev/null || echo "0")

    if [[ "$src_skill_count" -eq "$manifest_skill_count" ]]; then
        add_result "Skill count (ork)" "OK" "$src_skill_count skills in src/ match $manifest_skill_count in manifest"
    else
        add_result "Skill count (ork)" "WARN" "src/ has $src_skill_count skills, ork.json lists $manifest_skill_count"
    fi
else
    add_result "Skill count (ork)" "FAIL" "manifests/ork.json not found"
    OVERALL_STATUS=1
fi

# --- Check 4: Hooks compiled ---
if [[ -d "$PROJECT_ROOT/src/hooks" ]]; then
    if [[ -d "$PROJECT_ROOT/src/hooks/dist" ]]; then
        hook_files=$(find "$PROJECT_ROOT/src/hooks/dist" -name "*.js" -o -name "*.mjs" 2>/dev/null | wc -l | tr -d ' ')
        if [[ "$hook_files" -gt 0 ]]; then
            add_result "Hooks compiled" "OK" "$hook_files compiled files in dist/"
        else
            add_result "Hooks compiled" "WARN" "dist/ exists but no compiled files found"
        fi
    else
        add_result "Hooks compiled" "WARN" "src/hooks/dist/ not found (run: cd src/hooks && npm run build)"
    fi

    if [[ -f "$PROJECT_ROOT/src/hooks/hooks.json" ]]; then
        hook_count=$(python3 -c "
import json
with open('$PROJECT_ROOT/src/hooks/hooks.json') as f:
    data = json.load(f)
print(len(data.get('hooks', data) if isinstance(data, dict) else data))
" 2>/dev/null || echo "?")
        add_result "hooks.json entries" "OK" "$hook_count hook entries"
    else
        add_result "hooks.json entries" "WARN" "hooks.json not found"
    fi
else
    add_result "Hooks directory" "WARN" "src/hooks/ not found"
fi

# --- Check 5: Agent definitions ---
if [[ -d "$PROJECT_ROOT/src/agents" ]]; then
    agent_count=$(find "$PROJECT_ROOT/src/agents" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$agent_count" -gt 0 ]]; then
        add_result "Agent definitions" "OK" "$agent_count agents found"
    else
        add_result "Agent definitions" "WARN" "No agent .md files found"
    fi
else
    add_result "Agent definitions" "FAIL" "src/agents/ not found"
    OVERALL_STATUS=1
fi

# =============================================================================
# OUTPUT
# =============================================================================

if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    echo "{"
    echo "  \"status\": \"$(if [[ $OVERALL_STATUS -eq 0 ]]; then echo "healthy"; else echo "unhealthy"; fi)\","
    echo "  \"checks\": ["
    for i in "${!CHECK_NAMES[@]}"; do
        comma=""
        if [[ $i -lt $((${#CHECK_NAMES[@]} - 1)) ]]; then
            comma=","
        fi
        echo "    {\"component\": \"${CHECK_NAMES[$i]}\", \"status\": \"${CHECK_STATUSES[$i]}\", \"details\": \"${CHECK_DETAILS[$i]}\"}${comma}"
    done
    echo "  ]"
    echo "}"
else
    echo "============================================================================"
    echo "  OrchestKit Plugin Health Check"
    echo "============================================================================"
    echo ""
    printf "%-30s %-8s %s\n" "Component" "Status" "Details"
    echo "----------------------------------------------------------------------------"

    for i in "${!CHECK_NAMES[@]}"; do
        status="${CHECK_STATUSES[$i]}"
        # Color output if terminal supports it
        if [[ -t 1 ]]; then
            case "$status" in
                OK)   status=$'\033[0;32mOK\033[0m    ' ;;
                WARN) status=$'\033[1;33mWARN\033[0m  ' ;;
                FAIL) status=$'\033[0;31mFAIL\033[0m  ' ;;
            esac
        fi
        printf "%-30s %-8s %s\n" "${CHECK_NAMES[$i]}" "$status" "${CHECK_DETAILS[$i]}"
    done

    echo ""
    echo "============================================================================"

    if [[ $OVERALL_STATUS -eq 0 ]]; then
        echo "  All checks passed"
    else
        echo "  Issues found - review above"
    fi
    echo "============================================================================"
fi

exit $OVERALL_STATUS
