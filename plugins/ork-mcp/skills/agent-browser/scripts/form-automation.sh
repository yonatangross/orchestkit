#!/bin/bash
# Template: Form Automation Workflow
# Fills and submits web forms with validation
#
# Usage:
#   ./form-automation.sh <form-url>
#
# Setup:
#   1. Run once to see your form structure
#   2. Note the @refs for your fields
#   3. Update FORM_CONFIG section and set DISCOVERY_MODE=false

set -euo pipefail

FORM_URL="${1:?Usage: $0 <form-url>}"

# ══════════════════════════════════════════════════════════════
# FORM_CONFIG: Update these after running discovery mode
# ══════════════════════════════════════════════════════════════
DISCOVERY_MODE=true    # Set to false after customizing

# Define your form fields (update refs after discovery)
# Format: "ref|action|value" where action is: fill, select, check, click
FORM_FIELDS=(
    # "@e1|fill|John Doe"              # Name field
    # "@e2|fill|user@example.com"       # Email field
    # "@e3|fill|+1-555-123-4567"        # Phone field
    # "@e4|select|Option Value"         # Dropdown
    # "@e5|check|"                       # Checkbox
    # "@e6|click|"                       # Radio button
)
SUBMIT_REF="@e10"      # Submit button ref
SUCCESS_PATTERN=""     # Optional: URL pattern after success (e.g., "**/thank-you")
# ══════════════════════════════════════════════════════════════

discover_form() {
    echo "Opening form page for discovery..."
    agent-browser open "$FORM_URL"
    agent-browser wait --load networkidle

    echo ""
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│ FORM STRUCTURE                                          │"
    echo "├─────────────────────────────────────────────────────────┤"
    agent-browser snapshot -i
    echo "└─────────────────────────────────────────────────────────┘"
    echo ""
    echo "Next steps:"
    echo "  1. Note refs for each form field"
    echo "  2. Edit FORM_CONFIG section at top of this script"
    echo "  3. Add entries to FORM_FIELDS array"
    echo "  4. Set SUBMIT_REF to your submit button"
    echo "  5. Set DISCOVERY_MODE=false"
    echo ""
    agent-browser close
}

fill_form() {
    echo "Automating form at: $FORM_URL"

    # Navigate to form page
    agent-browser open "$FORM_URL"
    agent-browser wait --load networkidle

    # Show form structure
    echo "Form structure:"
    agent-browser snapshot -i

    # Process each field
    for field in "${FORM_FIELDS[@]}"; do
        [[ -z "$field" || "$field" == \#* ]] && continue

        IFS='|' read -r ref action value <<< "$field"

        case "$action" in
            fill)
                echo "Filling $ref with: $value"
                agent-browser fill "$ref" "$value"
                ;;
            select)
                echo "Selecting $ref: $value"
                agent-browser select "$ref" "$value"
                ;;
            check)
                echo "Checking $ref"
                agent-browser check "$ref"
                ;;
            uncheck)
                echo "Unchecking $ref"
                agent-browser uncheck "$ref"
                ;;
            click)
                echo "Clicking $ref"
                agent-browser click "$ref"
                ;;
            upload)
                echo "Uploading to $ref: $value"
                agent-browser upload "$ref" "$value"
                ;;
            *)
                echo "Unknown action: $action"
                ;;
        esac
    done

    # Submit form
    echo "Submitting form..."
    agent-browser click "$SUBMIT_REF"
    agent-browser wait --load networkidle

    # Wait for success pattern if defined
    if [[ -n "$SUCCESS_PATTERN" ]]; then
        agent-browser wait --url "$SUCCESS_PATTERN" --timeout 10000
    fi

    # Verify submission
    echo ""
    echo "Form submission result:"
    agent-browser get url
    agent-browser snapshot -i

    # Take screenshot of result
    agent-browser screenshot /tmp/form-result.png
    echo "Screenshot saved: /tmp/form-result.png"

    # Cleanup
    agent-browser close

    echo "Form automation complete"
}

# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

if [[ "$DISCOVERY_MODE" == "true" ]]; then
    discover_form
else
    fill_form
fi
