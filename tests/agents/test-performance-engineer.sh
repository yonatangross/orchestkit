#!/usr/bin/env bash
# Test suite for performance-engineer agent
# Validates agent structure, skills, and frontmatter

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$PROJECT_ROOT/src/agents"
AGENT_FILE="$AGENTS_DIR/performance-engineer.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

log_pass() { echo -e "${GREEN}✓${NC} $1"; PASSED=$((PASSED + 1)); }
log_fail() { echo -e "${RED}✗${NC} $1"; FAILED=$((FAILED + 1)); }

echo "=========================================="
echo "Performance Engineer Agent Test Suite"
echo "=========================================="
echo ""

# Test 1: Agent file exists
echo "Test 1: Agent file exists"
if [[ -f "$AGENT_FILE" ]]; then
  log_pass "performance-engineer.md exists"
else
  log_fail "performance-engineer.md not found"
  exit 1
fi
echo ""

# Test 2: Required frontmatter fields
echo "Test 2: Required frontmatter fields"
required_fields=("name" "description" "model" "tools" "skills")
for field in "${required_fields[@]}"; do
  if grep -q "^${field}:" "$AGENT_FILE"; then
    log_pass "Has '$field' field"
  else
    log_fail "Missing '$field' field"
  fi
done
echo ""

# Test 3: Model is valid
echo "Test 3: Model validation"
model=$(grep "^model:" "$AGENT_FILE" | sed 's/model: *//')
if [[ "$model" == "sonnet" || "$model" == "opus" || "$model" == "haiku" ]]; then
  log_pass "Model is valid: $model"
else
  log_fail "Invalid model: $model"
fi
echo ""

# Test 4: Required skills are present
echo "Test 4: Required skills"
required_skills=("core-web-vitals" "lazy-loading-patterns" "image-optimization")
for skill in "${required_skills[@]}"; do
  if grep -q "$skill" "$AGENT_FILE"; then
    log_pass "Has skill: $skill"
  else
    log_fail "Missing skill: $skill"
  fi
done
echo ""

# Test 5: Required tools
echo "Test 5: Required tools"
required_tools=("Read" "Write" "Bash" "Grep" "Glob")
for tool in "${required_tools[@]}"; do
  if grep -qE "^\s+- $tool\$" "$AGENT_FILE"; then
    log_pass "Has tool: $tool"
  else
    log_fail "Missing tool: $tool"
  fi
done
echo ""

# Test 6: Activation keywords in description
echo "Test 6: Activation keywords"
keywords=("performance" "Core Web Vitals" "LCP" "bundle" "Lighthouse")
keyword_count=0
for keyword in "${keywords[@]}"; do
  if grep -qi "$keyword" "$AGENT_FILE"; then
    keyword_count=$((keyword_count + 1))
  fi
done
if [[ "$keyword_count" -ge 3 ]]; then
  log_pass "Has sufficient activation keywords ($keyword_count)"
else
  log_fail "Insufficient activation keywords ($keyword_count < 3)"
fi
echo ""

# Test 7: Directive section
echo "Test 7: Required sections"
sections=("Directive" "Concrete Objectives" "Task Boundaries" "Output Format")
for section in "${sections[@]}"; do
  if grep -q "## $section" "$AGENT_FILE"; then
    log_pass "Has section: $section"
  else
    log_fail "Missing section: $section"
  fi
done
echo ""

# Test 8: Context mode
echo "Test 8: Context mode"
if grep -q "^context:" "$AGENT_FILE"; then
  context=$(grep "^context:" "$AGENT_FILE" | sed 's/context: *//')
  if [[ "$context" == "fork" || "$context" == "inherit" || "$context" == "none" ]]; then
    log_pass "Valid context mode: $context"
  else
    log_fail "Invalid context mode: $context"
  fi
else
  log_fail "Missing context field"
fi
echo ""

# Test 9: Anti-patterns section
echo "Test 9: Anti-patterns documentation"
if grep -q "Anti-Patterns" "$AGENT_FILE"; then
  log_pass "Has anti-patterns section"
else
  log_fail "Missing anti-patterns section"
fi
echo ""

# Test 10: MCP Tools section (optional but recommended)
echo "Test 10: MCP Tools integration"
if grep -q "MCP Tools" "$AGENT_FILE"; then
  log_pass "Has MCP Tools section"
else
  log_fail "Missing MCP Tools section"
fi
echo ""

echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [[ "$FAILED" -gt 0 ]]; then
  echo -e "${RED}TESTS FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}ALL TESTS PASSED${NC}"
  exit 0
fi
