#!/bin/bash
# ============================================================================
# CI Environment Setup Script
# ============================================================================
# Standardized setup for GitHub Actions runners
# Handles unreliable third-party package mirrors gracefully
#
# Usage: ./bin/ci-setup.sh [--with-shellcheck]
#
# Industry best practices (2026):
# - Remove unused third-party repos before apt-get update
# - Fail gracefully on mirror issues
# - Centralize dependency installation
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[CI-SETUP]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[CI-SETUP]${NC} $1"; }
log_error() { echo -e "${RED}[CI-SETUP]${NC} $1"; }

# ============================================================================
# MAIN SETUP
# ============================================================================

main() {
    local with_shellcheck=false

    # Parse arguments
    for arg in "$@"; do
        case $arg in
            --with-shellcheck)
                with_shellcheck=true
                ;;
        esac
    done

    log_info "Starting CI environment setup..."

    # Only run apt-get on Linux
    if [[ "$(uname)" == "Linux" ]]; then
        setup_linux "$with_shellcheck"
    elif [[ "$(uname)" == "Darwin" ]]; then
        setup_macos "$with_shellcheck"
    else
        log_warn "Unknown OS: $(uname), skipping package setup"
    fi

        # Build TypeScript hooks (required for tests that use TypeScript hooks)
    build_typescript_hooks

    log_info "CI environment setup complete!"
}

# ============================================================================
# TYPESCRIPT HOOKS BUILD
# ============================================================================

build_typescript_hooks() {
    log_info "Building TypeScript hooks..."

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_warn "Node.js not found, skipping TypeScript hook build"
        return 0
    fi

    local hooks_dir
    hooks_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/hooks"

    if [[ ! -d "$hooks_dir" ]]; then
        log_warn "Hooks directory not found at $hooks_dir, skipping build"
        return 0
    fi

    # Check if package.json exists
    if [[ ! -f "$hooks_dir/package.json" ]]; then
        log_warn "No package.json in hooks directory, skipping build"
        return 0
    fi

    # Install dependencies and build
    pushd "$hooks_dir" > /dev/null

    log_info "Installing hook dependencies..."
    npm ci --silent 2>/dev/null || npm install --silent

    log_info "Building hook bundle..."
    if npm run build --silent; then
        log_info "TypeScript hooks built successfully"
        # Verify the bundle was created
        if [[ -f "dist/hooks.mjs" ]]; then
            log_info "Hook bundle verified: dist/hooks.mjs ($(du -h dist/hooks.mjs | cut -f1))"
        else
            log_warn "Hook bundle not found after build"
        fi
    else
        log_warn "Hook build failed, some tests may fail"
    fi

    popd > /dev/null
}

# ============================================================================
# LINUX SETUP (Ubuntu GitHub Runners)
# ============================================================================

setup_linux() {
    local with_shellcheck="$1"

    log_info "Configuring Linux environment..."

    # Remove unreliable third-party repos we don't need
    # These come pre-installed on GitHub runners and can cause 403 errors
    log_info "Removing unused third-party package sources..."

    local repos_to_remove=(
        "/etc/apt/sources.list.d/microsoft-prod.list"
        "/etc/apt/sources.list.d/azure-cli.list"
        "/etc/apt/sources.list.d/github_git-lfs.list"
        "/etc/apt/sources.list.d/mono-official-stable.list"
    )

    for repo in "${repos_to_remove[@]}"; do
        if [[ -f "$repo" ]]; then
            sudo rm -f "$repo" && log_info "Removed: $repo"
        fi
    done

    # Update package lists (Ubuntu official repos only now)
    log_info "Updating package lists..."
    if ! sudo apt-get update -qq; then
        log_warn "apt-get update had issues, continuing anyway..."
    fi

    # Install required dependencies
    log_info "Installing dependencies..."
    local packages=("jq")

    if [[ "$with_shellcheck" == "true" ]]; then
        packages+=("shellcheck")
    fi

    sudo apt-get install -y -qq "${packages[@]}"

    log_info "Linux setup complete"
}

# ============================================================================
# MACOS SETUP
# ============================================================================

setup_macos() {
    local with_shellcheck="$1"

    log_info "Configuring macOS environment..."

    # Check if Homebrew is available
    if ! command -v brew &> /dev/null; then
        log_error "Homebrew not found. Please install Homebrew first."
        exit 1
    fi

    # Install dependencies
    log_info "Installing dependencies via Homebrew..."
    brew install jq

    if [[ "$with_shellcheck" == "true" ]]; then
        brew install shellcheck
    fi

    log_info "macOS setup complete"
}

# Run main
main "$@"
