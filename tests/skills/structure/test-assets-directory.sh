#!/usr/bin/env bash
# ============================================================================
# Assets Directory Validation Tests
# ============================================================================
# Validates that assets/ folders are properly structured and referenced.
#
# Tests:
# 1. Skills with assets/ have valid structure
# 2. Files in assets/ are referenced in SKILL.md
# 3. No broken references to assets/ files
# 4. Assets/ contains only template/copyable files (not executable scripts)
# 5. Template files have appropriate naming (e.g., *-template.*)
#
# Usage: ./test-assets-directory.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/skills"

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' NC=''
fi

# Test output functions
pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    ((PASS_COUNT++)) || true
}

fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    ((FAIL_COUNT++)) || true
}

warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
    ((WARN_COUNT++)) || true
}

info() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo -e "  ${BLUE}INFO${NC} $1"
    fi
}

# ============================================================================
# Header
# ============================================================================
echo "============================================================================"
echo "  Assets Directory Validation Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test 1: Skills with assets/ have valid structure
# ============================================================================
echo -e "${CYAN}Test 1: Assets Directory Structure${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

ASSETS_DIRS=()
SKILLS_WITH_ASSETS=0

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -d "$skill_dir/assets" ]]; then
        skill_name=$(basename "$skill_dir")
        ASSETS_DIRS+=("$skill_name")
        ((SKILLS_WITH_ASSETS++)) || true
        
        # Check if assets/ is empty
        if [[ -z "$(ls -A "$skill_dir/assets" 2>/dev/null)" ]]; then
            warn "$skill_name: assets/ directory is empty"
        else
            info "$skill_name: Has assets/ directory with files"
        fi
    fi
done

if [[ $SKILLS_WITH_ASSETS -gt 0 ]]; then
    pass "$SKILLS_WITH_ASSETS skill(s) have assets/ directory"
else
    warn "No skills with assets/ directories found (this is OK if no templates exist)"
fi
echo ""

# ============================================================================
# Test 2: Files in assets/ are referenced in SKILL.md
# ============================================================================
echo -e "${CYAN}Test 2: Assets Referenced in SKILL.md${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

UNREFERENCED_ASSETS=()
MISSING_DOCS=0

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir" ]] && [[ -d "$skill_dir/assets" ]] && [[ -f "$skill_dir/SKILL.md" ]]; then
        skill_name=$(basename "$skill_dir")
        skill_file="$skill_dir/SKILL.md"
        assets_dir="$skill_dir/assets"
        
        # Check if SKILL.md mentions assets/ or Bundled Resources
        has_assets_ref=false
        has_bundled_resources=false
        
        if grep -qiE '(assets/|Bundled Resources)' "$skill_file" 2>/dev/null; then
            has_assets_ref=true
        fi
        
        if grep -qiE 'Bundled Resources' "$skill_file" 2>/dev/null; then
            has_bundled_resources=true
        fi
        
        # Check each file in assets/
        while IFS= read -r asset_file; do
            asset_name=$(basename "$asset_file")
            asset_rel_path="assets/$asset_name"
            
            # Check if referenced in SKILL.md
            if ! grep -qE "(assets/$asset_name|$asset_name)" "$skill_file" 2>/dev/null; then
                UNREFERENCED_ASSETS+=("$skill_name: $asset_rel_path")
            fi
        done < <(find "$assets_dir" -type f 2>/dev/null)
        
        # Check if skill has assets but no Bundled Resources section
        # Also check for "Available Scripts" or other sections that might document assets
        has_any_docs=false
        if grep -qiE '(Bundled Resources|Available Scripts|assets/)' "$skill_file" 2>/dev/null; then
            has_any_docs=true
        fi
        
        if [[ -n "$(ls -A "$assets_dir" 2>/dev/null)" ]] && [[ "$has_bundled_resources" == "false" ]] && [[ "$has_any_docs" == "false" ]]; then
            ((MISSING_DOCS++)) || true
            warn "$skill_name: Has assets/ but no 'Bundled Resources' section in SKILL.md"
        fi
    fi
done

if [[ ${#UNREFERENCED_ASSETS[@]} -eq 0 ]]; then
    pass "All assets/ files are referenced in SKILL.md"
else
    fail "${#UNREFERENCED_ASSETS[@]} asset file(s) not referenced in SKILL.md:"
    for ref in "${UNREFERENCED_ASSETS[@]}"; do
        echo "    - $ref"
    done
fi
echo ""

# ============================================================================
# Test 3: No broken references to assets/ files
# ============================================================================
echo -e "${CYAN}Test 3: No Broken References to assets/${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

BROKEN_REFS=()

# Find all markdown files that reference assets/
while IFS= read -r md_file; do
    skill_dir=$(dirname "$md_file")
    skill_name=$(basename "$skill_dir")
    
    # Determine the skill root (parent of references/, examples/, etc.)
    if [[ "$skill_dir" =~ /(references|examples|checklists)$ ]]; then
        skill_root=$(dirname "$skill_dir")
    else
        skill_root="$skill_dir"
    fi
    
    # Extract asset references from markdown (more precise matching)
    while IFS= read -r ref_line; do
        # Match markdown links: [text](assets/file.ext) or `assets/file.ext` or `../assets/file.ext`
        # Match code blocks: assets/file.ext or ../assets/file.ext
        asset_path=$(echo "$ref_line" | grep -oE '(\.\./)?assets/[a-zA-Z0-9_-]+\.(ts|tsx|py|md|yaml|yml|json|html|css|js)' | head -1 || true)
        
        if [[ -n "$asset_path" ]]; then
            # Resolve relative path
            if [[ "$asset_path" =~ ^\.\./ ]]; then
                # Relative path from subdirectory
                full_path="$skill_root/${asset_path#../}"
            else
                # Absolute path from skill root
                full_path="$skill_root/$asset_path"
            fi
            
            if [[ ! -f "$full_path" ]]; then
                BROKEN_REFS+=("$md_file: $asset_path")
            fi
        fi
    done < <(grep -E '`(\.\./)?assets/[^`]+`|\[.*\]\((\.\./)?assets/[^)]+\)|(\.\./)?assets/[a-zA-Z0-9_-]+\.(ts|tsx|py|md|yaml|yml|json)' "$md_file" 2>/dev/null || true)
done < <(find "$SKILLS_DIR" -name "*.md" -type f 2>/dev/null)

if [[ ${#BROKEN_REFS[@]} -eq 0 ]]; then
    pass "No broken references to assets/ files"
else
    fail "${#BROKEN_REFS[@]} broken reference(s) to assets/ files:"
    for ref in "${BROKEN_REFS[@]}"; do
        echo "    - $ref"
    done
fi
echo ""

# ============================================================================
# Test 4: Assets/ contains only template/copyable files
# ============================================================================
echo -e "${CYAN}Test 4: Assets Contains Only Templates/Copyable Files${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

EXECUTABLE_IN_ASSETS=()
SCRIPT_LIKE_IN_ASSETS=()

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir/assets" ]]; then
        skill_name=$(basename "$skill_dir")
        assets_dir="$skill_dir/assets"
        
        # Check for executable files
        while IFS= read -r asset_file; do
            if [[ -x "$asset_file" ]]; then
                EXECUTABLE_IN_ASSETS+=("$skill_name: $(basename "$asset_file")")
            fi
            
            # Check for files that look like scripts (shebang, .sh, .py without -template)
            if [[ "$asset_file" =~ \.(sh|py)$ ]] && [[ ! "$asset_file" =~ template ]]; then
                # Check for shebang
                if head -1 "$asset_file" 2>/dev/null | grep -qE '^#!'; then
                    SCRIPT_LIKE_IN_ASSETS+=("$skill_name: $(basename "$asset_file")")
                fi
            fi
        done < <(find "$assets_dir" -type f 2>/dev/null)
    fi
done

if [[ ${#EXECUTABLE_IN_ASSETS[@]} -eq 0 ]] && [[ ${#SCRIPT_LIKE_IN_ASSETS[@]} -eq 0 ]]; then
    pass "Assets/ contains only template/copyable files (no executables)"
else
    if [[ ${#EXECUTABLE_IN_ASSETS[@]} -gt 0 ]]; then
        warn "${#EXECUTABLE_IN_ASSETS[@]} executable file(s) in assets/ (should be in scripts/):"
        for exe in "${EXECUTABLE_IN_ASSETS[@]}"; do
            echo "    - $exe"
        done
    fi
    if [[ ${#SCRIPT_LIKE_IN_ASSETS[@]} -gt 0 ]]; then
        warn "${#SCRIPT_LIKE_IN_ASSETS[@]} script-like file(s) in assets/ (consider moving to scripts/):"
        for script in "${SCRIPT_LIKE_IN_ASSETS[@]}"; do
            echo "    - $script"
        done
    fi
fi
echo ""

# ============================================================================
# Test 5: Template files have appropriate naming
# ============================================================================
echo -e "${CYAN}Test 5: Template File Naming${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

BADLY_NAMED_TEMPLATES=()

for skill_dir in "$SKILLS_DIR"/*/; do
    if [[ -d "$skill_dir/assets" ]]; then
        skill_name=$(basename "$skill_dir")
        assets_dir="$skill_dir/assets"
        
        # Check files that are clearly templates but don't have -template in name
        while IFS= read -r asset_file; do
            asset_name=$(basename "$asset_file")
            
            # If file contains "template" in content but not in filename, warn
            if grep -qiE 'template|boilerplate|starter' "$asset_file" 2>/dev/null; then
                if [[ ! "$asset_name" =~ template|boilerplate|starter ]]; then
                    BADLY_NAMED_TEMPLATES+=("$skill_name: $asset_name")
                fi
            fi
        done < <(find "$assets_dir" -type f -name "*.md" -o -name "*.tsx" -o -name "*.ts" -o -name "*.py" -o -name "*.yaml" -o -name "*.json" 2>/dev/null)
    fi
done

if [[ ${#BADLY_NAMED_TEMPLATES[@]} -eq 0 ]]; then
    pass "Template files have appropriate naming"
else
    warn "${#BADLY_NAMED_TEMPLATES[@]} template file(s) may benefit from -template suffix:"
    for named in "${BADLY_NAMED_TEMPLATES[@]}"; do
        echo "    - $named"
    done
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All assets directory tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
