#!/bin/bash
# sync-skills.sh - Validate skill symlinks between root and plugins
# Usage: sync-skills.sh validate [--quiet] [--check-orphans]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

QUIET=false
CHECK_ORPHANS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        validate) shift ;;
        --quiet) QUIET=true; shift ;;
        --check-orphans) CHECK_ORPHANS=true; shift ;;
        *) shift ;;
    esac
done

log() {
    [[ "$QUIET" == "false" ]] && echo "$@" || true
}

errors=0
checked=0

# Validate: Each skill in plugins points to existing root skill
log "Checking plugin skill symlinks..."

# Check if any plugins exist
plugin_count=$(find "$PROJECT_ROOT/plugins" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
if [[ "$plugin_count" -eq 0 ]]; then
    log "No plugins found, skipping validation"
    exit 0
fi

for plugin_dir in "$PROJECT_ROOT"/plugins/*/skills; do
    [[ -d "$plugin_dir" ]] || continue

    plugin_name=$(basename "$(dirname "$plugin_dir")")

    for skill_link in "$plugin_dir"/*; do
        [[ -e "$skill_link" || -L "$skill_link" ]] || continue
        skill_name=$(basename "$skill_link")
        checked=$((checked + 1))

        if [[ -L "$skill_link" ]]; then
            # It's a symlink - check if target exists
            target=$(readlink "$skill_link" 2>/dev/null || echo "")
            if [[ -z "$target" ]]; then
                echo "ERROR: Cannot read symlink in $plugin_name: $skill_name"
                errors=$((errors + 1))
                continue
            fi

            # Resolve relative symlink
            if [[ ! "$target" =~ ^/ ]]; then
                resolved_target=$(cd "$plugin_dir" && cd "$(dirname "$target")" 2>/dev/null && pwd)/$(basename "$target") || resolved_target=""
            else
                resolved_target="$target"
            fi

            if [[ -z "$resolved_target" || ! -d "$resolved_target" ]]; then
                echo "ERROR: Broken symlink in $plugin_name: $skill_name -> $target"
                errors=$((errors + 1))
            fi
        else
            # It's a directory (CI might convert symlinks to directories)
            # Just verify the corresponding root skill exists
            if [[ ! -d "$PROJECT_ROOT/src/skills/$skill_name" ]]; then
                echo "ERROR: Plugin skill $plugin_name/$skill_name has no corresponding root skill"
                errors=$((errors + 1))
            fi
        fi
    done
done

log "Checked $checked skill entries"

# Check orphans: Skills in root that aren't in any plugin
if [[ "$CHECK_ORPHANS" == "true" ]]; then
    log "Checking for orphan skills..."
    for skill_dir in "$PROJECT_ROOT"/src/skills/*/; do
        [[ -d "$skill_dir" ]] || continue
        skill_name=$(basename "$skill_dir")

        found=false
        for plugin_skills in "$PROJECT_ROOT"/plugins/*/skills; do
            if [[ -e "$plugin_skills/$skill_name" ]]; then
                found=true
                break
            fi
        done

        if [[ "$found" == "false" ]]; then
            log "WARNING: Orphan skill not in any plugin: $skill_name"
            # Don't fail on orphans, just warn
        fi
    done
fi

if [[ $errors -gt 0 ]]; then
    echo "FAILED: Found $errors broken skill symlinks"
    exit 1
fi

log "Skill sync validation passed!"
exit 0
