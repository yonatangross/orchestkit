#!/usr/bin/env bash
# ============================================================================
# Static Analysis / Lint Suite
# ============================================================================
# Runs all static analysis checks:
# - JSON validity and schema validation
# - Shell script linting (shellcheck)
# - Structure validation (CC 2.1.7 flat skills)
# - Cross-reference validation (agent → skill refs via frontmatter)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Static Analysis Suite (CC 2.1.7)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# 1. JSON Validity
# ============================================================================
echo "▶ JSON Validity"
echo "────────────────────────────────────────"

json_errors=0
# Discover project-critical JSON files via pattern scan.
# Excludes .claude/ (runtime coordination data) and node_modules/.
CRITICAL_JSON_FILES=()
# Explicit top-level files
for f in "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/src/hooks/hooks.json"; do
    [ -f "$f" ] && CRITICAL_JSON_FILES+=("$f")
done
# Pattern scan: manifests/ and all .claude-plugin/ directories
for dir in "$PROJECT_ROOT/manifests" "$PROJECT_ROOT/.claude-plugin"; do
    if [ -d "$dir" ]; then
        while IFS= read -r -d '' file; do
            CRITICAL_JSON_FILES+=("$file")
        done < <(find "$dir" -name "*.json" -print0 2>/dev/null)
    fi
done
# Scan plugins/ .claude-plugin dirs (but not .claude/ runtime data or node_modules/)
while IFS= read -r -d '' file; do
    CRITICAL_JSON_FILES+=("$file")
done < <(find "$PROJECT_ROOT/plugins" -path '*/.claude-plugin/*.json' \
    ! -path '*/.claude/*' ! -path '*/node_modules/*' -print0 2>/dev/null)

for file in "${CRITICAL_JSON_FILES[@]}"; do
    if [ -f "$file" ]; then
        if ! jq empty "$file" 2>/dev/null; then
            fail "Invalid JSON: $file"
            ((json_errors++)) || true
        fi
    fi
done

if [ "$json_errors" -eq 0 ]; then
    pass "All JSON files are valid"
else
    fail "$json_errors JSON files have errors"
fi

echo ""

# ============================================================================
# 2. Shell Script Linting (shellcheck)
# ============================================================================
echo "▶ Shell Script Linting"
echo "────────────────────────────────────────"

if command -v shellcheck &>/dev/null; then
    shell_errors=0
    shell_warnings=0

    while IFS= read -r -d '' file; do
        # Run shellcheck with specific exclusions for our patterns
        result=$(shellcheck -f gcc -e SC1090,SC1091,SC2034,SC2155 "$file" 2>&1 || true)

        if echo "$result" | grep -q ":error:"; then
            fail "Shellcheck errors in: $(basename "$file")"
            ((shell_errors++)) || true
        elif echo "$result" | grep -q ":warning:"; then
            # Warnings are acceptable but noted
            ((shell_warnings++)) || true
        fi
    done < <(find "$PROJECT_ROOT/src/hooks" -name "*.sh" -print0 2>/dev/null)

    if [ "$shell_errors" -eq 0 ]; then
        pass "All shell scripts pass shellcheck"
        if [ "$shell_warnings" -gt 0 ]; then
            info "$shell_warnings warnings (non-blocking)"
        fi
    else
        fail "$shell_errors shell scripts have errors"
    fi
else
    warn "shellcheck not installed, skipping shell lint"
fi

echo ""

# ============================================================================
# 3. Skill Structure Validation (CC 2.1.7 Flat)
# ============================================================================
echo "▶ Skill Structure Validation (CC 2.1.7 Flat)"
echo "────────────────────────────────────────"

incomplete_skills=0
complete_skills=0

# CC 2.1.7 flat structure: skills/<skill-name>/SKILL.md
for skill_dir in "$PROJECT_ROOT/src/skills"/*; do
    if [ -d "$skill_dir" ]; then
        skill_name=$(basename "$skill_dir")
        # Skip utility directories (not skills)
        [ "$skill_name" = "shared" ] && continue

        # CC 2.1.7 only requires SKILL.md
        if [ -f "$skill_dir/SKILL.md" ]; then
            ((complete_skills++)) || true
        else
            fail "$skill_name missing: SKILL.md"
            ((incomplete_skills++)) || true
        fi
    fi
done

if [ "$incomplete_skills" -eq 0 ]; then
    pass "All $complete_skills src/skills have SKILL.md (CC 2.1.7 compliant)"
else
    fail "$incomplete_skills src/skills missing SKILL.md"
fi

echo ""

# ============================================================================
# 4. Agent Frontmatter Validation (CC 2.1.6)
# ============================================================================
echo "▶ Agent Frontmatter Validation (CC 2.1.6)"
echo "────────────────────────────────────────"

agent_errors=0
agent_count=0

for agent_file in "$PROJECT_ROOT/src/agents"/*.md; do
    if [ -f "$agent_file" ]; then
        agent_name=$(basename "$agent_file" .md)

        # Skip non-agent docs in src/agents/
        case "$agent_name" in
            README|INDEX|CONTRIBUTING) continue ;;
        esac

        ((agent_count++)) || true

        # Check for CC 2.1.6 required fields
        if ! head -50 "$agent_file" | grep -q "^model:"; then
            fail "$agent_name missing 'model:' field"
            ((agent_errors++)) || true
        fi

        if ! head -50 "$agent_file" | grep -q "^skills:"; then
            warn "$agent_name missing 'skills:' array (CC 2.1.6)"
        fi

        if ! head -50 "$agent_file" | grep -q "^tools:"; then
            fail "$agent_name missing 'tools:' array"
            ((agent_errors++)) || true
        fi
    fi
done

if [ "$agent_errors" -eq 0 ]; then
    pass "All $agent_count agents have valid CC 2.1.6 frontmatter"
else
    fail "$agent_errors agents have frontmatter errors"
fi

echo ""

# ============================================================================
# 5. Frontmatter Hook Completeness
# ============================================================================
# Every hook entry in agent/skill frontmatter must have both a matcher: and
# a command: line. A matcher without a command (or vice versa) is a silent
# misconfiguration — the hook simply won't fire.
echo "▶ Frontmatter Hook Completeness"
echo "────────────────────────────────────────"

hook_incomplete=0
hook_checked=0

# Check agents
for agent_file in "$PROJECT_ROOT/src/agents"/*.md; do
    if [ -f "$agent_file" ]; then
        agent_name=$(basename "$agent_file" .md)

        # Skip non-agent docs
        case "$agent_name" in
            README|INDEX|CONTRIBUTING) continue ;;
        esac

        # Extract YAML frontmatter (between first pair of --- markers)
        frontmatter=$(awk '/^---$/{if(++c==2) exit; next} c==1{print}' "$agent_file")

        # Only check files that have a hooks: section
        if echo "$frontmatter" | grep -q "^hooks:"; then
            ((hook_checked++)) || true
            matcher_count=$(echo "$frontmatter" | grep -c "matcher:" || true)
            command_count=$(echo "$frontmatter" | grep -c "command:" || true)

            if [ "$matcher_count" -ne "$command_count" ]; then
                fail "Agent $agent_name: matcher count ($matcher_count) != command count ($command_count)"
                ((hook_incomplete++)) || true
            fi
        fi
    fi
done

# Check skills
while IFS= read -r -d '' skill_file; do
    skill_name=$(basename "$(dirname "$skill_file")")
    frontmatter=$(awk '/^---$/{if(++c==2) exit; next} c==1{print}' "$skill_file")

    if echo "$frontmatter" | grep -q "^hooks:"; then
        ((hook_checked++)) || true
        matcher_count=$(echo "$frontmatter" | grep -c "matcher:" || true)
        command_count=$(echo "$frontmatter" | grep -c "command:" || true)

        if [ "$matcher_count" -ne "$command_count" ]; then
            fail "Skill $skill_name: matcher count ($matcher_count) != command count ($command_count)"
            ((hook_incomplete++)) || true
        fi
    fi
done < <(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f -print0 2>/dev/null)

if [ "$hook_incomplete" -eq 0 ]; then
    pass "All $hook_checked frontmatter hook sections have matching matcher/command pairs"
else
    fail "$hook_incomplete frontmatter hook sections are incomplete"
fi

echo ""

# ============================================================================
# 6. Workflow Claude Model IDs (#3071)
# ============================================================================
# claude-health.yml pinned `claude-sonnet-4-5-20250514` for 40 consecutive
# nights. That ID never existed (Sonnet 4.5 is -20250929; -20250514 belongs
# to Sonnet 4), so the API answered 404 not_found_error and the job died in
# ~2.5s every night writing nothing. A typo'd model ID is indistinguishable
# from a valid one until runtime — this makes it a commit-time failure.
echo -e "${BLUE}6. Workflow Claude Model IDs${NC}"

MODEL_ALLOWLIST="$SCRIPT_DIR/claude-model-ids.txt"
WORKFLOW_DIR="$PROJECT_ROOT/.github/workflows"

if [ ! -f "$MODEL_ALLOWLIST" ]; then
    fail "Model-ID allowlist missing: tests/ci/claude-model-ids.txt"
elif [ ! -d "$WORKFLOW_DIR" ]; then
    warn "No .github/workflows directory to scan for model IDs"
else
    # Two pin shapes exist: `--model <id>` (raw `claude -p`) and
    # `claude_args: "... --model <id>"` (anthropics/claude-code-action); a
    # bare `model: <id>` YAML key is matched too. src/agents use aliases
    # (opus|sonnet|haiku|inherit), which the claude-* pattern ignores by design.
    model_pins=$(grep -rhoE -- "(--model|model:)[[:space:]]+claude-[a-z0-9.-]+" "$WORKFLOW_DIR" \
                 | sed -E 's/^(--model|model:)[[:space:]]+//' \
                 | sort -u || true)  # silent: known-noise — no pinned models is a valid state

    model_checked=0
    model_bad=0

    while IFS= read -r model_id; do
        [ -n "$model_id" ] || continue
        model_checked=$((model_checked + 1))

        # Anchored so `claude-sonnet-4-5` cannot be satisfied by the longer
        # `claude-sonnet-4-5-20250929` entry, and so comment lines never match.
        allow_line=$(grep -E "^[[:space:]]*${model_id}([[:space:]]|#|\$)" "$MODEL_ALLOWLIST" || true)  # silent: known-noise — absent = the failure we report
        pinned_in=$(grep -rl -- "$model_id" "$WORKFLOW_DIR" | head -1 || true)  # silent: known-noise — attribution only
        where=$(basename "${pinned_in:-workflow}")

        if [ -z "$allow_line" ]; then
            fail "$where pins unknown model ID '$model_id' — the API answers 404 not_found_error at runtime. If this model is genuinely new, add it to tests/ci/claude-model-ids.txt in the same commit."
            model_bad=$((model_bad + 1))
        # here-string, not a pipe: `printf | grep -q` SIGPIPEs the producer
        # under `set -o pipefail` and flips this branch non-deterministically.
        elif grep -q "DEPRECATED" <<<"$allow_line"; then
            note=$(sed 's/.*#[[:space:]]*//' <<<"$allow_line")
            warn "$where pins '$model_id' — $note"
        fi
    done <<< "$model_pins"

    if [ "$model_checked" -eq 0 ]; then
        warn "No pinned Claude model IDs found in .github/workflows — the match pattern may need updating"
    elif [ "$model_bad" -eq 0 ]; then
        pass "All $model_checked pinned workflow model ID(s) are servable"
    fi
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0