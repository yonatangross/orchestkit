#!/usr/bin/env bash
# ============================================================================
# Static Analysis Pipeline — OrchestKit
# ============================================================================
# Unified orchestrator that wraps existing tests + adds net-new checks.
# Outputs JSON results for eval pipeline integration (Milestone #62).
#
# Usage: npm run eval:static
#        bash scripts/eval/static-analysis.sh [--json-only]
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

AGENTS_DIR="$PROJECT_ROOT/src/agents"
SKILLS_DIR="$PROJECT_ROOT/src/skills"
RESULTS_DIR="$PROJECT_ROOT/tests/evaluations/results"
RESULTS_FILE="$RESULTS_DIR/static-analysis.json"

JSON_ONLY=false
[[ "${1:-}" == "--json-only" ]] && JSON_ONLY=true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
CHECKS_JSON=""

# macOS-compatible millisecond timestamp
ms_now() { python3 -c 'import time; print(int(time.time()*1000))'; }
START_TIME=$(ms_now)

pass() {
  $JSON_ONLY || echo -e "  ${GREEN}✓${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  $JSON_ONLY || echo -e "  ${RED}✗${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  $JSON_ONLY || echo -e "  ${YELLOW}⚠${NC} $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

header() {
  $JSON_ONLY || echo -e "\n${BOLD}${BLUE}═══ $1 ═══${NC}"
}

# Append a check result to CHECKS_JSON array
# Usage: add_check "name" "pass|fail|warn" "details string"
add_check() {
  local name="$1" status="$2" details="$3"
  # Escape JSON special chars in details
  details=$(echo "$details" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' ' ' | sed 's/  */ /g')
  local entry="{\"name\":\"$name\",\"status\":\"$status\",\"details\":\"$details\"}"
  if [[ -z "$CHECKS_JSON" ]]; then
    CHECKS_JSON="$entry"
  else
    CHECKS_JSON="$CHECKS_JSON,$entry"
  fi
}

# ============================================================================
# Section A: Wrap Existing Tests
# ============================================================================

header "Section A: Existing Test Suite"

# Run existing tests in parallel for speed
EXISTING_TESTS=(
  "CI Lint|$PROJECT_ROOT/tests/ci/lint.sh"
  "Skill Structure|$PROJECT_ROOT/tests/skills/structure/test-skill-md.sh"
  "Skill References|$PROJECT_ROOT/tests/skills/test-skill-references.sh"
  "Agent Frontmatter|$PROJECT_ROOT/tests/agents/test-agent-frontmatter.sh"
)

TMPDIR_A=$(mktemp -d)
for entry in "${EXISTING_TESTS[@]}"; do
  name="${entry%%|*}"
  script="${entry##*|}"
  (
    ec=0
    if [[ ! -f "$script" ]]; then
      echo "warn" > "$TMPDIR_A/${name}.status"
      echo "Script not found: $script" > "$TMPDIR_A/${name}.detail"
    else
      bash "$script" > "$TMPDIR_A/${name}.out" 2>&1 || ec=$?
      if [[ $ec -eq 0 ]]; then
        echo "pass" > "$TMPDIR_A/${name}.status"
        echo "All checks passed" > "$TMPDIR_A/${name}.detail"
      else
        echo "fail" > "$TMPDIR_A/${name}.status"
        detail=$(grep -i 'FAIL\|ERROR\|✗' "$TMPDIR_A/${name}.out" | head -5 | tr '\n' '; ')
        echo "Exit code $ec. ${detail:-No details captured}" > "$TMPDIR_A/${name}.detail"
      fi
    fi
  ) &
done
wait

# Collect results in order
for entry in "${EXISTING_TESTS[@]}"; do
  name="${entry%%|*}"
  status=$(cat "$TMPDIR_A/${name}.status" 2>/dev/null || echo "warn")
  detail=$(cat "$TMPDIR_A/${name}.detail" 2>/dev/null || echo "Unknown")
  case "$status" in
    pass) pass "$name" ;;
    fail) fail "$name — $detail" ;;
    warn) warn "$name — $detail" ;;
  esac
  add_check "$name" "$status" "$detail"
done
rm -rf "$TMPDIR_A"

# ============================================================================
# Section B: Agent Permission Audit (NEW)
# ============================================================================

header "Section B: Agent Permission Audit"

KNOWN_AGENT_FIELDS="name description model tools disallowedTools skills hooks context category color memory maxTurns mcpServers permissionMode"

PERM_FAILS=0
PERM_DETAILS=""

# Single awk pass over all agent files for permission audit
PERM_OUTPUT=$(awk '
  FNR == 1 {
    # Process previous agent if any
    if (agent_name != "") check_agent()
    # Reset for new file
    in_fm = 0; in_tools = 0; in_disallowed = 0
    agent_name = FILENAME
    gsub(/.*\//, "", agent_name)
    gsub(/\.md$/, "", agent_name)
    desc = ""; delete tools; delete disallowed; tc = 0; dc = 0
  }
  /^---$/ && !in_fm { in_fm = 1; next }
  /^---$/ && in_fm { in_fm = 0; next }
  !in_fm { next }

  # Track which list section we are in
  /^tools:/ {
    in_tools = 1; in_disallowed = 0
    # Handle inline: tools: [Bash, Read]
    if (match($0, /\[.*\]/)) {
      line = $0; gsub(/^tools: *\[/, "", line); gsub(/\].*/, "", line)
      n = split(line, arr, ",")
      for (i = 1; i <= n; i++) { gsub(/^ +| +$/, "", arr[i]); tools[++tc] = arr[i] }
      in_tools = 0
    }
    next
  }
  /^disallowedTools:/ {
    in_disallowed = 1; in_tools = 0
    if (match($0, /\[.*\]/)) {
      line = $0; gsub(/^disallowedTools: *\[/, "", line); gsub(/\].*/, "", line)
      n = split(line, arr, ",")
      for (i = 1; i <= n; i++) { gsub(/^ +| +$/, "", arr[i]); disallowed[++dc] = arr[i] }
      in_disallowed = 0
    }
    next
  }
  /^description:/ { desc = $0; gsub(/^description: */, "", desc); in_tools = 0; in_disallowed = 0; next }
  /^[a-zA-Z]/ { in_tools = 0; in_disallowed = 0; next }

  in_tools && /^  - / { val = $0; gsub(/^  - /, "", val); tools[++tc] = val; next }
  in_disallowed && /^  - / { val = $0; gsub(/^  - /, "", val); disallowed[++dc] = val; next }

  END { if (agent_name != "") check_agent() }

  function check_agent() {
    # Check 1: tools/disallowedTools conflict
    for (t = 1; t <= tc; t++) {
      for (d = 1; d <= dc; d++) {
        if (tools[t] == disallowed[d]) {
          printf "FAIL\t%s\ttool '"'"'%s'"'"' in both tools and disallowedTools\n", agent_name, tools[t]
        }
      }
    }
    # Check 2: Review/audit agents with write tools
    # Skip agents that also implement/generate/optimize (they legitimately need write tools)
    ldesc = tolower(desc)
    is_reviewer = (index(ldesc, "review") || index(ldesc, "audit") || index(ldesc, "analyz") || index(ldesc, "scan"))
    is_implementer = (index(ldesc, "implement") || index(ldesc, "generat") || index(ldesc, "creat") || \
                      index(ldesc, "optimi") || index(ldesc, "build") || index(ldesc, "design"))
    if (is_reviewer && !is_implementer) {
      for (t = 1; t <= tc; t++) {
        if (tools[t] == "Write" || tools[t] == "Edit" || tools[t] == "MultiEdit") {
          printf "WARN\t%s\treview/audit agent has '"'"'%s'"'"' in tools\n", agent_name, tools[t]
        }
      }
    }
    # Check 3: Named auditors must not have Write/Edit
    if (agent_name == "security-auditor" || agent_name == "code-quality-reviewer" || agent_name == "ai-safety-auditor") {
      for (t = 1; t <= tc; t++) {
        if (tools[t] == "Write" || tools[t] == "Edit" || tools[t] == "MultiEdit") {
          printf "FAIL\t%s\tauditor must not have '"'"'%s'"'"' in tools\n", agent_name, tools[t]
        }
      }
    }
  }
' "$AGENTS_DIR"/*.md 2>/dev/null || true)

if [[ -n "$PERM_OUTPUT" ]]; then
  while IFS=$'\t' read -r level agent_name detail; do
    case "$level" in
      FAIL)
        fail "Agent '$agent_name': $detail"
        PERM_DETAILS+="$agent_name: $detail; "
        PERM_FAILS=$((PERM_FAILS + 1))
        ;;
      WARN)
        warn "Agent '$agent_name' (review/audit): $detail"
        PERM_DETAILS+="$agent_name: $detail; "
        ;;
    esac
  done <<< "$PERM_OUTPUT"
fi

if [[ $PERM_FAILS -eq 0 ]]; then
  pass "Agent Permission Audit — no conflicts"
  add_check "Agent Permission Audit" "pass" "All agent permission checks passed"
else
  add_check "Agent Permission Audit" "fail" "$PERM_DETAILS"
fi

# ============================================================================
# Section C: Security Pattern Grep (NEW)
# ============================================================================

header "Section C: Security Pattern Grep"

SEC_FAILS=0
SEC_DETAILS=""

# Collect all rule files, excluding _sections.md and _template.md
RULE_FILES=()
for skill_dir in "$SKILLS_DIR"/*/; do
  rules_dir="${skill_dir}rules"
  [[ ! -d "$rules_dir" ]] && continue
  for rule_file in "$rules_dir"/*.md; do
    [[ ! -f "$rule_file" ]] && continue
    base=$(basename "$rule_file")
    [[ "$base" == "_sections.md" || "$base" == "_template.md" ]] && continue
    RULE_FILES+=("$rule_file")
  done
done

# Single awk pass over all files: extracts good code blocks and checks for dangerous patterns
# Output: FILEPATH<tab>PATTERN_NAME lines for each finding
if [[ ${#RULE_FILES[@]} -gt 0 ]]; then
  SEC_OUTPUT=$(awk '
    BEGIN {
      # Dangerous patterns (awk regex)
      pats[1] = "[^.a-z_]eval\\("; pnames[1] = "eval("
      pats[2] = "innerHTML[[:space:]]*="; pnames[2] = "innerHTML ="
      pats[3] = "document\\.write\\("; pnames[3] = "document.write("
      pats[4] = "__import__\\("; pnames[4] = "__import__("
      pats[5] = "shell=True"; pnames[5] = "shell=True"
      pats[6] = "f\"[^\"]*SELECT[^\"]*\\{"; pnames[6] = "f-string SELECT injection (dquote)"
      pats[7] = "f'"'"'[^'"'"']*SELECT[^'"'"']*\\{"; pnames[7] = "f-string SELECT injection (squote)"
      npats = 7

      in_block = 0; is_bad = 0; context = ""
    }
    FNR == 1 {
      # Reset state for each new file
      in_block = 0; is_bad = 0; context = ""
    }
    /^```/ {
      if (in_block) {
        in_block = 0
      } else {
        in_block = 1
        lc = tolower(context)
        if (index(lc, "# bad") || index(lc, "dangerous") || index(lc, "violation") || \
            index(lc, "don'"'"'t") || index(lc, "dont") || index(lc, "never") || \
            index(lc, "anti-pattern") || index(lc, "incorrect") || index(lc, "vulnerable")) {
          is_bad = 1
        } else {
          is_bad = 0
        }
        context = ""
      }
      next
    }
    in_block && !is_bad {
      for (p = 1; p <= npats; p++) {
        if (match($0, pats[p])) {
          # Deduplicate: track file+pattern combos
          key = FILENAME "\t" pnames[p]
          if (!(key in seen)) {
            seen[key] = 1
            print key
          }
        }
      }
    }
    !in_block {
      # Rolling 5-line context window (append newline + current line)
      n = split(context, arr, "\n")
      if (n >= 6) {
        context = ""
        for (i = n-3; i <= n; i++) context = context "\n" arr[i]
      }
      context = context "\n" $0
    }
  ' "${RULE_FILES[@]}" 2>/dev/null || true)

  if [[ -n "$SEC_OUTPUT" ]]; then
    while IFS=$'\t' read -r filepath pattern_name; do
      # Extract skill/rule from path
      rel=${filepath#"$SKILLS_DIR"/}
      skill_name=${rel%%/*}
      rule_name=$(basename "$filepath" .md)
      fail "Security: $skill_name/$rule_name has '$pattern_name' in good code block"
      SEC_DETAILS+="$skill_name/$rule_name has $pattern_name; "
      SEC_FAILS=$((SEC_FAILS + 1))
    done <<< "$SEC_OUTPUT"
  fi
fi

if [[ $SEC_FAILS -eq 0 ]]; then
  pass "Security Pattern Grep — no dangerous patterns in good blocks"
  add_check "Security Pattern Grep" "pass" "No dangerous patterns found in good code blocks"
else
  add_check "Security Pattern Grep" "fail" "$SEC_DETAILS"
fi

# ============================================================================
# Section D: Unknown Frontmatter Fields (NEW)
# ============================================================================

header "Section D: Unknown Frontmatter Fields"

KNOWN_SKILL_FIELDS=" name description version tags user-invocable complexity context hooks references scripts license compatibility agent author metadata allowed-tools argument-hint skills "
KNOWN_AGENT_FIELDS_D=" name description model tools disallowedTools skills hooks context category color memory maxTurns mcpServers permissionMode "
UNK_WARNS=0
UNK_DETAILS=""

# Single awk pass: extract frontmatter field names from all skill and agent files
# Output: TYPE<tab>NAME<tab>FIELD for each top-level field
UNK_OUTPUT=$(
  # Process skills
  for f in "$SKILLS_DIR"/*/SKILL.md; do
    [[ -f "$f" ]] && echo "SKILL_FILE:$f"
  done | while IFS= read -r entry; do
    filepath="${entry#SKILL_FILE:}"
    dirname=$(dirname "$filepath")
    skill_name=$(basename "$dirname")
    awk -v sname="$skill_name" '
      /^---$/ { if(f){exit}else{f=1;next} }
      f && /^[a-zA-Z_-]+:/ { field=$0; gsub(/:.*/, "", field); printf "skill\t%s\t%s\n", sname, field }
    ' "$filepath"
  done

  # Process agents
  for f in "$AGENTS_DIR"/*.md; do
    [[ -f "$f" ]] || continue
    aname=$(basename "$f" .md)
    awk -v aname="$aname" '
      /^---$/ { if(f){exit}else{f=1;next} }
      f && /^[a-zA-Z_-]+:/ { field=$0; gsub(/:.*/, "", field); printf "agent\t%s\t%s\n", aname, field }
    ' "$f"
  done
)

if [[ -n "$UNK_OUTPUT" ]]; then
  while IFS=$'\t' read -r type cname field; do
    [[ -z "$field" ]] && continue
    case "$type" in
      skill)
        if [[ "$KNOWN_SKILL_FIELDS" != *" $field "* ]]; then
          warn "Skill '$cname' has unknown field: '$field'"
          UNK_DETAILS+="skill/$cname: unknown field '$field'; "
          UNK_WARNS=$((UNK_WARNS + 1))
        fi
        ;;
      agent)
        if [[ "$KNOWN_AGENT_FIELDS_D" != *" $field "* ]]; then
          warn "Agent '$cname' has unknown field: '$field'"
          UNK_DETAILS+="agent/$cname: unknown field '$field'; "
          UNK_WARNS=$((UNK_WARNS + 1))
        fi
        ;;
    esac
  done <<< "$UNK_OUTPUT"
fi

if [[ $UNK_WARNS -eq 0 ]]; then
  pass "Unknown Frontmatter Fields — all fields recognized"
  add_check "Unknown Frontmatter Fields" "pass" "All frontmatter fields are recognized"
else
  add_check "Unknown Frontmatter Fields" "warn" "$UNK_DETAILS"
fi

# ============================================================================
# Section E: CLI-vs-API Identifier Mapping (NEW)
# ============================================================================
# Any skill that mixes gh CLI milestone flags (--milestone NAME) with REST API
# milestone paths (milestones/NUMBER) must document the identifier difference.
# Enforces the standard from references/cli-vs-api-identifiers.md
# ============================================================================

header "Section E: CLI-vs-API Identifier Mapping"

CLI_API_FAILS=0
CLI_API_DETAILS=""

for skill_dir in "$SKILLS_DIR"/*/; do
  [[ ! -d "$skill_dir" ]] && continue
  skill_name=$(basename "$skill_dir")

  # Collect all .md files for this skill (SKILL.md + references/ + rules/ + examples/)
  skill_files=()
  while IFS= read -r -d '' f; do
    skill_files+=("$f")
  done < <(find "$skill_dir" -name "*.md" -print0 2>/dev/null)
  [[ ${#skill_files[@]} -eq 0 ]] && continue

  # Check 1: does the skill use gh CLI milestone flag (--milestone)?
  has_cli_milestone=false
  for f in "${skill_files[@]}"; do
    if grep -q -- '--milestone' "$f" 2>/dev/null; then
      has_cli_milestone=true
      break
    fi
  done

  # Check 2: does the skill use gh api REST milestone path (milestones/ followed by a number or :number)?
  has_api_milestone=false
  for f in "${skill_files[@]}"; do
    if grep -qE 'gh api.*(milestones/[0-9:$]|milestones/\$)' "$f" 2>/dev/null; then
      has_api_milestone=true
      break
    fi
  done

  # If both patterns are present, the skill must document the identifier difference
  if $has_cli_milestone && $has_api_milestone; then
    # Check for a cli-vs-api note: reference to cli-vs-api-identifiers OR explicit NAME/NUMBER warning
    has_note=false
    for f in "${skill_files[@]}"; do
      if grep -qiE 'cli-vs-api|takes.*NAME|NAME.*not.*number|milestone.*NAME.*number|milestone NUMBER' "$f" 2>/dev/null; then
        has_note=true
        break
      fi
    done
    if ! $has_note; then
      fail "Skill '$skill_name': mixes gh CLI (--milestone NAME) + REST API (milestones/NUMBER) without cli-vs-api identifier note"
      CLI_API_DETAILS+="$skill_name: missing cli-vs-api identifier note; "
      CLI_API_FAILS=$((CLI_API_FAILS + 1))
    fi
  fi
done

if [[ $CLI_API_FAILS -eq 0 ]]; then
  pass "CLI-vs-API Identifier Mapping — all mixed-mode skills documented"
  add_check "CLI-vs-API Identifier Mapping" "pass" "All skills mixing gh CLI and REST API identifiers are documented"
else
  add_check "CLI-vs-API Identifier Mapping" "fail" "$CLI_API_DETAILS"
fi

# ============================================================================
# Section F: JSON Output
# ============================================================================

END_TIME=$(ms_now)
DURATION=$((END_TIME - START_TIME))
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*: *"//;s/".*//')

mkdir -p "$RESULTS_DIR"

cat > "$RESULTS_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "version": "$VERSION",
  "duration_ms": $DURATION,
  "summary": {
    "total": $TOTAL,
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT,
    "warnings": $WARN_COUNT
  },
  "checks": [$CHECKS_JSON]
}
EOF

header "Summary"
$JSON_ONLY || echo -e "  Total: $TOTAL  |  ${GREEN}Passed: $PASS_COUNT${NC}  |  ${RED}Failed: $FAIL_COUNT${NC}  |  ${YELLOW}Warnings: $WARN_COUNT${NC}"
$JSON_ONLY || echo -e "  Duration: ${DURATION}ms"
$JSON_ONLY || echo -e "  Results: $RESULTS_FILE"

# Exit with failure if any checks failed
if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi

exit 0
