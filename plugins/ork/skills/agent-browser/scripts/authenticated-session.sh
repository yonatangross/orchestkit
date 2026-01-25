#!/bin/bash
# Template: Authenticated Session Management
# Login once, save state, reuse for subsequent sessions
#
# Usage:
#   ./authenticated-session.sh <app-url> [state-file]
#
# Setup:
#   1. Run once to see your form structure
#   2. Note the @refs for your fields
#   3. Update FORM_REFS section and set DISCOVERY_MODE=false

set -euo pipefail

APP_URL="${1:?Usage: $0 <app-url> [state-file]}"
STATE_FILE="${2:-$HOME/.config/agent-browser/auth-state.json}"

# ══════════════════════════════════════════════════════════════
# FORM_REFS: Update these after running discovery mode
# ══════════════════════════════════════════════════════════════
DISCOVERY_MODE=true        # Set to false after customizing refs
USERNAME_REF="@e1"         # Email/username input ref
PASSWORD_REF="@e2"         # Password input ref
SUBMIT_REF="@e3"           # Login button ref
SUCCESS_URL_PATTERN="**/dashboard"  # URL pattern after successful login
# ══════════════════════════════════════════════════════════════

# Ensure state directory exists
mkdir -p "$(dirname "$STATE_FILE")"

discover_form() {
    echo "Opening login page for discovery..."
    agent-browser open "$APP_URL/login"
    agent-browser wait --load networkidle

    echo ""
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│ LOGIN FORM STRUCTURE                                    │"
    echo "├─────────────────────────────────────────────────────────┤"
    agent-browser snapshot -i
    echo "└─────────────────────────────────────────────────────────┘"
    echo ""
    echo "Next steps:"
    echo "  1. Note refs: @e? = username, @e? = password, @e? = submit"
    echo "  2. Edit FORM_REFS section at top of this script"
    echo "  3. Set DISCOVERY_MODE=false"
    echo "  4. Set APP_USERNAME and APP_PASSWORD env vars"
    echo ""
    agent-browser close
}

login_flow() {
    echo "Performing login flow..."

    # Navigate to login page
    agent-browser open "$APP_URL/login"
    agent-browser wait --load networkidle

    # Get login form structure
    agent-browser snapshot -i

    # Fill credentials from environment (never hardcode!)
    if [[ -z "${APP_USERNAME:-}" ]] || [[ -z "${APP_PASSWORD:-}" ]]; then
        echo "Error: APP_USERNAME and APP_PASSWORD environment variables required"
        exit 1
    fi

    # Fill form using configured refs
    agent-browser fill "$USERNAME_REF" "$APP_USERNAME"
    agent-browser fill "$PASSWORD_REF" "$APP_PASSWORD"
    agent-browser click "$SUBMIT_REF"

    # Wait for successful login
    agent-browser wait --url "$SUCCESS_URL_PATTERN" --timeout 10000

    # Verify not still on login page
    CURRENT_URL=$(agent-browser get url)
    if [[ "$CURRENT_URL" == *"/login"* ]] || [[ "$CURRENT_URL" == *"/signin"* ]]; then
        echo "ERROR: Login failed - still on login page"
        agent-browser screenshot /tmp/login-failed.png
        agent-browser close
        exit 1
    fi

    # Save authenticated state
    agent-browser state save "$STATE_FILE"
    chmod 600 "$STATE_FILE"  # Restrict permissions

    echo "Login successful, state saved to: $STATE_FILE"
}

use_saved_session() {
    echo "Loading saved session..."

    if [[ ! -f "$STATE_FILE" ]]; then
        echo "No saved state found at: $STATE_FILE"
        return 1
    fi

    # Load saved state
    agent-browser state load "$STATE_FILE"

    # Navigate to authenticated page
    agent-browser open "$APP_URL/dashboard"
    agent-browser wait --load networkidle

    # Verify still authenticated (check for login redirect)
    CURRENT_URL=$(agent-browser get url)
    if [[ "$CURRENT_URL" == *"/login"* ]] || [[ "$CURRENT_URL" == *"/signin"* ]]; then
        echo "Session expired, re-authenticating..."
        rm -f "$STATE_FILE"
        return 1
    fi

    echo "Session restored successfully"
    return 0
}

# ══════════════════════════════════════════════════════════════
# MAIN FLOW
# ══════════════════════════════════════════════════════════════

# Discovery mode: run first to identify form refs
if [[ "$DISCOVERY_MODE" == "true" ]]; then
    discover_form
    exit 0
fi

# Production mode: use saved session or login
if ! use_saved_session; then
    login_flow
fi

# Now perform authenticated actions
echo "Performing authenticated actions..."
agent-browser snapshot -i

# Example: Navigate to protected pages
# agent-browser open "$APP_URL/settings"
# agent-browser open "$APP_URL/profile"

# Example: Extract authenticated content
# agent-browser get text body

# Cleanup (optional - keeps session for next run)
# agent-browser close

echo "Authenticated session ready"
