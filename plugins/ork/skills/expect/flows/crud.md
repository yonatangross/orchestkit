---
format_version: 1
title: "CRUD operations"
slug: "crud"
pages: ["/items", "/items/new", "/items/{id}"]
tags: [crud, form, data]
steps:
  - instruction: "Navigate to /items"
    expected: "Items list page loads with a table or list of items"
  - instruction: "Take an ARIA snapshot to identify the 'Create' or 'New' action"
    expected: "Snapshot shows a link or button with accessible name containing 'Create', 'New', or 'Add'"
  - instruction: "Click the button or link with accessible name 'Create' or 'New item'"
    expected: "Navigation to /items/new or a creation form appears"
  - instruction: "Fill the 'Name' textbox with 'Test Item Alpha'"
    expected: "Name field contains 'Test Item Alpha'"
  - instruction: "Fill any required fields identified in the ARIA snapshot (e.g. 'Description' textbox)"
    expected: "All required fields are populated"
  - instruction: "Click the button with accessible name 'Save' or 'Create'"
    expected: "Form submits and redirects to the item detail page or back to the list"
  - instruction: "Navigate to /items and verify 'Test Item Alpha' appears in the list"
    expected: "The items list contains a row or entry with text 'Test Item Alpha'"
  - instruction: "Click on the item row or link with accessible name containing 'Test Item Alpha'"
    expected: "Item detail or edit page loads for 'Test Item Alpha'"
  - instruction: "Update the 'Name' textbox to 'Test Item Beta'"
    expected: "Name field now contains 'Test Item Beta'"
  - instruction: "Click the button with accessible name 'Save' or 'Update'"
    expected: "Changes are saved and confirmed via success message or redirect"
  - instruction: "Navigate to /items and verify 'Test Item Beta' appears and 'Test Item Alpha' does not"
    expected: "List shows 'Test Item Beta' with no entry for 'Test Item Alpha'"
  - instruction: "Click the delete action for 'Test Item Beta' (button 'Delete' or icon within the row)"
    expected: "Confirmation dialog appears or item is removed"
  - instruction: "Confirm deletion if a dialog appears (click 'Confirm' or 'Delete' button)"
    expected: "Item is deleted and list no longer contains 'Test Item Beta'"
  - instruction: "Take a screenshot to confirm the item was removed from the list"
    expected: "Screenshot shows the items list without 'Test Item Beta'"
---

# CRUD Operations Flow

Tests the full create-read-update-delete lifecycle for a resource:
create an item, verify it in the list, edit it, confirm the update,
delete it, and verify removal.

## Prerequisites

- The app must have a resource list page at /items
- User must have permission to create, edit, and delete items

## Selector Strategy

All interactions use ARIA-first selectors:
- `button "Create"` / `button "Save"` / `button "Delete"` for actions
- `textbox "Name"` / `textbox "Description"` for form fields
- Row text content for list verification

## Notes

- The agent adapts to different button labels via ARIA snapshot
- Confirmation dialogs are handled if present
- Test data is cleaned up by the delete step
