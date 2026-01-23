# Agent Orchestration Perfection Roadmap

## Current State → Target State

```
CURRENT (30%)                              TARGET (95%)
─────────────────────────────────────────────────────────────────────────
Regex keyword matching          →          Semantic + keyword hybrid
Suggestions only                →          Auto-dispatch with confidence
Manual skill loading            →          Progressive auto-injection
No orchestration                →          Full lifecycle management
No multi-agent coordination     →          Task-based coordination
```

---

## Phase 1: Enhanced Intent Classification (Week 1)

### Goal: Replace regex matching with semantic + keyword hybrid

### 1.1 Build Intent Classifier

**File:** `hooks/prompt/intent-classifier.sh`

```bash
#!/usr/bin/env bash
# Intent Classifier with Confidence Scoring
# Uses keyword matching + description similarity + context signals

set -euo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .message // .content // ""')

# Exit if no prompt
[[ -z "$PROMPT" ]] && echo '{"continue":true,"suppressOutput":true}' && exit 0

PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Build skill index with descriptions (cached)
SKILL_INDEX="$PROJECT_ROOT/.claude/cache/skill-index.json"

# Score each skill
declare -A SKILL_SCORES

score_skill() {
    local skill_name="$1"
    local skill_desc="$2"
    local score=0

    # 1. Exact keyword match in prompt (weight: 30)
    local keywords=$(echo "$skill_desc" | grep -oE '\b[a-z]{4,}\b' | sort -u)
    for kw in $keywords; do
        if [[ "$PROMPT_LOWER" == *"$kw"* ]]; then
            ((score += 30))
        fi
    done

    # 2. Skill name fragments in prompt (weight: 20)
    local name_parts=$(echo "$skill_name" | tr '-' ' ')
    for part in $name_parts; do
        if [[ ${#part} -ge 3 ]] && [[ "$PROMPT_LOWER" == *"$part"* ]]; then
            ((score += 20))
        fi
    done

    # 3. Action verb alignment (weight: 15)
    if [[ "$PROMPT_LOWER" =~ (design|create|build|implement) ]] && [[ "$skill_desc" =~ (design|create|build|implement) ]]; then
        ((score += 15))
    fi

    # 4. Domain alignment (weight: 15)
    # Check if prompt domain matches skill domain

    # Cap at 100
    [[ $score -gt 100 ]] && score=100

    echo $score
}

# Output format with confidence
# confidence >= 80: HIGH (auto-action recommended)
# confidence 50-79: MEDIUM (suggest with emphasis)
# confidence < 50: LOW (mention only)
```

### 1.2 Agent Intent Matcher

**File:** `hooks/prompt/agent-intent-matcher.sh`

```bash
#!/usr/bin/env bash
# Matches user intent to agents based on description keywords
# Outputs: agent recommendations with confidence scores

set -euo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .message // .content // ""')
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
AGENTS_DIR="$PROJECT_ROOT/agents"

# Extract "Activates for" keywords from each agent
declare -A AGENT_MATCHES

for agent_file in "$AGENTS_DIR"/*.md; do
    agent_name=$(basename "$agent_file" .md)

    # Extract description line with "Activates for"
    desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { sub(/^description: */, ""); print; exit } }' "$agent_file")

    # Extract keywords after "Activates for"
    if [[ "$desc" =~ Activates\ for\ (.+)$ ]]; then
        keywords="${BASH_REMATCH[1]}"

        # Score based on keyword matches
        score=0
        IFS=',' read -ra KW_ARRAY <<< "$keywords"
        for kw in "${KW_ARRAY[@]}"; do
            kw_clean=$(echo "$kw" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
            if [[ "$PROMPT_LOWER" == *"$kw_clean"* ]]; then
                ((score += 25))
            fi
        done

        [[ $score -gt 0 ]] && AGENT_MATCHES["$agent_name"]=$score
    fi
done

# Sort by score and output top matches
# ...
```

---

## Phase 2: Auto-Dispatch System (Week 2)

### Goal: Automatically spawn agents when confidence is high

### 2.1 Decision Engine

**File:** `hooks/prompt/dispatch-decision-engine.sh`

```bash
#!/usr/bin/env bash
# Decision Engine: Determines whether to auto-spawn agent or suggest
#
# Decision Matrix:
#   confidence >= 85% AND single clear match → AUTO-SPAWN
#   confidence 70-84% → STRONG SUGGESTION with directive
#   confidence 50-69% → SUGGESTION
#   confidence < 50% → NO ACTION

set -euo pipefail

INPUT=$(cat)

# Get intent classification results
SKILL_MATCH=$(echo "$INPUT" | jq -r '.skill_match // empty')
AGENT_MATCH=$(echo "$INPUT" | jq -r '.agent_match // empty')
SKILL_CONF=$(echo "$INPUT" | jq -r '.skill_confidence // 0')
AGENT_CONF=$(echo "$INPUT" | jq -r '.agent_confidence // 0')

# Decision logic
if [[ $AGENT_CONF -ge 85 ]]; then
    # HIGH CONFIDENCE: Auto-spawn directive
    cat << EOF
{
  "continue": true,
  "hookSpecificOutput": {
    "additionalContext": "## AUTO-DISPATCH TRIGGERED

**Agent**: $AGENT_MATCH (confidence: ${AGENT_CONF}%)

You MUST spawn this agent using:
\`\`\`
Task tool with subagent_type: \"$AGENT_MATCH\"
\`\`\`

This is a HIGH-CONFIDENCE match based on the user's intent. Do not answer directly - delegate to the specialist agent."
  }
}
EOF
elif [[ $AGENT_CONF -ge 70 ]]; then
    # MEDIUM-HIGH: Strong suggestion
    cat << EOF
{
  "continue": true,
  "hookSpecificOutput": {
    "additionalContext": "## AGENT RECOMMENDATION (Strong)

**Recommended Agent**: $AGENT_MATCH (confidence: ${AGENT_CONF}%)

This task aligns well with the agent's specialization. Consider spawning unless you have specific reasons not to."
  }
}
EOF
else
    # Lower confidence or no match
    echo '{"continue":true,"suppressOutput":true}'
fi
```

### 2.2 Skill Auto-Injection

**File:** `hooks/prompt/skill-auto-inject.sh`

```bash
#!/usr/bin/env bash
# Auto-injects skill content when confidence is high
# Replaces "suggestion" with actual skill content in context

set -euo pipefail

INPUT=$(cat)
SKILL_NAME=$(echo "$INPUT" | jq -r '.top_skill // empty')
SKILL_CONF=$(echo "$INPUT" | jq -r '.skill_confidence // 0')

[[ -z "$SKILL_NAME" ]] && echo '{"continue":true,"suppressOutput":true}' && exit 0

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SKILL_FILE="$PROJECT_ROOT/skills/$SKILL_NAME/SKILL.md"

if [[ $SKILL_CONF -ge 80 ]] && [[ -f "$SKILL_FILE" ]]; then
    # HIGH CONFIDENCE: Inject skill content directly

    # Extract content after frontmatter (first 2000 chars to avoid bloat)
    SKILL_CONTENT=$(sed '1,/^---$/d; 1,/^---$/d' "$SKILL_FILE" | head -c 2000)

    cat << EOF
{
  "continue": true,
  "hookSpecificOutput": {
    "additionalContext": "## SKILL LOADED: $SKILL_NAME

The following skill has been auto-loaded based on your request (confidence: ${SKILL_CONF}%):

$SKILL_CONTENT

---
*Use these patterns in your response.*"
  }
}
EOF
else
    echo '{"continue":true,"suppressOutput":true}'
fi
```

---

## Phase 3: Orchestration Layer (Week 3)

### Goal: Track agent lifecycle, handle errors, coordinate multi-agent

### 3.1 Agent State Tracker

**File:** `.claude/orchestration/agent-state.json`

```json
{
  "active_agents": [],
  "completed_agents": [],
  "failed_agents": [],
  "task_queue": [],
  "coordination": {
    "locks": {},
    "handoffs": []
  }
}
```

### 3.2 SubagentStart Hook - State Registration

**File:** `hooks/subagent/agent-lifecycle-start.sh`

```bash
#!/usr/bin/env bash
# Registers agent start in orchestration state

set -euo pipefail

INPUT=$(cat)
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
AGENT_TYPE=$(echo "$INPUT" | jq -r '.subagent_type // empty')
TASK_DESC=$(echo "$INPUT" | jq -r '.task_description // empty')

STATE_FILE="${CLAUDE_PROJECT_DIR}/.claude/orchestration/agent-state.json"

# Initialize if not exists
[[ ! -f "$STATE_FILE" ]] && echo '{"active_agents":[],"completed_agents":[],"failed_agents":[]}' > "$STATE_FILE"

# Add to active agents
jq --arg id "$AGENT_ID" --arg type "$AGENT_TYPE" --arg task "$TASK_DESC" \
   '.active_agents += [{"id":$id,"type":$type,"task":$task,"started_at":now}]' \
   "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

echo '{"continue":true,"suppressOutput":true}'
```

### 3.3 SubagentStop Hook - Result Validation

**File:** `hooks/subagent/agent-lifecycle-stop.sh`

```bash
#!/usr/bin/env bash
# Validates agent output, handles failures, triggers retry if needed

set -euo pipefail

INPUT=$(cat)
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
AGENT_OUTPUT=$(echo "$INPUT" | jq -r '.output // empty')
EXIT_STATUS=$(echo "$INPUT" | jq -r '.exit_status // 0')

STATE_FILE="${CLAUDE_PROJECT_DIR}/.claude/orchestration/agent-state.json"

# Validate output quality
validate_output() {
    local output="$1"

    # Check for error indicators
    if [[ "$output" == *"FAIL"* ]] || [[ "$output" == *"Error:"* ]]; then
        return 1
    fi

    # Check minimum content
    if [[ ${#output} -lt 100 ]]; then
        return 1
    fi

    return 0
}

if validate_output "$AGENT_OUTPUT"; then
    # Success: Move to completed
    jq --arg id "$AGENT_ID" \
       '.active_agents |= map(select(.id != $id)) |
        .completed_agents += [{"id":$id,"completed_at":now}]' \
       "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

    echo '{"continue":true,"suppressOutput":true}'
else
    # Failure: Log and suggest retry
    jq --arg id "$AGENT_ID" --arg output "$AGENT_OUTPUT" \
       '.active_agents |= map(select(.id != $id)) |
        .failed_agents += [{"id":$id,"output":$output,"failed_at":now}]' \
       "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

    cat << EOF
{
  "continue": true,
  "hookSpecificOutput": {
    "additionalContext": "## AGENT TASK INCOMPLETE

Agent $AGENT_ID did not produce satisfactory output. Consider:
1. Retrying with more specific instructions
2. Breaking the task into smaller subtasks
3. Using a different agent type"
  }
}
EOF
fi
```

### 3.4 Multi-Agent Coordinator

**File:** `hooks/prompt/multi-agent-coordinator.sh`

```bash
#!/usr/bin/env bash
# Coordinates multiple agents working on related tasks
# Prevents conflicts, manages handoffs, tracks dependencies

set -euo pipefail

INPUT=$(cat)
STATE_FILE="${CLAUDE_PROJECT_DIR}/.claude/orchestration/agent-state.json"

# Check for active agents
ACTIVE_COUNT=$(jq '.active_agents | length' "$STATE_FILE" 2>/dev/null || echo 0)

if [[ $ACTIVE_COUNT -gt 0 ]]; then
    ACTIVE_AGENTS=$(jq -r '.active_agents[] | "\(.type): \(.task)"' "$STATE_FILE")

    cat << EOF
{
  "continue": true,
  "hookSpecificOutput": {
    "additionalContext": "## ACTIVE AGENTS

$ACTIVE_COUNT agent(s) currently working:
$ACTIVE_AGENTS

Consider waiting for completion or coordinating new tasks to avoid conflicts."
  }
}
EOF
else
    echo '{"continue":true,"suppressOutput":true}'
fi
```

---

## Phase 4: Task Dependency Resolution (Week 4)

### Goal: Use CC 2.1.16 TaskCreate/TaskUpdate for agent coordination

### 4.1 Task-Agent Binding

```bash
# When spawning agent, create corresponding task
TaskCreate → task_id
Task tool with subagent_type → agent starts
Link task_id to agent_id in state

# When agent completes
TaskUpdate status: completed
Check for blocked tasks → unblock and suggest next agent
```

### 4.2 Dependency Graph

```
Task A (backend-system-architect)
    │
    ├──blocks──► Task B (database-engineer)
    │                │
    │                └──blocks──► Task C (test-generator)
    │
    └──blocks──► Task D (frontend-ui-developer)
```

---

## Phase 5: Confidence Calibration (Week 5)

### Goal: Learn from outcomes to improve matching accuracy

### 5.1 Feedback Loop

**File:** `hooks/stop/calibration-feedback.sh`

```bash
#!/usr/bin/env bash
# Collects feedback on agent/skill matches for calibration

# Track:
# - Which suggestions were followed vs ignored
# - Agent success/failure rates by task type
# - Keyword patterns that led to good matches

# Store in:
# .claude/orchestration/calibration-data.json
```

### 5.2 Confidence Adjustment

```bash
# If agent X frequently fails on task type Y:
#   Lower confidence for X + Y combination
#
# If skill Z is frequently loaded after suggestion:
#   Raise confidence threshold for auto-inject
#
# If users consistently ignore suggestion W:
#   Lower confidence or remove from matching
```

---

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  UserPromptSubmit                                                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │ Intent          │────►│ Skill           │────►│ Agent           │       │
│  │ Classifier      │     │ Matcher         │     │ Matcher         │       │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘       │
│           │                       │                       │                 │
│           └───────────────────────┼───────────────────────┘                 │
│                                   │                                         │
│                                   ▼                                         │
│                       ┌─────────────────────┐                               │
│                       │ Decision Engine     │                               │
│                       │                     │                               │
│                       │ conf >= 85%: AUTO   │                               │
│                       │ conf 70-84%: STRONG │                               │
│                       │ conf 50-69%: SUGGEST│                               │
│                       │ conf < 50%: NONE    │                               │
│                       └──────────┬──────────┘                               │
│                                  │                                          │
│              ┌───────────────────┼───────────────────┐                      │
│              │                   │                   │                      │
│              ▼                   ▼                   ▼                      │
│    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │
│    │ Auto-Inject     │ │ Auto-Dispatch   │ │ Suggestion      │             │
│    │ Skill Content   │ │ Agent           │ │ Only            │             │
│    └─────────────────┘ └────────┬────────┘ └─────────────────┘             │
│                                 │                                           │
│                                 ▼                                           │
│                       ┌─────────────────┐                                   │
│                       │ State Tracker   │                                   │
│                       │                 │                                   │
│                       │ • Active agents │                                   │
│                       │ • Task deps     │                                   │
│                       │ • Handoffs      │                                   │
│                       └────────┬────────┘                                   │
│                                │                                            │
│  SubagentStop                  │                                            │
│       │                        ▼                                            │
│       ▼              ┌─────────────────┐                                    │
│  ┌─────────────────┐ │ Result          │                                    │
│  │ Output          │►│ Validator       │                                    │
│  │ Validation      │ │                 │                                    │
│  └─────────────────┘ │ • Quality check │                                    │
│                      │ • Retry logic   │                                    │
│                      │ • Task update   │                                    │
│                      └─────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create

| Phase | File | Purpose |
|-------|------|---------|
| 1 | `hooks/prompt/intent-classifier.sh` | Semantic + keyword matching |
| 1 | `hooks/prompt/agent-intent-matcher.sh` | Agent keyword extraction |
| 2 | `hooks/prompt/dispatch-decision-engine.sh` | Auto-dispatch logic |
| 2 | `hooks/prompt/skill-auto-inject.sh` | High-conf skill injection |
| 3 | `.claude/orchestration/agent-state.json` | State storage |
| 3 | `hooks/subagent/agent-lifecycle-start.sh` | Register agent start |
| 3 | `hooks/subagent/agent-lifecycle-stop.sh` | Validate + retry |
| 3 | `hooks/prompt/multi-agent-coordinator.sh` | Conflict prevention |
| 4 | `hooks/prompt/task-dependency-resolver.sh` | Use CC 2.1.16 tasks |
| 5 | `hooks/stop/calibration-feedback.sh` | Learn from outcomes |

---

## Tests to Create

```bash
tests/orchestration/
├── test-intent-classifier.sh
├── test-agent-matcher.sh
├── test-dispatch-decision.sh
├── test-skill-auto-inject.sh
├── test-agent-lifecycle.sh
├── test-multi-agent-coordination.sh
└── test-calibration-feedback.sh
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Skill match accuracy | ~60% (keyword) | 85%+ (semantic) |
| Agent dispatch rate | 0% (manual only) | 70%+ (auto when conf >= 85%) |
| Skill load rate | 0% (manual only) | 80%+ (auto when conf >= 80%) |
| Agent retry success | N/A | 80%+ |
| Multi-agent conflicts | Unknown | < 5% |

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Intent Classification | 3-4 days | None |
| Phase 2: Auto-Dispatch | 2-3 days | Phase 1 |
| Phase 3: Orchestration Layer | 4-5 days | Phase 2 |
| Phase 4: Task Dependencies | 2-3 days | Phase 3 |
| Phase 5: Calibration | 2-3 days | Phase 4 |
| **Total** | **~3-4 weeks** | |

---

## Quick Wins (Can Do Now)

1. **Agent keyword extraction hook** - Read agent descriptions, extract "Activates for", match prompts
2. **Stronger suggestion language** - Change "may be helpful" to "RECOMMENDED: spawn X"
3. **State tracking file** - Start logging agent invocations for later analysis
4. **Skill content injection** - When match is exact, inject first 500 tokens of SKILL.md

---

**Created**: 2026-01-22
**Status**: Roadmap Ready
