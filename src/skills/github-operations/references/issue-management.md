# Issue Management

Vendor mechanics for `gh issue` are not restated here. This file carries only the
house delta and the pointers.

> Kept on disk deliberately: `tests/skills/test-github-operations-completeness.sh`
> and `tests/unit/test-git-enforcement-hooks.sh` assert this exact filename.

## Upstream

| Topic | Source |
|-------|--------|
| `gh issue create/edit/list/close/view` flags, templates, `--body-file` | https://cli.github.com/manual/gh_issue |
| Issue search qualifiers (`is:open`, `label:`, `no:assignee`) | https://cli.github.com/manual/gh_search_issues |
| Native sub-issue endpoints and payloads | https://docs.github.com/en/rest/issues/sub-issues |
| Keyword auto-close semantics (`Closes #N`) | https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue |

## Our delta

Full rules with rationale: [ork-delta.md](ork-delta.md).

1. **`--label` is mandatory.** `src/hooks/src/pretool/bash/gh-label-enforcer.ts`
   denies a bare `gh issue create`. A seeding loop without it dies partway.
2. **Never `gh issue close`.** Issues close only when their linked PR merges to the
   default branch. Comment progress with `gh issue comment` instead.
3. **Milestones go in by NAME, never by number.** The identifier mapping stays in
   this skill: [cli-vs-api-identifiers.md](cli-vs-api-identifiers.md).
4. **Sub-issues are native.** Do not install `yahsan2/gh-sub-issue`.

House pattern worth keeping, capture the number at creation so the issue can be
wired into Projects v2 or a PR body in the same run:

```bash
NUM=$(gh issue create --title "$title" --label "$labels" \
  --milestone "$SPRINT" --body "" --json number --jq '.number')
echo "Created #$NUM"
```
