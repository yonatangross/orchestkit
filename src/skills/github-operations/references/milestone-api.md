# Milestone API

`gh` has no native milestone commands, so milestones are REST-only. The endpoint
list, payload fields, and query parameters are not restated here.

> Kept on disk deliberately: `tests/skills/test-github-operations-completeness.sh`
> and `tests/unit/test-git-enforcement-hooks.sh` assert this exact filename.

## Upstream

| Topic | Source |
|-------|--------|
| Milestone REST CRUD, payload fields (`title`, `state`, `description`, `due_on`), list filters and sorting | https://docs.github.com/en/rest/issues/milestones |
| `gh api` invocation, `:owner`/`:repo` placeholders, `--jq`, `--paginate` | https://cli.github.com/manual/gh_api |
| Assigning a milestone from the CLI | https://cli.github.com/manual/gh_issue_create |

## Our delta

Full rules with rationale: [ork-delta.md](ork-delta.md).

1. **Close, never DELETE.** `DELETE .../milestones/:number` detaches the milestone
   from every issue that carried it and the progress history is unrecoverable.
   Use `-f state=closed`.
2. **NAME for the CLI, NUMBER for the API.** The full identifier mapping and the
   name-to-number lookup helper stay in this skill:
   [cli-vs-api-identifiers.md](cli-vs-api-identifiers.md).
3. **ISO 8601 for `due_on`** (`YYYY-MM-DDTHH:MM:SSZ`). Anything else is accepted
   and then silently misread.

```bash
# Close a sprint: resolve the number from the title, then PATCH state.
MS=$(gh api repos/:owner/:repo/milestones \
  --jq '.[] | select(.title=="Sprint 8") | .number')
gh api -X PATCH "repos/:owner/:repo/milestones/$MS" -f state=closed
```
