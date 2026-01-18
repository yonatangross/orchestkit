#!/bin/bash
# Template: Authenticated Session Management
# Login once, save state, reuse for subsequent sessions

set -euo pipefail

APP_URL="${1:?Usage: $0 <app-url> [state-file]}"
STATE_FILE="${2:-$HOME/.config/agent-browser/auth-state.json}"

# Ensure state directory exists
mkdir -p "$(dirname "$STATE_FILE")"

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

    # Modify refs based on your app's login form
    agent-browser fill @e1 "$APP_USERNAME"    # Username/email field
    agent-browser fill @e2 "$APP_PASSWORD"    # Password field
    agent-browser click @e3                    # Login button

    # Wait for successful login
    agent-browser wait --url "**/dashboard" --timeout 10000

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
    if [[ "$CURRENT_URL" == *"/login"* ]]; then
        echo "Session expired, re-authenticating..."
        rm -f "$STATE_FILE"
        return 1
    fi

    echo "Session restored successfully"
    return 0
}

# Main flow
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
