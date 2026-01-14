#!/usr/bin/env bash
# feedback-lib.sh - Helper functions for feedback system
# Part of SkillForge Claude Plugin

set -euo pipefail

# =============================================================================
# CONSTANTS
# =============================================================================

# Feedback directory
FEEDBACK_DIR="${FEEDBACK_DIR:-${CLAUDE_PROJECT_DIR:-.}/.claude/feedback}"

# File paths
METRICS_FILE="${METRICS_FILE:-${FEEDBACK_DIR}/metrics.json}"
PATTERNS_FILE="${PATTERNS_FILE:-${FEEDBACK_DIR}/learned-patterns.json}"
PREFERENCES_FILE="${PREFERENCES_FILE:-${FEEDBACK_DIR}/preferences.json}"
SATISFACTION_FILE="${SATISFACTION_FILE:-${FEEDBACK_DIR}/satisfaction.json}"

# Learning thresholds
readonly MIN_SAMPLES_FOR_LEARNING=5
readonly MIN_APPROVAL_RATE=0.9

# Security blocklist - NEVER auto-approve these patterns
readonly SECURITY_BLOCKLIST=(
    'rm\s+(-rf|-r\s+-f)'
    'sudo\s'
    'chmod\s+777'
    'chown\s'
    '>\s*/(etc|usr|bin|sbin)/'
    '--force\s'
    '--no-verify'
    'curl\s.*\|\s*(ba)?sh'
    'eval\s'
    '(password|secret|credential|token|api.?key)'
)

# =============================================================================
# SATISFACTION DETECTION PATTERNS
# =============================================================================

# Positive signals - indicate user is happy with output
# Using simple word boundaries for reliable bash matching
SATISFACTION_POSITIVE_WORDS=(
    "thanks"
    "thank you"
    "thx"
    "ty"
    "great"
    "perfect"
    "awesome"
    "excellent"
    "amazing"
    "fantastic"
    "wonderful"
    "works"
    "working"
    "done"
    "correct"
    "exactly"
    "precisely"
    "nice"
    "good"
    "looks good"
    "lgtm"
    "yes"
    "yep"
    "yeah"
    "yup"
    "solved"
    "fixed"
    "resolved"
    "got it"
)

# Negative signals - indicate user dissatisfaction
# Note: Short words like "no" are checked with word boundaries to avoid false positives
SATISFACTION_NEGATIVE_WORDS=(
    "nope"
    "wrong"
    "incorrect"
    "not right"
    "fix this"
    "fix it"
    "broken"
    "not working"
    "failed"
    "error"
    "still not"
    "again"
    "already told"
    "once more"
    "ugh"
    "argh"
    "frustrat"
    "not what i wanted"
    "not what i asked"
    "try again"
    "redo"
    "undo"
    "missed"
    "missing"
    "forgot"
    "overlooked"
    "actually no"
    "wait no"
    "that's wrong"
    "thats wrong"
)

# Short negative words that need word boundary matching
SATISFACTION_NEGATIVE_SHORT=(
    "no"
    "fix"
)

# =============================================================================
# INITIALIZATION
# =============================================================================

# Initialize feedback directory and files
init_feedback() {
    mkdir -p "$FEEDBACK_DIR"

    # Create metrics.json if not exists
    if [[ ! -f "$METRICS_FILE" ]]; then
        cat > "$METRICS_FILE" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "skills": {},
  "hooks": {},
  "agents": {}
}
EOF
    fi

    # Create learned-patterns.json if not exists
    if [[ ! -f "$PATTERNS_FILE" ]]; then
        cat > "$PATTERNS_FILE" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "permissions": {},
  "codeStyle": {}
}
EOF
    fi

    # Create preferences.json if not exists
    if [[ ! -f "$PREFERENCES_FILE" ]]; then
        cat > "$PREFERENCES_FILE" << 'EOF'
{
  "version": "1.0",
  "enabled": true,
  "learnFromEdits": true,
  "learnFromApprovals": true,
  "learnFromAgentOutcomes": true,
  "shareAnonymized": false,
  "syncGlobalPatterns": true,
  "retentionDays": 90,
  "pausedUntil": null
}
EOF
    fi

    # Create satisfaction.json if not exists
    if [[ ! -f "$SATISFACTION_FILE" ]]; then
        cat > "$SATISFACTION_FILE" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "sessions": {},
  "aggregate": {
    "totalPositive": 0,
    "totalNegative": 0,
    "totalNeutral": 0,
    "averageScore": 0
  }
}
EOF
    fi

    # Create .gitkeep
    touch "${FEEDBACK_DIR}/.gitkeep"
}

# =============================================================================
# PREFERENCES
# =============================================================================

# Check if feedback is enabled
is_feedback_enabled() {
    if [[ ! -f "$PREFERENCES_FILE" ]]; then
        return 0  # Default to enabled
    fi

    local enabled
    enabled=$(jq -r 'if has("enabled") then .enabled else true end' "$PREFERENCES_FILE" 2>/dev/null || echo "true")

    if [[ "$enabled" == "false" ]]; then
        return 1
    fi

    # Check if paused
    local paused_until
    paused_until=$(jq -r '.pausedUntil // null' "$PREFERENCES_FILE" 2>/dev/null || echo "null")

    if [[ "$paused_until" != "null" ]]; then
        local now
        now=$(date +%s)
        local pause_ts
        pause_ts=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${paused_until%%.*}" +%s 2>/dev/null || echo "0")

        if [[ $now -lt $pause_ts ]]; then
            return 1
        fi
    fi

    return 0
}

# Get preference value
get_preference() {
    local key="$1"
    local default="${2:-true}"

    if [[ ! -f "$PREFERENCES_FILE" ]]; then
        echo "$default"
        return
    fi

    jq -r ".${key} // \"${default}\"" "$PREFERENCES_FILE" 2>/dev/null || echo "$default"
}

# Set preference value
set_preference() {
    local key="$1"
    local value="$2"

    init_feedback

    local tmp_file
    tmp_file=$(mktemp)
    jq ".${key} = ${value}" "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
}

# =============================================================================
# SECURITY
# =============================================================================

# Check if command matches security blocklist
is_security_blocked() {
    local command="$1"

    for pattern in "${SECURITY_BLOCKLIST[@]}"; do
        if echo "$command" | grep -qiE -e "$pattern"; then
            return 0  # Blocked
        fi
    done

    return 1  # Not blocked
}

# =============================================================================
# SATISFACTION DETECTION
# =============================================================================

# Check if text contains word with word boundaries
# Usage: _contains_word "$text" "$word"
_contains_word() {
    local text="$1"
    local word="$2"
    # Use grep with word boundaries for precise matching
    echo "$text" | grep -qiw "$word" 2>/dev/null
}

# Analyze text for satisfaction signals
# Returns: "positive", "negative", or "neutral"
detect_satisfaction() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local positive_count=0
    local negative_count=0

    # Check for positive signals (substring match is fine for multi-word phrases)
    for word in "${SATISFACTION_POSITIVE_WORDS[@]}"; do
        if [[ "$text_lower" == *"$word"* ]]; then
            ((positive_count++)) || true
        fi
    done

    # Check for negative signals (multi-word phrases)
    for word in "${SATISFACTION_NEGATIVE_WORDS[@]}"; do
        if [[ "$text_lower" == *"$word"* ]]; then
            ((negative_count++)) || true
        fi
    done

    # Check short negative words with word boundaries
    for word in "${SATISFACTION_NEGATIVE_SHORT[@]}"; do
        if _contains_word "$text_lower" "$word"; then
            ((negative_count++)) || true
        fi
    done

    # Determine overall sentiment
    if [[ $positive_count -gt 0 && $positive_count -gt $negative_count ]]; then
        echo "positive"
    elif [[ $negative_count -gt 0 && $negative_count -ge $positive_count ]]; then
        echo "negative"
    else
        echo "neutral"
    fi
}

# Get detailed satisfaction analysis
# Returns JSON with counts and detected signals
analyze_satisfaction() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local positive_matches=()
    local negative_matches=()

    # Find positive matches
    for word in "${SATISFACTION_POSITIVE_WORDS[@]}"; do
        if [[ "$text_lower" == *"$word"* ]]; then
            positive_matches+=("$word")
        fi
    done

    # Find negative matches (multi-word)
    for word in "${SATISFACTION_NEGATIVE_WORDS[@]}"; do
        if [[ "$text_lower" == *"$word"* ]]; then
            negative_matches+=("$word")
        fi
    done

    # Find negative matches (short words with boundaries)
    for word in "${SATISFACTION_NEGATIVE_SHORT[@]}"; do
        if _contains_word "$text_lower" "$word"; then
            negative_matches+=("$word")
        fi
    done

    local positive_count=${#positive_matches[@]}
    local negative_count=${#negative_matches[@]}
    local total=$((positive_count + negative_count))

    local sentiment="neutral"
    local score=0.5

    if [[ $total -gt 0 ]]; then
        if [[ $positive_count -gt $negative_count ]]; then
            sentiment="positive"
            score=$(echo "scale=2; $positive_count / $total" | bc)
        elif [[ $negative_count -gt $positive_count ]]; then
            sentiment="negative"
            score=$(echo "scale=2; $positive_count / $total" | bc)
        fi
    fi

    # Build JSON output
    local positive_json
    local negative_json

    if [[ ${#positive_matches[@]} -gt 0 ]]; then
        positive_json=$(printf '%s\n' "${positive_matches[@]}" | jq -R . | jq -s .)
    else
        positive_json="[]"
    fi

    if [[ ${#negative_matches[@]} -gt 0 ]]; then
        negative_json=$(printf '%s\n' "${negative_matches[@]}" | jq -R . | jq -s .)
    else
        negative_json="[]"
    fi

    jq -n \
        --arg sentiment "$sentiment" \
        --argjson score "$score" \
        --argjson positive_count "$positive_count" \
        --argjson negative_count "$negative_count" \
        --argjson positive_matches "$positive_json" \
        --argjson negative_matches "$negative_json" \
        '{
            sentiment: $sentiment,
            score: $score,
            positiveCount: $positive_count,
            negativeCount: $negative_count,
            positiveMatches: $positive_matches,
            negativeMatches: $negative_matches
        }'
}

# Log satisfaction signal for a session
log_satisfaction() {
    local session_id="$1"
    local sentiment="$2"  # positive, negative, or neutral
    local context="${3:-}"

    if ! is_feedback_enabled; then
        return
    fi

    init_feedback

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg session "$session_id" \
       --arg sentiment "$sentiment" \
       --arg context "$context" \
       --arg now "$now" '
        .updated = $now |
        .sessions[$session] = (
            .sessions[$session] // {
                "positive": 0,
                "negative": 0,
                "neutral": 0,
                "signals": [],
                "started": $now
            }
        ) |
        .sessions[$session][$sentiment] += 1 |
        .sessions[$session].signals += [{
            "type": $sentiment,
            "context": $context,
            "timestamp": $now
        }] |
        .sessions[$session].lastSignal = $now |
        # Update aggregate counts
        .aggregate.totalPositive += (if $sentiment == "positive" then 1 else 0 end) |
        .aggregate.totalNegative += (if $sentiment == "negative" then 1 else 0 end) |
        .aggregate.totalNeutral += (if $sentiment == "neutral" then 1 else 0 end) |
        # Calculate average score
        .aggregate.averageScore = (
            if (.aggregate.totalPositive + .aggregate.totalNegative) > 0
            then (.aggregate.totalPositive / (.aggregate.totalPositive + .aggregate.totalNegative))
            else 0.5
            end
        )
    ' "$SATISFACTION_FILE" > "$tmp_file" && mv "$tmp_file" "$SATISFACTION_FILE"
}

# Get session satisfaction score
# Returns a score from 0.0 (all negative) to 1.0 (all positive)
get_session_satisfaction() {
    local session_id="$1"

    if [[ ! -f "$SATISFACTION_FILE" ]]; then
        echo "0.5"
        return
    fi

    local positive negative
    positive=$(jq -r --arg s "$session_id" '.sessions[$s].positive // 0' "$SATISFACTION_FILE" 2>/dev/null || echo "0")
    negative=$(jq -r --arg s "$session_id" '.sessions[$s].negative // 0' "$SATISFACTION_FILE" 2>/dev/null || echo "0")

    local total=$((positive + negative))

    if [[ $total -eq 0 ]]; then
        echo "0.5"
        return
    fi

    echo "scale=2; $positive / $total" | bc
}

# Get satisfaction summary for reporting
get_satisfaction_summary() {
    init_feedback

    if [[ ! -f "$SATISFACTION_FILE" ]]; then
        echo "No satisfaction data available"
        return
    fi

    local total_positive total_negative total_neutral avg_score session_count
    total_positive=$(jq -r '.aggregate.totalPositive // 0' "$SATISFACTION_FILE" 2>/dev/null || echo "0")
    total_negative=$(jq -r '.aggregate.totalNegative // 0' "$SATISFACTION_FILE" 2>/dev/null || echo "0")
    total_neutral=$(jq -r '.aggregate.totalNeutral // 0' "$SATISFACTION_FILE" 2>/dev/null || echo "0")
    avg_score=$(jq -r '.aggregate.averageScore // 0.5' "$SATISFACTION_FILE" 2>/dev/null || echo "0.5")
    session_count=$(jq -r '.sessions | length' "$SATISFACTION_FILE" 2>/dev/null || echo "0")

    local total_signals=$((total_positive + total_negative + total_neutral))
    local satisfaction_pct
    if [[ $total_signals -gt 0 ]]; then
        satisfaction_pct=$(echo "scale=0; $avg_score * 100" | bc)
    else
        satisfaction_pct="50"
    fi

    # Determine satisfaction level indicator
    local indicator
    if [[ $satisfaction_pct -ge 80 ]]; then
        indicator="Excellent"
    elif [[ $satisfaction_pct -ge 60 ]]; then
        indicator="Good"
    elif [[ $satisfaction_pct -ge 40 ]]; then
        indicator="Mixed"
    elif [[ $satisfaction_pct -ge 20 ]]; then
        indicator="Needs improvement"
    else
        indicator="Poor"
    fi

    cat << EOF
Satisfaction Summary
────────────────────────────
Sessions tracked: ${session_count}
Total signals: ${total_signals}

Breakdown:
  Positive: ${total_positive}
  Negative: ${total_negative}
  Neutral: ${total_neutral}

Satisfaction Score: ${satisfaction_pct}% (${indicator})
EOF
}

# =============================================================================
# PERMISSION LEARNING
# =============================================================================

# Log a permission decision
log_permission() {
    local command="$1"
    local approved="$2"  # true or false

    if ! is_feedback_enabled; then
        return
    fi

    if [[ "$(get_preference 'learnFromApprovals')" != "true" ]]; then
        return
    fi

    init_feedback

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Normalize command for pattern matching
    local normalized
    normalized=$(echo "$command" | sed 's/[0-9]\+/N/g' | sed 's/"[^"]*"/"..."/g')

    local tmp_file
    tmp_file=$(mktemp)

    # Update patterns file
    jq --arg cmd "$normalized" --arg approved "$approved" --arg now "$now" '
        .updated = $now |
        .permissions[$cmd] = (
            .permissions[$cmd] // { "autoApprove": false, "confidence": 0, "samples": 0, "approvals": 0 }
        ) |
        .permissions[$cmd].samples += 1 |
        .permissions[$cmd].approvals += (if $approved == "true" then 1 else 0 end) |
        .permissions[$cmd].confidence = (.permissions[$cmd].approvals / .permissions[$cmd].samples) |
        .permissions[$cmd].lastSeen = $now |
        if .permissions[$cmd].samples >= 5 and .permissions[$cmd].confidence >= 0.9
        then .permissions[$cmd].autoApprove = true
        else .permissions[$cmd].autoApprove = false
        end
    ' "$PATTERNS_FILE" > "$tmp_file" && mv "$tmp_file" "$PATTERNS_FILE"
}

# Check if command should be auto-approved
should_auto_approve() {
    local command="$1"

    # Never auto-approve security-blocked commands
    if is_security_blocked "$command"; then
        return 1
    fi

    if ! is_feedback_enabled; then
        return 1
    fi

    if [[ ! -f "$PATTERNS_FILE" ]]; then
        return 1
    fi

    # Normalize command
    local normalized
    normalized=$(echo "$command" | sed 's/[0-9]\+/N/g' | sed 's/"[^"]*"/"..."/g')

    local auto_approve
    auto_approve=$(jq -r --arg cmd "$normalized" '.permissions[$cmd].autoApprove // false' "$PATTERNS_FILE" 2>/dev/null || echo "false")

    [[ "$auto_approve" == "true" ]]
}

# =============================================================================
# METRICS
# =============================================================================

# Log skill usage
log_skill_usage() {
    local skill_id="$1"
    local success="${2:-true}"
    local edits="${3:-0}"

    if ! is_feedback_enabled; then
        return
    fi

    init_feedback

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local today
    today=$(date +"%Y-%m-%d")

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg skill "$skill_id" --arg success "$success" --arg edits "$edits" --arg now "$now" --arg today "$today" '
        .updated = $now |
        .skills[$skill] = (
            .skills[$skill] // { "uses": 0, "successes": 0, "totalEdits": 0, "avgEdits": 0 }
        ) |
        .skills[$skill].uses += 1 |
        .skills[$skill].successes += (if $success == "true" then 1 else 0 end) |
        .skills[$skill].totalEdits += ($edits | tonumber) |
        .skills[$skill].avgEdits = (.skills[$skill].totalEdits / .skills[$skill].uses) |
        .skills[$skill].lastUsed = $today
    ' "$METRICS_FILE" > "$tmp_file" && mv "$tmp_file" "$METRICS_FILE"
}

# Log agent performance
log_agent_performance() {
    local agent_id="$1"
    local success="${2:-true}"
    local duration="${3:-0}"

    if ! is_feedback_enabled; then
        return
    fi

    init_feedback

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg agent "$agent_id" --arg success "$success" --arg duration "$duration" --arg now "$now" '
        .updated = $now |
        .agents[$agent] = (
            .agents[$agent] // { "spawns": 0, "successes": 0, "totalDuration": 0, "avgDuration": 0 }
        ) |
        .agents[$agent].spawns += 1 |
        .agents[$agent].successes += (if $success == "true" then 1 else 0 end) |
        .agents[$agent].totalDuration += ($duration | tonumber) |
        .agents[$agent].avgDuration = (.agents[$agent].totalDuration / .agents[$agent].spawns)
    ' "$METRICS_FILE" > "$tmp_file" && mv "$tmp_file" "$METRICS_FILE"
}

# =============================================================================
# REPORTING
# =============================================================================

# Get feedback status summary
get_feedback_status() {
    init_feedback

    local enabled
    enabled=$(get_preference "enabled" "true")
    local sharing
    sharing=$(get_preference "shareAnonymized" "false")
    local retention
    retention=$(get_preference "retentionDays" "90")

    local learned_count=0
    if [[ -f "$PATTERNS_FILE" ]]; then
        learned_count=$(jq '[.permissions | to_entries[] | select(.value.autoApprove == true)] | length' "$PATTERNS_FILE" 2>/dev/null || echo "0")
    fi

    local skill_count=0
    local agent_count=0
    if [[ -f "$METRICS_FILE" ]]; then
        skill_count=$(jq '.skills | length' "$METRICS_FILE" 2>/dev/null || echo "0")
        agent_count=$(jq '.agents | length' "$METRICS_FILE" 2>/dev/null || echo "0")
    fi

    local satisfaction_score="N/A"
    if [[ -f "$SATISFACTION_FILE" ]]; then
        local raw_score
        raw_score=$(jq -r '.aggregate.averageScore // 0.5' "$SATISFACTION_FILE" 2>/dev/null || echo "0.5")
        satisfaction_score=$(echo "scale=0; $raw_score * 100" | bc)%
    fi

    cat << EOF
Feedback System Status
────────────────────────────
Learning: $([ "$enabled" == "true" ] && echo "Enabled" || echo "Disabled")
Anonymous sharing: $([ "$sharing" == "true" ] && echo "Enabled" || echo "Disabled")
Data retention: ${retention} days

Learned Patterns: ${learned_count} auto-approve rules
Skills tracked: ${skill_count}
Agents tracked: ${agent_count}
Satisfaction: ${satisfaction_score}

Storage: ${FEEDBACK_DIR}
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f init_feedback
export -f is_feedback_enabled
export -f get_preference
export -f set_preference
export -f is_security_blocked
export -f log_permission
export -f should_auto_approve
export -f log_skill_usage
export -f log_agent_performance
export -f get_feedback_status
export -f detect_satisfaction
export -f analyze_satisfaction
export -f log_satisfaction
export -f get_session_satisfaction
export -f get_satisfaction_summary
export -f _contains_word