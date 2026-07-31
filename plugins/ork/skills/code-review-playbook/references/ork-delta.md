# Code Review: ork delta

What survives after the vendor tutorials were retired. Everything here is a house
decision or a scar specific to OrchestKit. General code-review craft belongs to the
upstream sources named on each entry, not to this repo.

---

## Flag any PR over 500 changed lines as too large before reviewing it

Why: this skill shipped two contradicting thresholds. `SKILL.md` budgets "Large PR
(> 500 lines): 1-2 hours (or ask to split)" and the eval case
`edge-review-this-800line-pr` in `src/skills/code-review-playbook/test-cases.json`
grades on "Flags the PR as too large (> 500 lines) and suggests splitting", while the
retired `checklists/code-review-checklist.md` told reviewers to flag only above 800.
The graded number is 500; the 800 line is gone with the checklist.
Upstream: https://google.github.io/eng-practices/review/reviewer/speed.html

## Write conventional-comment decorations in square brackets, never parentheses

Why: `references/conventional-comments.md` and `SKILL.md` both use
`security [blocking]: subject`, but the retired `references/review-patterns.md` used
`issue (blocking): subject`. One skill was teaching two syntaxes for the same label
grammar. `references/conventional-comments.md` is now the single source in this skill.
Upstream: https://conventionalcomments.org/

## Keep OWASP coverage in rules/security-baseline.md only

Why: three retired files (the code-review-checklist, the review-patterns reference, and
the review-feedback-template asset) each carried a partial, differently-worded OWASP
list, none of which was the file the
`security-baseline` eval case in `test-cases.json` actually grades. Copies of a
security list drift silently; the rule file is the one that gets tested.
Upstream: https://owasp.org/Top10/

## Do not add a second review-report template to this skill

Why: the retired review-feedback-template asset was a 394-line report skeleton
covering summary, per-file notes, coverage, performance, security, timeline, and
sign-off. `ork:review-pr` already owns the multi-agent, full-PR review output shape
(conventional comments plus an approve or request-changes verdict), so the template was
a parallel format that nothing rendered and nothing tested. This playbook stays the
manual framework; the report shape lives in `src/skills/review-pr/`.
Upstream: src/skills/review-pr/SKILL.md

## Reject a jwt.decode call that omits an explicit algorithms argument

Why: `.claude/rules/antipatterns.md` lists "manual jwt validation" as a repo-level
anti-pattern, and this was the one concrete, non-generic finding in the retired
`examples/pr-review-walkthrough.md`. Without `algorithms=[...]` a forged `none`-algorithm
token verifies. Distilled from the retired examples/pr-review-walkthrough.md; no traced
incident.
Upstream: https://pyjwt.readthedocs.io/en/stable/api.html
