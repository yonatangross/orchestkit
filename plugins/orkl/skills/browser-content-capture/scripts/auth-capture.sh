#!/bin/bash
# Template: Authenticated Content Capture
# Captures content from login-protected pages using agent-browser

set -euo pipefail

LOGIN_URL="${1:?Usage: $0 <login-url> <target-url> [state-file]}"
TARGET_URL="${2:?Usage: $0 <login-url> <target-url> [state-file]}"
STATE_FILE="${3:-/tmp/auth-state.json}"

# Check for credentials
if [[ -z "${APP_USERNAME:-}" ]] || [[ -z "${APP_PASSWORD:-}" ]]; then
    echo "Error: APP_USERNAME and APP_PASSWORD environment variables required"
    exit 1
fi

# Function to perform login
do_login() {
    echo "Performing login at: $LOGIN_URL"

    agent-browser open "$LOGIN_URL"
    agent-browser wait --load networkidle

    # Get form structure
    echo "Form structure:"
    agent-browser snapshot -i

    # Fill credentials (modify refs based on your app)
    agent-browser fill @e1 "$APP_USERNAME"
    agent-browser fill @e2 "$APP_PASSWORD"

    # Submit
    agent-browser click @e3

    # Wait for successful login
    agent-browser wait --url "**/dashboard" --timeout 30000

    # Save state for reuse
    agent-browser state save "$STATE_FILE"
    chmod 600 "$STATE_FILE"

    echo "Login successful, state saved to: $STATE_FILE"
}

# Function to use saved state
use_saved_state() {
    if [[ ! -f "$STATE_FILE" ]]; then
        return 1
    fi

    echo "Loading saved state from: $STATE_FILE"
    agent-browser state load "$STATE_FILE"

    # Navigate to target to verify auth is valid
    agent-browser open "$TARGET_URL"
    agent-browser wait --load networkidle

    # Check if we got redirected to login
    CURRENT_URL=$(agent-browser get url)
    if [[ "$CURRENT_URL" == *"/login"* ]]; then
        echo "Session expired, re-authenticating..."
        rm -f "$STATE_FILE"
        return 1
    fi

    echo "State restored successfully"
    return 0
}

# Main flow
if ! use_saved_state; then
    do_login
    agent-browser open "$TARGET_URL"
    agent-browser wait --load networkidle
fi

# Now extract content
echo "Extracting content from: $TARGET_URL"
agent-browser snapshot -i
agent-browser get text body

# Close when done
agent-browser close
