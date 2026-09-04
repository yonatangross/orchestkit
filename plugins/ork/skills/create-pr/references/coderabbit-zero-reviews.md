# CodeRabbit harvest returns zero: reviewed clean, or never reviewed?

`coderabbit-harvest.sh --unresolved` printing `[]` has two indistinguishable causes:
CodeRabbit read the diff and found nothing, or CodeRabbit never saw the PR. The harvest
phase treats both as clean, which lets an unreachable app pass the quality gate forever.

Measured on `yonatangross/orchestkit` on 2026-09-03: `.coderabbit.yaml` had been on `main`
since 2026-08-25 (#3746), was valid, and enabled `auto_review`. CodeRabbit had posted no
comments in the repository history, and an explicit `@coderabbitai review` request received
no reply. The configuration is not the leading problem. The app is either not installed for
the account that owns this repository or disabled account-side. A non-browser session cannot
settle which one, so it must keep that uncertainty visible.

## Disambiguate before trusting the zero

Run this once per repository.

```bash
R=owner/repo

# 1. Query both comment surfaces without since=. Summaries are issue comments;
# findings are PR review comments. A single endpoint is structurally incomplete.
gh api --paginate "/repos/$R/issues/comments?per_page=100" \
  --jq '.[] | select(.user.login == "coderabbitai[bot]") | .issue_url' \
  | sort -u | wc -l
gh api --paginate "/repos/$R/pulls/comments?per_page=100" \
  --jq '.[] | select(.user.login == "coderabbitai[bot]") | .pull_request_url' \
  | sort -u | wc -l

# 2. Run the same query against a repository where CodeRabbit is known to work.
# This is the positive control. The bot login is coderabbitai[bot], not bare
# coderabbitai, and an incorrect login silently produces zero.

# 3. Corroborate, but do not prove, with CodeRabbit's check-suite slug. Query
# suites rather than check-runs: CodeRabbit can create a suite without runs.
SHA=$(gh pr view <number> --repo "$R" --json headRefOid --jq .headRefOid)
gh api "/repos/$R/commits/$SHA/check-suites?per_page=100" \
  --jq '.check_suites[].app.slug' | sort -u

# 4. Required before saying the app is not installed. Post this on an open PR:
# @coderabbitai review
# Any reply proves the app is installed and moves the fault to configuration or
# the dashboard. Silence is evidence of either a missing installation or a
# disabled account-side app, never proof of only the former.
```

Do not add `since=` to the history queries. It limits the evidence to a window and filters
on update time, so a prior review can look like no review at all. If rate limits require a
bounded query, its only conclusion is "none in that window."

## Read the result

| Signal | Meaning | Action |
|---|---|---|
| A reply to `@coderabbitai review` | CodeRabbit is installed. | Check `.coderabbit.yaml` and the dashboard. |
| Existing, recent CodeRabbit comments but none on this PR | The PR is excluded. | Check filters, base branch, draft state, author, and title. |
| Lifetime zero on both endpoints, working positive control, no reply | Not installed for this owner account, or disabled account-side. | Read the settings page. |
| A zero with no explicit-trigger probe | Inconclusive. | Run the explicit trigger first. |
| Missing check-suite slug | Corroboration only. | Do not diagnose from this alone. |

No non-browser signal conclusively proves absence. `gh api /user/installations` normally
returns 403 for a user token because that endpoint requires a GitHub App-authorized token.
The direct check is the GitHub settings installation page and the CodeRabbit dashboard.
State in the harvest record whether those pages were read; do not imply they were.

## Likely owner-level cause

GitHub App installations belong to an organization or a user account and carry their own
repository grants. An installation for `Yonatan-HQ` does not grant access to a personal
repository owned by `yonatangross`, even if the same person controls both. That is the
leading explanation here, but an app disabled in the CodeRabbit dashboard produces the same
observable zero. Both are resolved only in the settings pages.

Operator action, not automatable from a session:

1. Open https://github.com/settings/installations and locate CodeRabbit.
2. If it is absent, install it for the personal account from https://github.com/apps/coderabbitai.
3. If it is present, grant this repository or all repositories as appropriate.
4. Confirm the repository is enabled in https://app.coderabbit.ai.
5. Prove the fix with a PR that receives a `coderabbitai[bot]` review.
