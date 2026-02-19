---
title: Push Confirmation Required
impact: CRITICAL
impactDescription: "git push is irreversible on shared remotes — always confirm with user"
tags: [release, push, confirmation, safety]
---

# Push Confirmation Required

## Rule

**Always ask the user explicitly before running `git push --follow-tags`.**

This is irreversible. Once pushed to a shared remote, the tag and commit are public.

## Required Prompt

Before pushing, show:

```
Ready to push:
  Branch: <branch>
  Tag:    v<version>
  Remote: <remote>

This is irreversible. Confirm push? (y/n)
```

Only proceed on explicit `y` or `yes`.

## What Gets Pushed

`git push --follow-tags` pushes:
1. All commits on the current branch up to HEAD
2. The annotated tag created in step 11

## Never Skip

Do not auto-confirm, do not infer consent from context. Ask every time, even if the user initiated the release flow. Authorization in prior steps does not extend to the push step.
