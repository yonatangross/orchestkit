#!/usr/bin/env bash
# Context Pruning Advisor - UserPromptSubmit Hook
# Recommends context pruning when usage exceeds 70%
#
# Analyzes loaded context (skills, files, agent outputs) and scores by:
# - Recency: How recently was it accessed? (0-10 points)
# - Frequency: How often accessed this session? (0-10 points)
# - Relevance: How related to current prompt? (0-10 points)
#
# Total score: 0-30 points
# Pruning threshold: Items with score < 10 are candidates
#
# Version: 1.0.0
# Issue: #126
# Algorithm: .claude/docs/context-pruning-algorithm.md

set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common helpers
source "${SCRIPT_DIR}/../_lib/common.sh"

# Configuration
CONTEXT_TRIGGER=0.70        # Trigger at 70% context usage
CONTEXT_CRITICAL=0.95       # Critical threshold (skip analysis, immediate warning)
PRUNE_THRESHOLD_HIGH=8      # Score 0-8: High priority pruning
PRUNE_THRESHOLD_MED=15      # Score 9-15: Medium priority pruning
MAX_RECOMMENDATIONS=5       # Limit recommendations to top 5 candidates

# Session-specific state file
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
STATE_FILE="/tmp/claude-context-tracking-${SESSION_ID}.json"
LOG_FILE="$PROJECT_ROOT/logs/context-pruning.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# ============================================================================
# SCORING ALGORITHM
# ============================================================================

# Calculate recency score (0-10) based on time since last access
# Arguments: $1 = last_accessed timestamp (ISO-8601 or epoch seconds)
calculate_recency_score() {
    local last_accessed="$1"
    local current_time
    current_time=$(date +%s)

    # Convert ISO-8601 to epoch if needed
    local last_epoch
    if [[ "$last_accessed" =~ ^[0-9]+$ ]]; then
        last_epoch="$last_accessed"
    else
        last_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_accessed" +%s 2>/dev/null || echo "$current_time")
    fi

    local age_seconds=$((current_time - last_epoch))
    local age_minutes=$((age_seconds / 60))

    # Scoring tiers (see algorithm doc)
    if [[ $age_minutes -le 5 ]]; then
        echo 10  # Last 5 minutes: actively being used
    elif [[ $age_minutes -le 15 ]]; then
        echo 8   # Last 15 minutes: very recent
    elif [[ $age_minutes -le 30 ]]; then
        echo 6   # Last 30 minutes: recent
    elif [[ $age_minutes -le 60 ]]; then
        echo 4   # Last hour: somewhat recent
    elif [[ $age_minutes -le 120 ]]; then
        echo 2   # Last 2 hours: aging out
    else
        echo 0   # Older than 2 hours: stale
    fi
}

# Calculate frequency score (0-10) based on access count
# Arguments: $1 = access_count
calculate_frequency_score() {
    local count="$1"

    if [[ $count -ge 10 ]]; then
        echo 10  # 10+ accesses: heavily used
    elif [[ $count -ge 7 ]]; then
        echo 8   # 7-9 accesses: frequently used
    elif [[ $count -ge 4 ]]; then
        echo 6   # 4-6 accesses: moderately used
    elif [[ $count -ge 2 ]]; then
        echo 4   # 2-3 accesses: occasionally used
    elif [[ $count -ge 1 ]]; then
        echo 2   # 1 access: barely used
    else
        echo 0   # 0 accesses: unused
    fi
}

# Calculate relevance score (0-10) based on keyword overlap
# Arguments: $1 = item tags/keywords (comma-separated)
#            $2 = prompt keywords (comma-separated)
calculate_relevance_score() {
    local item_keywords="$1"
    local prompt_keywords="$2"

    # Handle empty cases
    if [[ -z "$item_keywords" || -z "$prompt_keywords" ]]; then
        echo 2  # Generic/infrastructure default
        return
    fi

    # Convert to arrays
    IFS=',' read -ra item_array <<< "$item_keywords"
    IFS=',' read -ra prompt_array <<< "$prompt_keywords"

    # Count overlapping keywords (use tr for Bash 3.2 compatibility)
    local overlap=0
    for item_kw in "${item_array[@]}"; do
        local item_kw_lower
        item_kw_lower=$(echo "$item_kw" | tr '[:upper:]' '[:lower:]')
        for prompt_kw in "${prompt_array[@]}"; do
            local prompt_kw_lower
            prompt_kw_lower=$(echo "$prompt_kw" | tr '[:upper:]' '[:lower:]')
            if [[ "$item_kw_lower" == "$prompt_kw_lower" ]]; then
                ((overlap++))
            fi
        done
    done

    # Calculate overlap ratio
    local total_item=${#item_array[@]}
    local overlap_ratio=0
    if [[ $total_item -gt 0 ]]; then
        overlap_ratio=$(echo "scale=2; $overlap / $total_item" | bc)
    fi

    # Scoring based on overlap ratio
    if (( $(echo "$overlap_ratio >= 0.75" | bc -l) )); then
        echo 10  # Direct keyword match (75%+ overlap)
    elif (( $(echo "$overlap_ratio >= 0.50" | bc -l) )); then
        echo 8   # Related skills/patterns (50%+ overlap)
    elif (( $(echo "$overlap_ratio >= 0.30" | bc -l) )); then
        echo 6   # Same technology stack (30%+ overlap)
    elif (( $(echo "$overlap_ratio >= 0.15" | bc -l) )); then
        echo 4   # Same architectural layer (15%+ overlap)
    elif [[ $overlap -gt 0 ]]; then
        echo 2   # Some overlap (generic/infrastructure)
    else
        echo 0   # Unrelated
    fi
}

# ============================================================================
# CONTEXT TRACKING
# ============================================================================

# Initialize context tracking state file
initialize_state() {
    if [[ ! -f "$STATE_FILE" ]]; then
        log "Initializing context tracking state for session $SESSION_ID"
        jq -n \
            --arg session_id "$SESSION_ID" \
            --arg ts "$(date -Iseconds)" \
            '{
                session_id: $session_id,
                updated_at: $ts,
                total_context_tokens: 0,
                context_budget: 12000,
                items: [],
                pruning_recommendations: []
            }' > "$STATE_FILE"
    fi
}

# Extract keywords from user prompt
# Arguments: $1 = user prompt text
extract_prompt_keywords() {
    local prompt="$1"

    # Convert to lowercase, extract words, remove common stopwords
    echo "$prompt" | \
        tr '[:upper:]' '[:lower:]' | \
        grep -oE '\b[a-z]{3,}\b' | \
        grep -vE '^(the|and|for|with|from|that|this|have|will|can|should|would|could)$' | \
        head -20 | \
        tr '\n' ',' | \
        sed 's/,$//'
}

# Get estimated context usage percentage
get_context_usage_percentage() {
    # Try to get from CC environment variable (if available)
    local context_percent="${CLAUDE_CONTEXT_USAGE_PERCENT:-0}"

    # Fallback: estimate from state file
    if [[ "$context_percent" -eq 0 && -f "$STATE_FILE" ]]; then
        local current_tokens
        local budget
        current_tokens=$(jq -r '.total_context_tokens // 0' "$STATE_FILE")
        budget=$(jq -r '.context_budget // 12000' "$STATE_FILE")

        if [[ $budget -gt 0 ]]; then
            context_percent=$(echo "scale=2; $current_tokens / $budget" | bc)
        fi
    fi

    echo "$context_percent"
}

# Update context item in state file
# Arguments: $1 = item id, $2 = access timestamp
update_item_access() {
    local item_id="$1"
    local timestamp="$2"

    if [[ ! -f "$STATE_FILE" ]]; then
        return
    fi

    # Update last_accessed and increment access_count
    jq --arg id "$item_id" \
       --arg ts "$timestamp" \
       '(.items[] | select(.id == $id) | .last_accessed) = $ts |
        (.items[] | select(.id == $id) | .access_count) += 1 |
        .updated_at = $ts' \
       "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
}

# ============================================================================
# ANALYSIS & RECOMMENDATIONS
# ============================================================================

# Analyze context and generate pruning recommendations
# Arguments: $1 = prompt keywords (comma-separated)
analyze_and_recommend() {
    local prompt_keywords="$1"
    local current_time
    current_time=$(date -Iseconds)

    if [[ ! -f "$STATE_FILE" ]]; then
        log "No state file found, skipping analysis"
        return
    fi

    # Read all items from state file
    local items_json
    items_json=$(jq -c '.items[]' "$STATE_FILE" 2>/dev/null || echo "")

    if [[ -z "$items_json" ]]; then
        log "No context items to analyze"
        return
    fi

    # Score each item and collect candidates
    local candidates=()

    while IFS= read -r item; do
        local item_id
        local last_accessed
        local access_count
        local keywords

        item_id=$(echo "$item" | jq -r '.id')
        last_accessed=$(echo "$item" | jq -r '.last_accessed // .loaded_at')
        access_count=$(echo "$item" | jq -r '.access_count // 0')
        keywords=$(echo "$item" | jq -r '.tags // [] | join(",")' 2>/dev/null || echo "")

        # Calculate scores
        local recency_score
        local frequency_score
        local relevance_score
        local total_score

        recency_score=$(calculate_recency_score "$last_accessed")
        frequency_score=$(calculate_frequency_score "$access_count")
        relevance_score=$(calculate_relevance_score "$keywords" "$prompt_keywords")
        total_score=$((recency_score + frequency_score + relevance_score))

        log "Scored $item_id: R=$recency_score F=$frequency_score V=$relevance_score Total=$total_score"

        # Add to candidates if below threshold
        if [[ $total_score -le $PRUNE_THRESHOLD_MED ]]; then
            local priority
            if [[ $total_score -le $PRUNE_THRESHOLD_HIGH ]]; then
                priority="HIGH"
            else
                priority="MED"
            fi

            local estimated_tokens
            estimated_tokens=$(echo "$item" | jq -r '.estimated_tokens // 500')

            candidates+=("$total_score|$priority|$item_id|$estimated_tokens")
        fi
    done <<< "$items_json"

    # Sort candidates by score (ascending) and limit to top N
    local sorted_candidates
    sorted_candidates=$(printf '%s\n' "${candidates[@]}" | sort -t'|' -k1 -n | head -n "$MAX_RECOMMENDATIONS")

    # Build recommendation message
    if [[ -n "$sorted_candidates" ]]; then
        build_recommendation_message "$sorted_candidates"
    else
        log "No pruning candidates found (all context relevant)"
    fi
}

# Build recommendation message for additionalContext
# Arguments: $1 = sorted candidates (newline-separated)
build_recommendation_message() {
    local candidates="$1"
    local total_savings=0
    local msg="⚠️ Context usage >70%. Pruning recommendations:\n"
    local count=0

    while IFS='|' read -r score priority item_id tokens; do
        ((count++))
        total_savings=$((total_savings + tokens))

        # Format item name for display
        local display_name
        display_name=$(echo "$item_id" | sed 's/^skill://' | sed 's/^file://' | sed 's/^agent://')

        msg+="  $count. [$priority] $display_name (score: $score, saves ~${tokens}t)\n"
    done <<< "$candidates"

    msg+="\nPotential savings: ~${total_savings} tokens"
    msg+="\nTo prune: Archive or unload low-scoring context items."

    # Output via additionalContext
    log "Recommending $count pruning candidates (potential savings: $total_savings tokens)"
    output_with_context "$(echo -e "$msg")"
}

# ============================================================================
# MAIN LOGIC
# ============================================================================

main() {
    # Initialize state file if needed
    initialize_state

    # Get current context usage
    local context_usage
    context_usage=$(get_context_usage_percentage)

    log "Context usage: $context_usage (trigger threshold: $CONTEXT_TRIGGER)"

    # Fast exit: Context usage below threshold
    if (( $(echo "$context_usage < $CONTEXT_TRIGGER" | bc -l) )); then
        log "Context usage within limits, no pruning needed"
        # Output silent success (suppressOutput:true, no user-visible output)
        output_silent_success
        exit 0
    fi

    # Critical path: Context usage at critical level (>95%)
    if (( $(echo "$context_usage >= $CONTEXT_CRITICAL" | bc -l) )); then
        log "CRITICAL: Context usage at ${context_usage}% (>95%)"
        local critical_msg="🚨 CRITICAL: Context usage at ${context_usage}% (>95%). Use /ork:context-compression immediately or manually archive old decisions and patterns."
        output_with_context "$critical_msg"
        exit 0
    fi

    # Extract keywords from current prompt
    local user_prompt
    user_prompt=$(get_field '.prompt' 2>/dev/null || echo "")

    if [[ -z "$user_prompt" ]]; then
        log "No user prompt found in hook input, skipping analysis"
        output_silent_success
        exit 0
    fi

    local prompt_keywords
    prompt_keywords=$(extract_prompt_keywords "$user_prompt")
    log "Extracted prompt keywords: $prompt_keywords"

    # Analyze context and generate recommendations
    analyze_and_recommend "$prompt_keywords"
}

# Execute main
main
