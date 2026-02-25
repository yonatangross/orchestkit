---
title: "Review Readiness Criteria"
impact: "HIGH"
impactDescription: "Premature review requests waste reviewer time; missed draft flags block collaboration"
tags: [pr, review, draft, readiness]
---

## Review Readiness Criteria

Determine whether a PR should be created as draft or ready for review.

**Create as DRAFT when:**
- Tests are not yet passing
- Implementation is partial (WIP)
- You want early feedback on approach before finishing
- CI has not been verified locally

**Create as READY when:**
- All pre-flight checks pass (see `preflight-validation.md`)
- Self-review is complete (you read your own diff)
- PR body is filled out with Summary, Changes, Test Plan
- No TODO/FIXME comments in changed lines (unless intentional and explained)

**Self-review checklist (do before marking ready):**
- [ ] Read the full diff (`git diff dev...HEAD`) as if reviewing someone else's code
- [ ] No debug statements (console.log, print, debugger) left in
- [ ] No commented-out code without explanation
- [ ] Variable/function names are clear
- [ ] No unrelated changes mixed in

**Key rules:**
- Use `gh pr create --draft` for draft PRs
- Convert draft to ready with `gh pr ready`
- Never force-request review on a draft PR
- If unsure, default to draft — it is easier to mark ready than to un-request review

**Agent validation:**
- For Feature PRs: launch security-auditor + test-generator + code-quality-reviewer agents
- For Bug fix PRs: focus on test-generator only
- For Refactor PRs: focus on code-quality-reviewer only
- For Quick PRs: skip agent validation entirely
