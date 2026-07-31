# GitHub Automation Scripts

Loop-and-`gh` recipes (bulk label, bulk assign, cross-repo label sync, org-wide
search, PR dashboards) are ordinary CLI usage and are not restated here. What
survives is the part the vendor docs do not tell you: how this repo wants an agent
to behave inside a long `gh` loop.

> Kept on disk deliberately: `tests/skills/test-github-operations-completeness.sh`
> and `tests/unit/test-git-enforcement-hooks.sh` assert this exact filename, and
> the completeness test greps it for a fenced bash block.

## Upstream

| Topic | Source |
|-------|--------|
| `gh issue`/`gh pr` list, edit, and search flags used by every bulk loop | https://cli.github.com/manual/gh_issue |
| Cross-repo label create/edit/clone | https://cli.github.com/manual/gh_label |
| Org-wide issue search | https://cli.github.com/manual/gh_search_issues |
| Rate-limit headers, reset semantics, secondary limits | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |

## Our delta: rate-limit discipline

Full rules with rationale: [../references/ork-delta.md](../references/ork-delta.md).

On Claude Code 2.1.116+ the Bash tool surfaces a rate-limit hint in the transcript
whenever a `gh` invocation takes a 403 rate-limit response. **That hint is the
authoritative backoff signal: stop the loop and wait for the reset, do not retry
the next call.** Before the hint existed, agents had no signal and exhausted the
whole retry budget in roughly 13 seconds. Never work around a limit by swapping
tokens.

The pre-flight guard below is the house pattern that keeps the loop from hitting
the first 403 at all. The `remaining < 100` floor and the `gh api rate_limit`
probe are graded by `tests/evals/skills/github-operations-rate-limit.eval.yaml`,
so keep both:

```bash
#!/usr/bin/env bash
set -euo pipefail

check_rate_limit() {
  local remaining reset wait
  remaining=$(gh api rate_limit --jq '.rate.remaining')
  if [[ "$remaining" -lt 100 ]]; then
    reset=$(gh api rate_limit --jq '.rate.reset')
    wait=$((reset - $(date +%s)))
    echo "Rate limit low ($remaining). Waiting ${wait}s..."
    sleep "$wait"
  fi
}

for issue in $(gh issue list --json number --jq '.[].number'); do
  check_rate_limit
  gh issue edit "$issue" --add-label "processed"
done
```

Two more constraints that bite inside bulk loops:

- **Never bulk `gh issue close`.** Issues close only when their linked PR merges;
  a close loop strips the PR link from history.
- **Every `gh issue create` needs `--label`.** The `gh-label-enforcer` hook denies
  it otherwise, mid-batch.

## Related

- [Issue Management](../references/issue-management.md)
- [Milestone API](../references/milestone-api.md)
- [GraphQL API](../references/graphql-api.md)
- PR merge-gating (`statusCheckRollup` is an array, fold it before comparing):
  [PR Workflows](../references/pr-workflows.md)
