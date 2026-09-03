# CodeRabbit harvest returns zero: reviewed clean, or never reviewed?

`coderabbit-harvest.sh --unresolved` printing `[]` has two causes that look identical
from the harvest phase: CodeRabbit read the diff and found nothing, or CodeRabbit never
saw the PR at all. The harvest phase treats both as "continue to merge", so a repo the
app cannot reach passes the quality bar on every PR forever.

Measured on yonatangross/orchestkit, 2026-09-03: `.coderabbit.yaml` had been on `main`
since 2026-08-25 (#3746), valid, with `auto_review.enabled: true`. Every PR review
comment in the repo's entire history came from `github-advanced-security[bot]` (56) or
`Copilot` (9). CodeRabbit had posted zero, ever, and an explicit `@coderabbitai review`
on an open PR went unanswered. The config was never the problem and editing it would
never have fixed anything: CodeRabbit is not reaching this repo at all, because the app
is either uninstalled on the account that owns it or disabled account-side. Which of the
two it is cannot be settled from a session, only from the settings page, and the ladder
below is built so that gap stays visible instead of getting rounded off.

## Disambiguate before you trust the zero

Run this once per repo. It is cheap and it separates "clean" from "unreachable".

```bash
R=owner/repo
# 1. Has CodeRabbit EVER commented here? Both endpoints, because they are different
#    surfaces: summaries land as issue comments, findings as PR review comments.
#    A single-endpoint read is structurally blind to half the answer.
#
#    NO `since=`. It bounds the window, and it filters on updated_at rather than
#    created_at, so a repo whose CodeRabbit activity predates the cutoff returns 0
#    and reads exactly like a repo that was never installed. If you must bound it
#    for rate-limit reasons, the answer you get is "none in that window", never
#    "none ever", and the table below only accepts the unbounded form.
gh api --paginate "/repos/$R/issues/comments?per_page=100" \
  --jq '.[] | select(.user.login=="coderabbitai[bot]") | (.issue_url|split("/")|last)' | sort -u | wc -l
gh api --paginate "/repos/$R/pulls/comments?per_page=100" \
  --jq '.[] | select(.user.login=="coderabbitai[bot]") | (.pull_request_url|split("/")|last)' | sort -u | wc -l

# 2. POSITIVE CONTROL. Same query against a repo where CodeRabbit is known to run.
#    Without it, a zero is indistinguishable from a wrong query: the bot login is
#    `coderabbitai[bot]`, and the bare `coderabbitai` form silently returns 0.

# 3. CORROBORATION ONLY, never proof on its own. GitHub creates a check-suite per
#    installed app that has the checks permission; an installed app without it emits
#    nothing, so a missing slug does not by itself mean "not installed" for an
#    arbitrary app. It does mean it for CodeRabbit, but only because that was
#    MEASURED: on Yonatan-HQ/platform, where CodeRabbit demonstrably reviews, the
#    `coderabbitai` slug is present on every PR head checked (#11024, #11057, #11058).
#    Run this against your control repo FIRST. If the slug is absent there too, this
#    probe is inert for your setup and step 1 is the only evidence you have.
#    Query check-SUITES, not check-RUNS: on those same platform PRs the check-runs
#    app list is `github-actions` alone, because CodeRabbit opens a suite and files
#    no runs in it.
SHA=$(gh pr view <n> --repo "$R" --json headRefOid --jq .headRefOid)
gh api "/repos/$R/commits/$SHA/check-suites?per_page=100" --jq '.check_suites[].app.slug' | sort -u

# 4. REQUIRED before you say "not installed". A lifetime zero is ALSO what an
#    installed-but-suppressed app produces: the repo can be disabled in the
#    CodeRabbit dashboard, paused with `@coderabbitai pause`, or excluded from
#    day one by an `ignore_usernames` covering the only author or a
#    `path_filters` matching everything. Steps 1 to 3 cannot separate those from
#    an absent installation, because all of them post nothing, ever.
#
#    Manual commands are documented to work independently of auto-review
#    configuration (docs.coderabbit.ai/guides/commands), so an installed app
#    answers a direct request even with `auto_review.enabled: false`. Post this
#    on an OPEN pr and wait:
#        @coderabbitai review
#    Any reply, including a refusal or a config dump from `@coderabbitai
#    configuration`, means INSTALLED, and the fault is settings, not the grant.
#    Silence, with steps 1 to 3 also at zero, is the strongest reading available
#    without the browser. It is still "not installed OR disabled account-side",
#    never "not installed" alone.
```

## Read the result

| Signal | Strength | Meaning | Fix |
|---|---|---|---|
| Zero comments unbounded on both endpoints, control non-zero, **and silence after an explicit `@coderabbitai review`** | strong, still not conclusive | Not installed for this owner account, **or** installed and disabled account-side | Settings page decides which; install or re-enable |
| Zero comments unbounded, but no explicit-trigger probe was run | **inconclusive** | Indistinguishable from a repo disabled in the dashboard or excluded since day one | Run step 4 before concluding |
| No `coderabbit` check-suite slug, **and** the control repo has one | corroborating | Agrees with the row above; cannot carry the diagnosis alone | Same |
| Zero comments but the query carried a `since=` | **none** | Bounded window, not "ever". Re-run unbounded before concluding anything | rerun step 1 |
| **Any** reply to `@coderabbitai review`, however unhelpful | conclusive | Installed. The fault is configuration or the dashboard, never the grant | `.coderabbit.yaml` or dashboard |
| Comments exist but stopped on a date | conclusive | Subscription lapsed, or the repo was dropped from the installation grant | Dashboard, below |
| Comments exist and are recent, this PR has none | conclusive | Real config exclusion: check `path_filters`, `ignore_title_keywords`, `ignore_usernames`, `base_branches`, `drafts` | `.coderabbit.yaml` |

Only the rows marked conclusive may end the investigation, and **no row reachable without
the browser is conclusive for "not installed"**. That asymmetry is the point: a reply
proves presence outright, while absence never fully proves absence, so the honest verdict
from a session is always "not installed or disabled account-side, settings page not read".
A valid config is not evidence of a running reviewer, and neither is a bounded zero, a
missing check-suite, nor an unbounded zero on its own.

The installation list itself is the one direct answer, and it is not reachable from a
session: `gh api /user/installations` returns 403 on a normal user token ("must
authenticate with an access token authorized to a GitHub App"). So the direct path is
https://github.com/settings/installations and https://app.coderabbit.ai, both browser-only.
When the browser is unavailable, steps 1 to 4 together are the strongest evidence you can
get, and the verdict should say so rather than implying the settings page was read.

## The leading hypothesis: installation is per owner account, not per repo

The GitHub App is installed on an organization or on a user account, and each installation
carries its own repository grant. An org installation does not cover a personal repo owned
by a member of that org, even for the same person and the same subscription. That fits
orchestkit: `Yonatan-HQ/platform` (org-owned) had CodeRabbit on 238 of 311 non-bot PRs
since 2026-08-20, while `yonatangross/orchestkit` (user-owned, public) had zero over the
same window with the identical query.

It is a hypothesis, not a reading. The competing explanation, that the app is installed on
the personal account and the repo is switched off in the CodeRabbit dashboard, produces the
same four zeros. The two are separated at the settings page and nowhere else, and steps 1
and 2 below cover both: whoever opens that page will see immediately which one it was.

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
