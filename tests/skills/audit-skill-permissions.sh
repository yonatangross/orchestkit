#!/usr/bin/env bash
# Automated Skill Permission Audit for CC 2.1.19
# Scans all skills and identifies those needing allowed-tools declarations

set -euo pipefail

SKILLS_DIR="${1:-skills}"
REPORT_FILE="${2:-/tmp/skill-permission-audit.md}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
total_skills=0
user_invocable=0
needs_tools=0
has_tools=0
missing_tools=0

# Arrays for tracking
declare -a skills_needing_update=()
declare -a skills_with_bash=()
declare -a skills_with_write=()

echo -e "${BLUE}=== Skill Permission Audit (CC 2.1.19) ===${NC}"
echo ""

# Start report
cat > "$REPORT_FILE" << 'EOF'
# Skill Permission Audit Report

## Summary

EOF

# Scan each skill
for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    skill_md="$skill_dir/SKILL.md"

    if [[ ! -f "$skill_md" ]]; then
        continue
    fi

    ((total_skills++))

    # Check if user-invocable
    if grep -q "^user-invocable: true" "$skill_md" 2>/dev/null; then
        ((user_invocable++))

        # Check for allowed-tools
        if grep -q "^allowed-tools:" "$skill_md" 2>/dev/null; then
            ((has_tools++))
        else
            # Check if skill has scripts that use dangerous tools
            has_bash=false
            has_write=false

            # Check scripts directory
            if [[ -d "$skill_dir/scripts" ]]; then
                for script in "$skill_dir/scripts"/*; do
                    if [[ -f "$script" ]]; then
                        # Check script content for tool usage patterns
                        if grep -qE "Bash|npm |pip |git |docker " "$script" 2>/dev/null; then
                            has_bash=true
                        fi
                        if grep -qE "Write|Edit|cat.*>" "$script" 2>/dev/null; then
                            has_write=true
                        fi
                    fi
                done
            fi

            # Check SKILL.md for tool usage hints
            if grep -qiE "run.*command|execute|npm|pip|git|docker|bash" "$skill_md" 2>/dev/null; then
                has_bash=true
            fi
            if grep -qiE "create.*file|write.*file|edit.*file|generate.*file" "$skill_md" 2>/dev/null; then
                has_write=true
            fi

            if $has_bash || $has_write; then
                ((needs_tools++))
                skills_needing_update+=("$skill_name")

                if $has_bash; then
                    skills_with_bash+=("$skill_name")
                fi
                if $has_write; then
                    skills_with_write+=("$skill_name")
                fi
            fi
        fi
    fi
done

# Print results
echo -e "${GREEN}Total Skills:${NC} $total_skills"
echo -e "${GREEN}User-Invocable:${NC} $user_invocable"
echo -e "${GREEN}With allowed-tools:${NC} $has_tools"
echo -e "${YELLOW}Needing allowed-tools:${NC} $needs_tools"
echo ""

if [[ ${#skills_needing_update[@]} -gt 0 ]]; then
    echo -e "${YELLOW}Skills needing allowed-tools declarations:${NC}"
    for skill in "${skills_needing_update[@]}"; do
        echo "  - $skill"
    done
    echo ""
fi

# Complete report
cat >> "$REPORT_FILE" << EOF
| Metric | Count |
|--------|-------|
| Total Skills | $total_skills |
| User-Invocable | $user_invocable |
| With allowed-tools | $has_tools |
| Needing allowed-tools | $needs_tools |

## Skills Needing Update

EOF

if [[ ${#skills_needing_update[@]} -gt 0 ]]; then
    for skill in "${skills_needing_update[@]}"; do
        echo "- \`$skill\`" >> "$REPORT_FILE"

        # Add recommended tools
        tools=""
        for bash_skill in "${skills_with_bash[@]}"; do
            if [[ "$bash_skill" == "$skill" ]]; then
                tools="Bash"
                break
            fi
        done
        for write_skill in "${skills_with_write[@]}"; do
            if [[ "$write_skill" == "$skill" ]]; then
                if [[ -n "$tools" ]]; then
                    tools="$tools, Write, Edit"
                else
                    tools="Write, Edit"
                fi
                break
            fi
        done

        if [[ -n "$tools" ]]; then
            echo "  - Recommended: \`allowed-tools: [$tools]\`" >> "$REPORT_FILE"
        fi
    done
else
    echo "All user-invocable skills have proper allowed-tools declarations." >> "$REPORT_FILE"
fi

echo ""
echo -e "${BLUE}Report saved to:${NC} $REPORT_FILE"

# Exit with code indicating if updates needed
if [[ $needs_tools -gt 0 ]]; then
    exit 1
else
    exit 0
fi
