#!/bin/bash
# =============================================================================
# merge-readiness-checker.sh
# Comprehensive merge readiness check for worktree branches
# =============================================================================
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Usage: Call this manually before merging a worktree branch
# ./merge-readiness-checker.sh [target-branch]

TARGET_BRANCH="${1:-main}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [[ "$CURRENT_BRANCH" == "$TARGET_BRANCH" ]]; then
    echo "❌ Error: Already on target branch $TARGET_BRANCH" >&2
    exit 1
fi

echo "🔍 Checking merge readiness: $CURRENT_BRANCH -> $TARGET_BRANCH" >&2
echo "" >&2

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-.}")
cd "$PROJECT_ROOT"

ERRORS=()
WARNINGS=()
PASSES=()

# =============================================================================
# 1. CHECK FOR UNCOMMITTED CHANGES
# =============================================================================

echo "1️⃣  Checking for uncommitted changes..." >&2

UNCOMMITTED=$(git status --short 2>/dev/null || echo "")
if [[ -n "$UNCOMMITTED" ]]; then
    ERRORS+=("Uncommitted changes detected:")
    ERRORS+=("$(echo "$UNCOMMITTED" | head -10)")
    ERRORS+=("")
    if [[ $(echo "$UNCOMMITTED" | wc -l) -gt 10 ]]; then
        ERRORS+=("... and more")
        ERRORS+=("")
    fi
else
    PASSES+=("✅ No uncommitted changes")
fi

# =============================================================================
# 2. CHECK BRANCH DIVERGENCE
# =============================================================================

echo "2️⃣  Checking branch divergence..." >&2

# Fetch latest from remote
git fetch origin "$TARGET_BRANCH" 2>/dev/null || true

AHEAD=$(git rev-list --count "origin/$TARGET_BRANCH".."$CURRENT_BRANCH" 2>/dev/null || echo "0")
BEHIND=$(git rev-list --count "$CURRENT_BRANCH".."origin/$TARGET_BRANCH" 2>/dev/null || echo "0")

echo "   Ahead: $AHEAD commits, Behind: $BEHIND commits" >&2

if [[ $BEHIND -gt 20 ]]; then
    ERRORS+=("Branch is significantly behind $TARGET_BRANCH ($BEHIND commits)")
    ERRORS+=("Rebase or merge $TARGET_BRANCH before proceeding")
    ERRORS+=("")
elif [[ $BEHIND -gt 5 ]]; then
    WARNINGS+=("Branch is behind $TARGET_BRANCH by $BEHIND commits")
    WARNINGS+=("Consider rebasing for easier merge")
    WARNINGS+=("")
else
    PASSES+=("✅ Branch is up to date (behind by $BEHIND)")
fi

# =============================================================================
# 3. CHECK FOR CONFLICTS WITH TARGET BRANCH
# =============================================================================

echo "3️⃣  Checking for merge conflicts..." >&2

# Try merge with --no-commit --no-ff to check for conflicts
MERGE_CHECK=$(git merge --no-commit --no-ff "origin/$TARGET_BRANCH" 2>&1 || echo "CONFLICT")

if echo "$MERGE_CHECK" | grep -q "CONFLICT"; then
    CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
    ERRORS+=("Merge conflicts detected with $TARGET_BRANCH:")
    while IFS= read -r conflict_file; do
        [[ -z "$conflict_file" ]] && continue
        ERRORS+=("  - $conflict_file")
    done <<< "$CONFLICTS"
    ERRORS+=("")
    ERRORS+=("Resolve conflicts before merging")
    ERRORS+=("")
    
    # Abort the merge attempt
    git merge --abort 2>/dev/null || true
else
    PASSES+=("✅ No merge conflicts detected")
    
    # Abort the merge (it was just a check)
    git merge --abort 2>/dev/null || true
fi

# =============================================================================
# 4. RUN ALL QUALITY GATES ON CHANGED FILES
# =============================================================================

echo "4️⃣  Running quality gates on changed files..." >&2

MERGE_BASE=$(git merge-base "$CURRENT_BRANCH" "origin/$TARGET_BRANCH" 2>/dev/null || echo "")
if [[ -z "$MERGE_BASE" ]]; then
    WARNINGS+=("Cannot determine merge base - skipping file checks")
else
    CHANGED_FILES=$(git diff --name-only "$MERGE_BASE" "$CURRENT_BRANCH" 2>/dev/null || echo "")
    FILE_COUNT=$(echo "$CHANGED_FILES" | grep -c . || echo "0")
    
    echo "   Checking $FILE_COUNT changed files..." >&2
    
    GATE_ERRORS=0
    GATE_WARNINGS=0
    
    while IFS= read -r file_path; do
        [[ -z "$file_path" ]] && continue
        [[ ! -f "$file_path" ]] && continue
        [[ ! "$file_path" =~ \.(ts|tsx|js|jsx|py)$ ]] && continue
        
        CONTENT=$(cat "$file_path" 2>/dev/null || echo "")
        [[ -z "$CONTENT" ]] && continue
        
        export TOOL_INPUT_FILE_PATH="$PROJECT_ROOT/$file_path"
        export TOOL_OUTPUT_CONTENT="$CONTENT"
        
        # Run gates
        for gate_hook in \
            "$PROJECT_ROOT/.claude/hooks/skill/duplicate-code-detector.sh" \
            "$PROJECT_ROOT/.claude/hooks/skill/pattern-consistency-enforcer.sh" \
            "$PROJECT_ROOT/.claude/hooks/skill/cross-instance-test-validator.sh"; do
            
            [[ ! -f "$gate_hook" ]] && continue
            
            OUTPUT=$(bash "$gate_hook" 2>&1 || echo "GATE_FAILED")
            
            if echo "$OUTPUT" | grep -q "BLOCKED"; then
                ((GATE_ERRORS++))
            elif echo "$OUTPUT" | grep -q "WARNING"; then
                ((GATE_WARNINGS++))
            fi
        done
    done <<< "$CHANGED_FILES"
    
    if [[ $GATE_ERRORS -gt 0 ]]; then
        ERRORS+=("Quality gates failed on $GATE_ERRORS files")
        ERRORS+=("Run quality gates manually to see details")
        ERRORS+=("")
    elif [[ $GATE_WARNINGS -gt 0 ]]; then
        WARNINGS+=("Quality gate warnings on $GATE_WARNINGS files")
        WARNINGS+=("Review warnings before merging")
        WARNINGS+=("")
    else
        PASSES+=("✅ All quality gates passed")
    fi
fi

# =============================================================================
# 5. CHECK TEST SUITE
# =============================================================================

echo "5️⃣  Checking test suite..." >&2

# Try to run tests
if [[ -f "package.json" ]] && grep -q "\"test\":" "package.json"; then
    echo "   Running npm test..." >&2
    if npm test -- --passWithNoTests 2>&1 | tail -20; then
        PASSES+=("✅ Frontend tests passed")
    else
        ERRORS+=("Frontend tests failed")
        ERRORS+=("Run 'npm test' to see details")
        ERRORS+=("")
    fi
fi

if [[ -f "pytest.ini" ]] || [[ -f "pyproject.toml" ]]; then
    echo "   Running pytest..." >&2
    if pytest --tb=short 2>&1 | tail -20; then
        PASSES+=("✅ Backend tests passed")
    else
        ERRORS+=("Backend tests failed")
        ERRORS+=("Run 'pytest' to see details")
        ERRORS+=("")
    fi
fi

# =============================================================================
# 6. CHECK LINTING
# =============================================================================

echo "6️⃣  Checking linting..." >&2

if [[ -f "package.json" ]] && grep -q "\"lint\":" "package.json"; then
    echo "   Running npm run lint..." >&2
    if npm run lint 2>&1 | tail -10; then
        PASSES+=("✅ Frontend linting passed")
    else
        ERRORS+=("Frontend linting failed")
        ERRORS+=("Run 'npm run lint' to see details")
        ERRORS+=("")
    fi
fi

if command -v ruff >/dev/null 2>&1; then
    echo "   Running ruff..." >&2
    if ruff check . 2>&1 | tail -10; then
        PASSES+=("✅ Backend linting passed")
    else
        ERRORS+=("Backend linting failed")
        ERRORS+=("Run 'ruff check .' to see details")
        ERRORS+=("")
    fi
fi

# =============================================================================
# 7. CHECK TYPE CHECKING
# =============================================================================

echo "7️⃣  Checking type checking..." >&2

if [[ -f "tsconfig.json" ]]; then
    echo "   Running tsc --noEmit..." >&2
    if npx tsc --noEmit 2>&1 | tail -10; then
        PASSES+=("✅ TypeScript type checking passed")
    else
        ERRORS+=("TypeScript type checking failed")
        ERRORS+=("Run 'npx tsc --noEmit' to see details")
        ERRORS+=("")
    fi
fi

if command -v mypy >/dev/null 2>&1; then
    echo "   Running mypy..." >&2
    if mypy . 2>&1 | tail -10; then
        PASSES+=("✅ Python type checking passed")
    else
        ERRORS+=("Python type checking failed")
        ERRORS+=("Run 'mypy .' to see details")
        ERRORS+=("")
    fi
fi

# =============================================================================
# 8. CHECK FOR CONCURRENT WORKTREE MODIFICATIONS
# =============================================================================

echo "8️⃣  Checking for worktree conflicts..." >&2

if git worktree list >/dev/null 2>&1; then
    WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | awk '{print $2}' || true)
    CURRENT_WORKTREE=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
    
    CONCURRENT_FILES=()
    
    if [[ -n "$MERGE_BASE" ]]; then
        CHANGED_FILES=$(git diff --name-only "$MERGE_BASE" "$CURRENT_BRANCH" 2>/dev/null || echo "")
        
        while IFS= read -r file_path; do
            [[ -z "$file_path" ]] && continue
            
            while IFS= read -r worktree; do
                [[ -z "$worktree" ]] && continue
                [[ "$worktree" == "$CURRENT_WORKTREE" ]] && continue
                
                if [[ -f "$worktree/$file_path" ]]; then
                    if (cd "$worktree" && git status --short "$file_path" 2>/dev/null | grep -qE "^.M|^M."); then
                        WORKTREE_BRANCH=$(cd "$worktree" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
                        CONCURRENT_FILES+=("$file_path (branch: $WORKTREE_BRANCH)")
                    fi
                fi
            done <<< "$WORKTREES"
        done <<< "$CHANGED_FILES"
    fi
    
    if [[ ${#CONCURRENT_FILES[@]} -gt 0 ]]; then
        WARNINGS+=("Files modified in other worktrees:")
        for file in "${CONCURRENT_FILES[@]}"; do
            WARNINGS+=("  - $file")
        done
        WARNINGS+=("Coordinate before merging")
        WARNINGS+=("")
    else
        PASSES+=("✅ No concurrent worktree modifications")
    fi
fi

# =============================================================================
# 9. GENERATE MERGE READINESS REPORT
# =============================================================================

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
echo "📊 MERGE READINESS REPORT" >&2
echo "" >&2
echo "Branch: $CURRENT_BRANCH -> $TARGET_BRANCH" >&2
echo "" >&2

if [[ ${#PASSES[@]} -gt 0 ]]; then
    echo "✅ PASSED CHECKS:" >&2
    for pass in "${PASSES[@]}"; do
        echo "   $pass" >&2
    done
    echo "" >&2
fi

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo "⚠️  WARNINGS:" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "   $warning" >&2
    done
    echo "" >&2
fi

if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "❌ BLOCKERS:" >&2
    for error in "${ERRORS[@]}"; do
        echo "   $error" >&2
    done
    echo "" >&2
    echo "🚫 MERGE NOT READY - Fix blockers before merging" >&2
    echo "" >&2
    exit 1
fi

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo "⚠️  MERGE READY WITH WARNINGS" >&2
    echo "" >&2
    echo "Review warnings before proceeding with merge" >&2
    echo "" >&2
    exit 0
fi

echo "✅ MERGE READY - All checks passed!" >&2
echo "" >&2
echo "You can safely merge this branch" >&2
echo "" >&2

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
