---
format_version: 1
title: "Login flow"
slug: "login"
pages: ["/login", "/dashboard"]
tags: [auth, login, session]
steps:
  - instruction: "Navigate to /login"
    expected: "Login page loads with a form containing Email and Password fields"
  - instruction: "Take an ARIA snapshot to confirm form structure"
    expected: "Snapshot shows textbox 'Email', textbox 'Password', and button 'Log in' or 'Sign in'"
  - instruction: "Fill the 'Email' textbox with test@example.com"
    expected: "Email field contains test@example.com"
  - instruction: "Fill the 'Password' textbox with test-password-123"
    expected: "Password field is populated (masked)"
  - instruction: "Click the button with accessible name 'Log in' or 'Sign in'"
    expected: "Form submits and page navigates away from /login"
  - instruction: "Wait for navigation to complete and take an ARIA snapshot"
    expected: "Current URL is /dashboard or contains /dashboard"
  - instruction: "Verify a heading or text containing the user name is visible"
    expected: "Page displays a welcome message or user name, confirming active session"
  - instruction: "Take a screenshot of the dashboard for visual confirmation"
    expected: "Screenshot shows the authenticated dashboard view"
---

# Login Flow

Tests the standard authentication flow: navigate to login, enter credentials,
submit, and verify the session is established on the dashboard.

## Prerequisites

- A test user account must exist (e.g. test@example.com / test-password-123)
- The app must be running and accessible at the configured base URL

## Selector Strategy

All interactions use ARIA-first selectors:
- `textbox "Email"` / `textbox "Password"` for input fields
- `button "Log in"` or `button "Sign in"` for form submission
- Heading or visible text for session verification

## Notes

- If the login button label differs, the agent adapts via ARIA snapshot
- Two-factor auth flows are not covered by this template
- Session verification checks for visible user name, not cookies
