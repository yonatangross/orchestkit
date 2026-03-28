---
format_version: 1
title: "Navigation flow"
slug: "navigation"
pages: ["/", "/about", "/docs"]
tags: [navigation, routing, links]
steps:
  - instruction: "Navigate to the home page /"
    expected: "Home page loads successfully with main navigation visible"
  - instruction: "Take an ARIA snapshot to identify the navigation landmark"
    expected: "Snapshot shows a navigation landmark with links including 'About' and 'Docs'"
  - instruction: "Click the link with accessible name 'About' within the navigation landmark"
    expected: "Page navigates to /about and About page content is visible"
  - instruction: "Verify the navigation link 'About' has an active or current state"
    expected: "The 'About' link is marked as current (aria-current='page') or visually active"
  - instruction: "Take an ARIA snapshot to check for breadcrumb navigation"
    expected: "Snapshot shows a breadcrumb with 'Home' and 'About' entries, or no breadcrumbs if not implemented"
  - instruction: "Click the link with accessible name 'Docs' within the navigation landmark"
    expected: "Page navigates to /docs and documentation content is visible"
  - instruction: "Verify the navigation link 'Docs' has an active or current state"
    expected: "The 'Docs' link is marked as current (aria-current='page') or visually active"
  - instruction: "Use the browser back button to return to the previous page"
    expected: "Browser navigates back to /about"
  - instruction: "Use the browser back button again to return to home"
    expected: "Browser navigates back to / (home page)"
  - instruction: "Verify the home page navigation state is restored correctly"
    expected: "Home link is active and page content matches the initial home page load"
  - instruction: "Take a screenshot for visual confirmation of navigation state"
    expected: "Screenshot shows the home page with correct active navigation state"
---

# Navigation Flow

Tests page navigation through the main nav: click links, verify page
transitions, check active states and breadcrumbs, and test browser
back button behavior.

## Prerequisites

- The app must have a navigation bar or menu with links to /, /about, /docs
- Pages must render distinct content for each route

## Selector Strategy

All interactions use ARIA-first selectors:
- `navigation` landmark for the nav container
- `link "About"` / `link "Docs"` for navigation links
- `aria-current="page"` for active link detection
- Breadcrumb landmark or list for breadcrumb verification

## Notes

- The agent checks for aria-current attributes to detect active nav state
- Breadcrumb verification is optional (step passes if not implemented)
- Back button tests verify client-side routing preserves history
