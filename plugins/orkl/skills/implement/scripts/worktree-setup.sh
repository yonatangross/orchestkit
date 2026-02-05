#!/usr/bin/env bash
#
# worktree-setup.sh - Create and cleanup git worktrees for feature development
#
# Usage:
#   ./worktree-setup.sh create <feature-name>   Create worktree and branch
#   ./worktree-setup.sh cleanup <feature-name>  Remove worktree safely
#   ./worktree-setup.sh list                    List all worktrees
#   ./worktree-setup.sh status <feature-name>   Check worktree status
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project root name for worktree naming
PROJECT_NAME=$(basename "$(git rev-parse --show-toplevel)")

usage() {
    echo "Usage: $0 <command> [feature-name]"
    echo ""
    echo "Commands:"
    echo "  create <name>   Create worktree with feature branch"
    echo "  cleanup <name>  Remove worktree (with safety checks)"
    echo "  list            List all worktrees"
    echo "  status <name>   Check worktree status"
    echo ""
    echo "Example:"
    echo "  $0 create user-auth"
    echo "  $0 cleanup user-auth"
    exit 1
}

create_worktree() {
    local feature_name="$1"
    local branch_name="feature/${feature_name}"
    local worktree_path="../${PROJECT_NAME}-${feature_name}"

    # Check if worktree already exists
    if git worktree list | grep -q "$worktree_path"; then
        echo -e "${YELLOW}Worktree already exists at $worktree_path${NC}"
        exit 1
    fi

    # Check if branch already exists
    if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
        echo -e "${YELLOW}Branch $branch_name already exists, using it${NC}"
        git worktree add "$worktree_path" "$branch_name"
    else
        echo -e "${GREEN}Creating new branch: $branch_name${NC}"
        git worktree add -b "$branch_name" "$worktree_path"
    fi

    echo ""
    echo -e "${GREEN}Worktree created successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  cd $worktree_path"
    echo "  # ... work on your feature ..."
    echo "  $0 cleanup $feature_name"
}

cleanup_worktree() {
    local feature_name="$1"
    local branch_name="feature/${feature_name}"
    local worktree_path="../${PROJECT_NAME}-${feature_name}"

    # Check if worktree exists
    if ! git worktree list | grep -q "$worktree_path"; then
        echo -e "${RED}Worktree not found at $worktree_path${NC}"
        exit 1
    fi

    # Check for uncommitted changes
    if [ -d "$worktree_path" ]; then
        pushd "$worktree_path" > /dev/null
        if ! git diff --quiet || ! git diff --cached --quiet; then
            echo -e "${RED}WARNING: Uncommitted changes detected!${NC}"
            echo ""
            git status --short
            echo ""
            read -p "Discard changes and remove worktree? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Aborting. Commit or stash your changes first."
                popd > /dev/null
                exit 1
            fi
        fi
        popd > /dev/null
    fi

    # Remove worktree
    echo "Removing worktree..."
    git worktree remove "$worktree_path" --force

    # Ask about branch deletion
    read -p "Delete branch $branch_name? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git branch -d "$branch_name" 2>/dev/null || \
        git branch -D "$branch_name"
        echo -e "${GREEN}Branch deleted${NC}"
    fi

    echo -e "${GREEN}Cleanup complete!${NC}"
}

list_worktrees() {
    echo "Current worktrees:"
    echo ""
    git worktree list
}

status_worktree() {
    local feature_name="$1"
    local worktree_path="../${PROJECT_NAME}-${feature_name}"

    if ! git worktree list | grep -q "$worktree_path"; then
        echo -e "${RED}Worktree not found at $worktree_path${NC}"
        exit 1
    fi

    echo "Worktree: $worktree_path"
    echo ""
    pushd "$worktree_path" > /dev/null
    echo "Branch: $(git branch --show-current)"
    echo "Status:"
    git status --short
    popd > /dev/null
}

# Main
if [ $# -lt 1 ]; then
    usage
fi

COMMAND="$1"

case "$COMMAND" in
    create)
        [ $# -lt 2 ] && usage
        create_worktree "$2"
        ;;
    cleanup)
        [ $# -lt 2 ] && usage
        cleanup_worktree "$2"
        ;;
    list)
        list_worktrees
        ;;
    status)
        [ $# -lt 2 ] && usage
        status_worktree "$2"
        ;;
    *)
        usage
        ;;
esac
