#!/bin/bash
set -euo pipefail
# Subagent Validator - Source of truth for subagent tracking
# CC 2.1.7 Compliant: includes continue field in all outputs
# Hook: PreToolUse (Task)
#
# This is the ONLY place we track subagent usage because:
# - SubagentStop hook doesn't receive subagent_type (Claude Code limitation)
# - PreToolUse receives full task details including type, description, prompt

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

SUBAGENT_TYPE=$(get_field '.tool_input.subagent_type')
DESCRIPTION=$(get_field '.tool_input.description')
SESSION_ID=$(get_session_id)

log_hook "Task invocation: $SUBAGENT_TYPE - $DESCRIPTION"

# === SUBAGENT TRACKING (JSONL for analysis) ===
TRACKING_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/subagent-spawns.jsonl"
mkdir -p "$(dirname "$TRACKING_LOG")" 2>/dev/null || true

jq -n \
  --arg ts "$(date -Iseconds)" \
  --arg type "$SUBAGENT_TYPE" \
  --arg desc "$DESCRIPTION" \
  --arg session "$SESSION_ID" \
  '{timestamp: $ts, subagent_type: $type, description: $desc, session_id: $session}' \
  >> "$TRACKING_LOG" 2>/dev/null || {
  # Fallback if jq fails
  echo "{\"timestamp\":\"$(date -Iseconds)\",\"subagent_type\":\"$SUBAGENT_TYPE\",\"description\":\"$DESCRIPTION\"}" >> "$TRACKING_LOG"
}

# === VALIDATION: Build valid types from multiple sources ===
BUILTIN_TYPES="general-purpose|Explore|Plan|claude-code-guide|statusline-setup|Bash"

# Extract agent type (strip namespace prefix like "skf:")
AGENT_TYPE_ONLY="${SUBAGENT_TYPE##*:}"

# Source 1: Load from plugin.json agents array (if exists)
REGISTRY="${CLAUDE_PROJECT_DIR:-.}/plugin.json"
REGISTRY_TYPES=""
if [[ -f "$REGISTRY" ]]; then
  REGISTRY_TYPES=$(jq -r '[.agents[].id // empty] | join("|")' "$REGISTRY" 2>/dev/null || echo "")
fi

# Source 2: Scan .claude/agents/ directory for agent markdown files
AGENTS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/agents"
AGENT_FILES_TYPES=""
if [[ -d "$AGENTS_DIR" ]]; then
  # List .md files, strip extension, join with |
  AGENT_FILES_TYPES=$(ls "$AGENTS_DIR"/*.md 2>/dev/null | xargs -I{} basename {} .md | tr '\n' '|' | sed 's/|$//')
fi

# Combine all valid types
VALID_TYPES="$BUILTIN_TYPES"
[[ -n "$REGISTRY_TYPES" ]] && VALID_TYPES="$VALID_TYPES|$REGISTRY_TYPES"
[[ -n "$AGENT_FILES_TYPES" ]] && VALID_TYPES="$VALID_TYPES|$AGENT_FILES_TYPES"

# Validate (check both full name and stripped name)
if [[ ! "$SUBAGENT_TYPE" =~ ^($VALID_TYPES)$ ]] && [[ ! "$AGENT_TYPE_ONLY" =~ ^($VALID_TYPES)$ ]]; then
  # Only log to file, no stderr output (silent on unknown types)
  log_hook "WARNING: Unknown subagent type: $SUBAGENT_TYPE"
fi

# Silent on success - only log to file, no stderr output
log_hook "Spawning $SUBAGENT_TYPE agent: $DESCRIPTION"

# === SKILL VALIDATION: Check referenced skills exist ===
# Only validate if agent file exists (skip for builtin types)
validate_agent_skills() {
  local agent_type="$1"
  local agent_file=""

  # Find agent markdown file
  if [[ -f "${CLAUDE_PROJECT_DIR:-.}/agents/${agent_type}.md" ]]; then
    agent_file="${CLAUDE_PROJECT_DIR:-.}/agents/${agent_type}.md"
  elif [[ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/agents/${agent_type}.md" ]]; then
    agent_file="${CLAUDE_PROJECT_DIR:-.}/.claude/agents/${agent_type}.md"
  fi

  # Skip if no agent file found (builtin type)
  if [[ -z "$agent_file" ]] || [[ ! -f "$agent_file" ]]; then
    return 0
  fi

  # Extract skills array from YAML frontmatter
  # Frontmatter is between first two "---" lines
  local in_frontmatter=0
  local in_skills=0
  local skills=()

  while IFS= read -r line; do
    # Detect frontmatter boundaries
    if [[ "$line" == "---" ]]; then
      if [[ $in_frontmatter -eq 0 ]]; then
        in_frontmatter=1
        continue
      else
        break  # End of frontmatter
      fi
    fi

    # Skip if not in frontmatter
    [[ $in_frontmatter -eq 0 ]] && continue

    # Detect skills array start
    if [[ "$line" =~ ^skills: ]]; then
      in_skills=1
      continue
    fi

    # If we hit another top-level key, stop reading skills
    if [[ $in_skills -eq 1 ]] && [[ "$line" =~ ^[a-zA-Z] ]] && [[ ! "$line" =~ ^[[:space:]] ]]; then
      in_skills=0
      continue
    fi

    # Extract skill names (lines starting with "  - ")
    if [[ $in_skills -eq 1 ]] && [[ "$line" =~ ^[[:space:]]*-[[:space:]]*(.+)$ ]]; then
      local skill_name="${BASH_REMATCH[1]}"
      # Trim whitespace
      skill_name="${skill_name## }"
      skill_name="${skill_name%% }"
      skills+=("$skill_name")
    fi
  done < "$agent_file"

  # Validate each skill exists
  local missing_skills=()
  local skills_dir="${CLAUDE_PROJECT_DIR:-.}/skills"

  for skill in "${skills[@]}"; do
    # Check if skill directory exists with SKILL.md (CC 2.1.7 flat structure)
    if [[ ! -f "$skills_dir/$skill/SKILL.md" ]]; then
      missing_skills+=("$skill")
    fi
  done

  # Warn about missing skills (don't block)
  if [[ ${#missing_skills[@]} -gt 0 ]]; then
    local missing_list
    missing_list=$(IFS=', '; echo "${missing_skills[*]}")
    log_hook "WARNING: Agent '$agent_type' references missing skills: $missing_list"
    # Output warning to stderr (visible to user but non-blocking)
    echo "Warning: Agent '$agent_type' references ${#missing_skills[@]} missing skill(s): $missing_list" >&2
  fi
}

# Run skill validation (fast - uses direct path check)
validate_agent_skills "$AGENT_TYPE_ONLY"

# CC 2.1.7 Compliant: JSON output without ANSI colors
# (Colors in JSON break JSON parsing)
echo '{"continue": true, "suppressOutput": true}'
exit 0