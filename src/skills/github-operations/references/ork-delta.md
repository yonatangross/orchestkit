# OrchestKit delta for GitHub operations

What this repo does differently from the stock `gh` CLI and REST docs. Everything
here is a house rule, a hook contract, or a scar. Vendor mechanics live upstream,
linked per entry.

---

## Pass `--label` on every `gh issue create`

Why: `src/hooks/src/pretool/bash/gh-label-enforcer.ts`, registered in
`src/hooks/src/entries/pretool.ts`, returns a `deny` permission decision for a bare
`gh issue create`. A label-less create inside a seeding loop does not warn, it is
blocked, and the batch dies partway with issues already filed.
Upstream: https://cli.github.com/manual/gh_issue_create

## Treat the missing-`--milestone` message as advisory, not a failure

Why: `src/hooks/src/pretool/bash/gh-milestone-enforcer.ts` is registered in the same
entries map but only emits context ("No --milestone set. Consider assigning to a
milestone for sprint tracking."). It never blocks. Do not abort or retry a create
because that line appeared in the transcript.
Upstream: https://cli.github.com/manual/gh_issue_create

## Never close an issue by hand; let the merged PR close it

Why: the repo CLAUDE.md "GitHub CLI" rule states issues close on merge from
`Closes #N` in the PR body, and closing by hand loses that PR link. The retired
`references/issue-management.md` and `examples/automation-scripts.md` both shipped
bulk `gh issue close` loops that strip the link from history permanently. Use
`gh issue comment` for progress instead.
Upstream: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue

## Stop the loop on the first `gh` rate-limit hint, do not retry

Why: on Claude Code 2.1.116+ the Bash tool surfaces a rate-limit hint when `gh`
takes a 403, and that hint is the authoritative backoff signal. Before it existed,
agents had no signal and burned the whole retry budget in roughly 13 seconds.
`tests/evals/skills/github-operations-rate-limit.eval.yaml` grades this behaviour
and asserts the pre-flight guard, so the `gh api rate_limit` check and the
`remaining < 100` threshold in `examples/automation-scripts.md` are contract, not
taste. (Eval added under issue #1436, "test(evals): add eval coverage for CC
2.1.116 behavioral knowledge in skills".)
Upstream: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

## Close milestones, never DELETE them

Why: `DELETE /repos/:owner/:repo/milestones/:number` detaches the milestone from
every issue that carried it, so the sprint's progress history is gone with no undo.
The house Key Decision in SKILL.md is close-don't-delete; `-f state=closed` keeps
the closed/open counts queryable forever.
Upstream: https://docs.github.com/en/rest/issues/milestones

## Treat sub-issues as native; do not install `gh-sub-issue`

Why: distilled from the retired `references/issue-management.md`; no traced
incident. That file told agents to `gh extension install yahsan2/gh-sub-issue`
while the 2026 section of SKILL.md documents the native `sub_issues` REST
endpoints, so the skill contradicted itself depending on which file got loaded.
Upstream: https://docs.github.com/en/rest/issues/sub-issues

## Keep the six named sub-files on disk when thinning this skill

Why: `tests/skills/test-github-operations-completeness.sh` and
`tests/unit/test-git-enforcement-hooks.sh` assert the exact file set frozen by
issue #155 ("Skill: Create consolidated github-operations skill"), and the
completeness test additionally greps `examples/automation-scripts.md` for a
fenced bash block and resolves every relative markdown link in SKILL.md. Thin the
contents, keep the names, keep one fence in the example file.
Upstream: none, house-only contract enforced by
`tests/skills/test-github-operations-completeness.sh`
