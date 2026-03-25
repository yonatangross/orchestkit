---
title: Story Preview Verification
impact: HIGH
impactDescription: Visual confirmation in chat prevents shipping components that render incorrectly
tags: [storybook-mcp, preview, visual-verification, dev-toolset]
---

# Story Preview Verification

After generating or modifying a component, use `preview-stories` to embed a live preview in the chat for visual confirmation.

## Pattern: Generate → Preview → Confirm

```python
# Step 1: Write the story file (CSF3 format)
Write("src/components/Card/Card.stories.tsx", story_content)

# Step 2: Get preview URLs from Storybook MCP
previews = preview-stories(stories=[
    { "storyId": "card--default" },
    { "storyId": "card--with-image" },
    { "storyId": "card--loading" }
])
# Returns: preview URLs for each story

# Step 3: Include preview URLs in response
# Agent MUST include the URLs in its response for the user to see them
```

## Incorrect

```python
# BAD: Generate component and tell user "it should work"
Write("src/components/Card/Card.tsx", component_code)
# "I've created the Card component. It should render correctly."
```

## Correct

```python
# GOOD: Generate component, write story, show preview
Write("src/components/Card/Card.tsx", component_code)
Write("src/components/Card/Card.stories.tsx", story_code)
previews = preview-stories(stories=[
    { "absoluteStoryPath": "src/components/Card/Card.stories.tsx", "exportName": "Default" }
])
# "Here's the Card component. Preview: [embedded story URL]
#  Does this match what you expected?"
```

## Alternative: Story ID vs File Path

Two ways to reference stories:

```python
# By story ID (if you know it):
preview-stories(stories=[{ "storyId": "card--default" }])

# By file path + export (if just created):
preview-stories(stories=[{
    "absoluteStoryPath": "src/components/Card/Card.stories.tsx",
    "exportName": "Default"
}])
```

## When to Preview

- After generating a new component with stories
- After modifying an existing component's visual appearance
- When the user asks "what does it look like?"
- Before marking a design-to-code task as complete
