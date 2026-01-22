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
    [[ "$QUIET" == "false" ]] && echo "$@"
}

errors=0

# Validate: Each skill symlink in plugins points to existing root skill
log "Checking plugin skill symlinks..."
for plugin_dir in "$PROJECT_ROOT"/plugins/*/skills; do
    [[ -d "$plugin_dir" ]] || continue

    plugin_name=$(basename "$(dirname "$plugin_dir")")

    for skill_link in "$plugin_dir"/*; do
        [[ -e "$skill_link" ]] || continue
        skill_name=$(basename "$skill_link")

        if [[ -L "$skill_link" ]]; then
            target=$(readlink "$skill_link")
            # Resolve relative symlink
            if [[ ! "$target" =~ ^/ ]]; then
                target=$(cd "$plugin_dir" && cd "$(dirname "$target")" && pwd)/$(basename "$target")
            fi

            if [[ ! -d "$target" ]]; then
                echo "ERROR: Broken symlink in $plugin_name: $skill_name -> $target"
                ((errors++))
            fi
        fi
    done
done

# Check orphans: Skills in root that aren't in any plugin
if [[ "$CHECK_ORPHANS" == "true" ]]; then
    log "Checking for orphan skills..."
    for skill_dir in "$PROJECT_ROOT"/skills/*/; do
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
