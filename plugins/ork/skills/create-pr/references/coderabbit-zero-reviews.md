# CodeRabbit harvest returns zero: reviewed clean, or never reviewed?

`coderabbit-harvest.sh --unresolved` printing `[]` has two causes that look identical
from the harvest phase: CodeRabbit read the diff and found nothing, or CodeRabbit never
saw the PR at all. The harvest phase treats both as "continue to merge", so a repo the
app cannot reach passes the quality bar on every PR forever.

Measured on yonatangross/orchestkit, 2026-09-03: `.coderabbit.yaml` had been on `main`
since 2026-08-25 (#3746), valid, with `auto_review.enabled: true`. Every PR review
comment in the repo's entire history came from `github-advanced-security[bot]` (56) or
`Copilot` (9). CodeRabbit had posted zero, ever. The config was never the problem and
editing it would never have fixed anything: the GitHub App was not installed on the
account that owns the repo.

## Disambiguate before you trust the zero

Run this once per repo. It is cheap and it separates "clean" from "unreachable".

```bash
R=owner/repo
# 1. Has CodeRabbit EVER commented here? Both endpoints, because they are different
#    surfaces: summaries land as issue comments, findings as PR review comments.
#    A single-endpoint read is structurally blind to half the answer.
gh api --paginate "/repos/$R/issues/comments?per_page=100&since=2026-01-01T00:00:00Z" \
  --jq '.[] | select(.user.login=="coderabbitai[bot]") | (.issue_url|split("/")|last)' | sort -u | wc -l
gh api --paginate "/repos/$R/pulls/comments?per_page=100" \
  --jq '.[] | select(.user.login=="coderabbitai[bot]") | (.pull_request_url|split("/")|last)' | sort -u | wc -l

# 2. POSITIVE CONTROL. Same query against a repo where CodeRabbit is known to run.
#    Without it, a zero is indistinguishable from a wrong query: the bot login is
#    `coderabbitai[bot]`, and the bare `coderabbitai` form silently returns 0.

# 3. Which apps actually act on this repo? An installed app with checks:write gets a
#    check-suite on every push. CodeRabbit missing from this list while other apps
#    appear is the installation signal.
SHA=$(gh pr view <n> --repo "$R" --json headRefOid --jq .headRefOid)
gh api "/repos/$R/commits/$SHA/check-suites?per_page=100" --jq '.check_suites[].app.slug' | sort -u
```

## Read the result

| Signal | Meaning | Fix |
|---|---|---|
| Zero comments ever, on both endpoints, with a control that returns non-zero | App not installed for this repo's owner account | Operator installs it, below |
| No `coderabbit` in the check-suite app list while other apps appear | Same | Same |
| Comments exist but stopped on a date | Subscription lapsed, or the repo was dropped from the installation grant | Dashboard, below |
| Comments exist and are recent, this PR has none | Real config exclusion: check `path_filters`, `ignore_title_keywords`, `ignore_usernames`, `base_branches`, `drafts` | `.coderabbit.yaml` |

Only the last row is a config bug. The first three cannot be fixed by editing
`.coderabbit.yaml`, and a valid config is not evidence of a running reviewer.

## Installation is per owner account, not per repo

The GitHub App is installed on an organization or on a user account, and each installation
carries its own repository grant. An org installation does not cover a personal repo owned
by a member of that org, even for the same person and the same subscription. That is the
whole of the orchestkit defect: `Yonatan-HQ/platform` (org-owned) had CodeRabbit on 238 of
311 non-bot PRs since 2026-08-20, while `yonatangross/orchestkit` (user-owned, public) had
zero over the same window with the identical query.

Operator action, not automatable from a session (it is a web OAuth grant):

1. https://github.com/settings/installations, find CodeRabbit.
2. If absent, install it on the personal account from https://github.com/apps/coderabbitai.
3. If present, open Configure and add the repo to "Only select repositories", or switch to
   all repositories.
4. Confirm in the CodeRabbit dashboard (https://app.coderabbit.ai) that the repo is listed
   and enabled under the right org or account.

Then prove it with a PR, not with the settings page: open one and wait for
`gh pr view <n> --json reviews,comments` to show a `coderabbitai[bot]` entry. A green
config and a checked box are not a posted review.

## Public repositories are free

CodeRabbit gives free reviews for public repositories to accounts signed up through GitHub
(coderabbit.ai/pricing, read 2026-09-03). A public repo does not need a paid seat and does
not consume one, so "we are not paying for that repo" is never a reason to leave the app
uninstalled on it.
