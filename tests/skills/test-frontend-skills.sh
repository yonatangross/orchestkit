#!/usr/bin/env bash
# Test suite for new frontend skills (lazy-loading-patterns, view-transitions, etc.)
# Validates SKILL.md structure, references, and templates

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/skills"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

# New frontend skills to test
FRONTEND_SKILLS=(
  "lazy-loading-patterns"
  "view-transitions"
  "scroll-driven-animations"
  "responsive-patterns"
  "pwa-patterns"
  "recharts-patterns"
  "dashboard-patterns"
)

log_pass() { echo -e "${GREEN}✓${NC} $1"; PASSED=$((PASSED + 1)); }
log_fail() { echo -e "${RED}✗${NC} $1"; FAILED=$((FAILED + 1)); }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

echo "=========================================="
echo "Frontend Skills Test Suite"
echo "=========================================="
echo ""

# Test 1: All skills exist
echo "Test 1: Skill directories exist"
for skill in "${FRONTEND_SKILLS[@]}"; do
  if [[ -d "$SKILLS_DIR/$skill" ]]; then
    log_pass "$skill directory exists"
  else
    log_fail "$skill directory missing"
  fi
done
echo ""

# Test 2: SKILL.md exists with required frontmatter
echo "Test 2: SKILL.md with valid frontmatter"
for skill in "${FRONTEND_SKILLS[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    # Check for required frontmatter fields
    if grep -q "^name:" "$skill_file" && \
       grep -q "^description:" "$skill_file" && \
       grep -q "^tags:" "$skill_file"; then
      log_pass "$skill has valid frontmatter"
    else
      log_fail "$skill missing required frontmatter fields"
    fi
  else
    log_fail "$skill/SKILL.md not found"
  fi
done
echo ""

# Test 3: References directory exists
echo "Test 3: References directory structure"
for skill in "${FRONTEND_SKILLS[@]}"; do
  refs_dir="$SKILLS_DIR/$skill/references"
  if [[ -d "$refs_dir" ]]; then
    ref_count=$(find "$refs_dir" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$ref_count" -gt 0 ]]; then
      log_pass "$skill has $ref_count reference file(s)"
    else
      log_warn "$skill references directory empty"
    fi
  else
    log_warn "$skill missing references directory"
  fi
done
echo ""

# Test 4: Agent reference in SKILL.md
echo "Test 4: Agent assignment"
for skill in "${FRONTEND_SKILLS[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    if grep -q "^agent:" "$skill_file"; then
      agent=$(grep "^agent:" "$skill_file" | head -1 | sed 's/agent: *//')
      log_pass "$skill assigned to agent: $agent"
    else
      log_warn "$skill has no agent assignment"
    fi
  fi
done
echo ""

# Test 5: Anti-patterns section exists
echo "Test 5: Anti-patterns documentation"
for skill in "${FRONTEND_SKILLS[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    if grep -q "Anti-Patterns" "$skill_file"; then
      log_pass "$skill has anti-patterns section"
    else
      log_warn "$skill missing anti-patterns section"
    fi
  fi
done
echo ""

# Test 6: Key Decisions table exists
echo "Test 6: Key Decisions documentation"
for skill in "${FRONTEND_SKILLS[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    if grep -q "Key Decisions" "$skill_file"; then
      log_pass "$skill has key decisions table"
    else
      log_warn "$skill missing key decisions table"
    fi
  fi
done
echo ""

# Test 7: Capability Details section
echo "Test 7: Capability Details section"
for skill in "${FRONTEND_SKILLS[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    if grep -q "Capability Details" "$skill_file"; then
      log_pass "$skill has capability details"
    else
      log_warn "$skill missing capability details"
    fi
  fi
done
echo ""

# Test 8: Related Skills section
echo "Test 8: Related Skills section"
for skill in "${FRONTEND_SKILLS[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    if grep -q "Related Skills" "$skill_file"; then
      log_pass "$skill has related skills"
    else
      log_warn "$skill missing related skills"
    fi
  fi
done
echo ""

# Test 9: Token count info (skills loaded on-demand, no budget limit)
echo "Test 9: Token count (informational - skills load on-demand)"
for skill in "${FRONTEND_SKILLS[@]}"; do
  skill_file="$SKILLS_DIR/$skill/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    # Rough estimate: ~4 chars per token
    char_count=$(wc -c < "$skill_file" | tr -d ' ')
    estimated_tokens=$((char_count / 4))
    log_pass "$skill SKILL.md ~${estimated_tokens} tokens"
  fi
done
echo ""

echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [[ "$FAILED" -gt 0 ]]; then
  echo -e "${RED}TESTS FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}ALL TESTS PASSED${NC}"
  exit 0
fi
