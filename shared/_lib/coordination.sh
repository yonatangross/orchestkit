#!/bin/bash
# Coordination Library for Multi-Instance Claude Code
# Provides functions for file locking, heartbeat, and instance management
#
# Version: 1.0.0
# Part of OrchestKit Multi-Worktree Coordination System

# Get the coordination directory
get_coordination_dir() {
    local script_dir="${BASH_SOURCE[0]%/*}"
    local project_root="${script_dir}/../.."
    echo "$project_root/coordination"
}

# Get current instance ID (from .claude-local or generate)
get_instance_id() {
    local local_dir="${PWD}/.claude-local"

    if [[ -f "$local_dir/instance-id.txt" ]]; then
        cat "$local_dir/instance-id.txt"
    else
        # Generate based on worktree path hash
        echo "cc-$(echo "$PWD" | md5sum 2>/dev/null | cut -c1-8 || echo "default")"
    fi
}

# Read registry with file locking
read_registry() {
    local coord_dir=$(get_coordination_dir)
    local registry="$coord_dir/registry.json"

    if [[ -f "$registry" ]]; then
        cat "$registry"
    else
        echo '{"instances":{},"file_locks":{},"decisions_log":[]}'
    fi
}

# Write registry atomically
write_registry() {
    local coord_dir=$(get_coordination_dir)
    local registry="$coord_dir/registry.json"
    local content="$1"

    # Atomic write using temp file
    local tmp="${registry}.tmp.$$"
    echo "$content" > "$tmp"
    mv "$tmp" "$registry"
}

# Check if a file is locked by another instance
is_file_locked() {
    local file_path="$1"
    local instance_id=$(get_instance_id)
    local registry=$(read_registry)

    # Normalize path (relative to project root)
    local normalized_path=$(normalize_path "$file_path")

    # Check if locked
    local lock_holder=$(echo "$registry" | jq -r --arg path "$normalized_path" \
        '.file_locks[$path].instance_id // empty')

    if [[ -n "$lock_holder" && "$lock_holder" != "$instance_id" ]]; then
        # Check if lock holder is stale
        if is_instance_stale "$lock_holder"; then
            # Clean up stale lock
            release_file_lock "$normalized_path" "$lock_holder"
            echo "false"
        else
            echo "true|$lock_holder"
        fi
    else
        echo "false"
    fi
}

# Acquire lock on a file
acquire_file_lock() {
    local file_path="$1"
    local reason="${2:-editing}"
    local instance_id=$(get_instance_id)
    local coord_dir=$(get_coordination_dir)

    local normalized_path=$(normalize_path "$file_path")
    local registry=$(read_registry)
    local now=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S%z)

    # Update registry with new lock
    local updated=$(echo "$registry" | jq \
        --arg path "$normalized_path" \
        --arg id "$instance_id" \
        --arg time "$now" \
        --arg reason "$reason" \
        '.file_locks[$path] = {
            instance_id: $id,
            acquired_at: $time,
            reason: $reason
        } |
        .instances[$id].files_locked = (
            (.instances[$id].files_locked // []) + [$path] | unique
        )')

    write_registry "$updated"
    echo "locked"
}

# Release lock on a file
release_file_lock() {
    local file_path="$1"
    local force_instance="${2:-}"
    local instance_id="${force_instance:-$(get_instance_id)}"

    local normalized_path=$(normalize_path "$file_path")
    local registry=$(read_registry)

    local updated=$(echo "$registry" | jq \
        --arg path "$normalized_path" \
        --arg id "$instance_id" \
        'del(.file_locks[$path]) |
        .instances[$id].files_locked = (
            (.instances[$id].files_locked // []) - [$path]
        )')

    write_registry "$updated"
}

# Check if an instance is stale (no heartbeat for > threshold)
is_instance_stale() {
    local check_instance_id="$1"
    local registry=$(read_registry)
    local threshold=$(echo "$registry" | jq -r '._meta.stale_threshold_seconds // 300')

    local last_heartbeat=$(echo "$registry" | jq -r \
        --arg id "$check_instance_id" \
        '.instances[$id].last_heartbeat // empty')

    if [[ -z "$last_heartbeat" ]]; then
        echo "true"
        return
    fi

    # Calculate age
    local now=$(date +%s)
    local hb_epoch

    # macOS compatible date parsing
    if [[ "$(uname)" == "Darwin" ]]; then
        hb_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${last_heartbeat%%[+-]*}" +%s 2>/dev/null || echo 0)
    else
        hb_epoch=$(date -d "$last_heartbeat" +%s 2>/dev/null || echo 0)
    fi

    local age=$((now - hb_epoch))

    if [[ $age -gt $threshold ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Update heartbeat for current instance
update_heartbeat() {
    local instance_id=$(get_instance_id)
    local registry=$(read_registry)
    local now=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S%z)

    local updated=$(echo "$registry" | jq \
        --arg id "$instance_id" \
        --arg time "$now" \
        'if .instances[$id] then
            .instances[$id].last_heartbeat = $time
        else
            .
        end')

    write_registry "$updated"
}

# Register current instance
register_instance() {
    local task="${1:-}"
    local instance_id=$(get_instance_id)
    local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    local worktree=$(pwd)
    local now=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S%z)

    local registry=$(read_registry)

    local updated=$(echo "$registry" | jq \
        --arg id "$instance_id" \
        --arg worktree "$worktree" \
        --arg branch "$branch" \
        --arg task "$task" \
        --arg time "$now" \
        '.instances[$id] = {
            worktree: $worktree,
            branch: $branch,
            task: (if $task == "" then null else $task end),
            files_locked: [],
            started: $time,
            last_heartbeat: $time
        }')

    write_registry "$updated"
    echo "$instance_id"
}

# Unregister current instance and release all locks
unregister_instance() {
    local instance_id=$(get_instance_id)
    local registry=$(read_registry)

    # Get files locked by this instance
    local locked_files=$(echo "$registry" | jq -r \
        --arg id "$instance_id" \
        '.instances[$id].files_locked // [] | .[]')

    # Remove all locks and the instance
    local updated=$(echo "$registry" | jq \
        --arg id "$instance_id" \
        'del(.instances[$id]) |
        .file_locks = (.file_locks | to_entries | map(select(.value.instance_id != $id)) | from_entries)')

    write_registry "$updated"
}

# Log a decision
log_decision() {
    local decision="$1"
    local rationale="${2:-}"
    local affected_files="${3:-}"
    local instance_id=$(get_instance_id)
    local now=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S%z)
    local dec_id="dec-$(date +%s)-$(openssl rand -hex 2 2>/dev/null || echo $$)"

    local registry=$(read_registry)

    # Parse affected files as JSON array if provided
    local files_json="[]"
    if [[ -n "$affected_files" ]]; then
        files_json=$(echo "$affected_files" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; ""))')
    fi

    local updated=$(echo "$registry" | jq \
        --arg id "$dec_id" \
        --arg instance "$instance_id" \
        --arg decision "$decision" \
        --arg rationale "$rationale" \
        --argjson files "$files_json" \
        --arg time "$now" \
        '.decisions_log += [{
            id: $id,
            instance_id: $instance,
            decision: $decision,
            rationale: $rationale,
            affected_files: $files,
            timestamp: $time
        }]')

    write_registry "$updated"
    echo "$dec_id"
}

# Get lock info for a file
get_lock_info() {
    local file_path="$1"
    local normalized_path=$(normalize_path "$file_path")
    local registry=$(read_registry)

    echo "$registry" | jq --arg path "$normalized_path" '.file_locks[$path] // null'
}

# Get instance info
get_instance_info() {
    local check_instance_id="${1:-$(get_instance_id)}"
    local registry=$(read_registry)

    echo "$registry" | jq --arg id "$check_instance_id" '.instances[$id] // null'
}

# List all active instances
list_instances() {
    local registry=$(read_registry)
    echo "$registry" | jq '.instances'
}

# Normalize file path (relative to project root)
normalize_path() {
    local file_path="$1"
    local project_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

    # If absolute path, make relative
    if [[ "$file_path" == /* ]]; then
        echo "${file_path#$project_root/}"
    else
        echo "$file_path"
    fi
}

# Clean up stale instances and their locks
cleanup_stale_instances() {
    local registry=$(read_registry)
    local threshold=$(echo "$registry" | jq -r '._meta.stale_threshold_seconds // 300')
    local now=$(date +%s)
    local cleaned=0

    # Get all instance IDs
    local instances=$(echo "$registry" | jq -r '.instances | keys[]')

    for instance_id in $instances; do
        if [[ $(is_instance_stale "$instance_id") == "true" ]]; then
            # Remove instance and its locks
            registry=$(echo "$registry" | jq \
                --arg id "$instance_id" \
                'del(.instances[$id]) |
                .file_locks = (.file_locks | to_entries | map(select(.value.instance_id != $id)) | from_entries)')
            cleaned=$((cleaned + 1))
        fi
    done

    if [[ $cleaned -gt 0 ]]; then
        write_registry "$registry"
        echo "Cleaned up $cleaned stale instance(s)"
    fi
}
