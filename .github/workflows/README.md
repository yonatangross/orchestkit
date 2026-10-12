# Release announce rail

`release-announce.yml` sends published release facts to the Yonatan-HQ marketing
intake. The platform creates drafts only. It never publishes a social post.

For a live announce, the workflow first runs an authenticated platform dry-run.
This validates `HQ_API_TOKEN` before the live POST and does not create drafts.
Manual dispatches with `dry_run: true` remain fully local and skip the preflight.

## Rotate `HQ_API_TOKEN`

If the preflight reports an authentication failure, rotate
`op://<vault>/<item>/credential`. Read the replacement once through
the estate chokepoint with a bounded cache, then update the repository secret:

```bash
HQ_API_TOKEN="$(~/.claude/hooks/op-read.sh --cache 3600 \
  op://<vault>/<item>/credential)"
op_read_status=$?
if [[ "$op_read_status" -ne 0 ]]; then
  echo "Failed to read the replacement token through op-read.sh" >&2
  exit "$op_read_status"
fi
if [[ -z "$HQ_API_TOKEN" ]]; then
  echo "op-read.sh returned an empty replacement token" >&2
  exit 1
fi
printf '%s' "$HQ_API_TOKEN" | \
  gh secret set HQ_API_TOKEN --repo yonatangross/orchestkit
unset HQ_API_TOKEN
```

Do not put a token in this repository or add a raw `op read` command to the
workflow. The GitHub secret is the rail's credential boundary. After updating
it, manually dispatch `Release Announce` with the target version and
`dry_run: false`; a successful run queues drafts for the normal human approval
flow.

# X changelog feed

`release-changelog-x.yml` writes facts-only changelog posts for X to the job
summary. It is preview only: this build has no X client and no X secrets, and
`scripts/changelog-x.mjs` refuses `DRY_RUN=false`. Nothing is posted to X.

What it would post:

- **Stable release** (`release: published`, not a prerelease): one post with a
  headline and the top 3 changes from the `CHANGELOG.md` section for the tag. It
  makes a thread when there are more than 3 changes. The link goes to the docs
  changelog with `utm_source=x&utm_medium=social&utm_campaign=v<version>`. The
  preview names `release-<version>-square.gif` from `release-video.yml` as the
  media when that asset exists.
- **Beta digest** (nightly, 23:30 UTC): one post when one or more prereleases
  shipped in the last 24 hours. There is no post for each beta.
- **Upstream** (nightly, 23:30 UTC): the new sections of the
  `anthropics/claude-code` `CHANGELOG.md`. It uses no LLM. The last seen version
  is in the Actions cache. With no cache entry, the job records the head and
  posts nothing. `hq-ext` is a disabled source in `scripts/changelog-x.mjs`
  because it needs a token that can read `Yonatan-HQ/hq-ext-plugin`.

Each post is 280 weighted characters or less. The only hashtag is `#ClaudeCode`.

## Live posting

Not in this build. Turning the feed on is a separate, reviewed change that adds
the X client back. Settle these first: the `upstream` job would hold
third-party changelog text, the X secrets and the post path in one job (a review
step, or the job stays preview only), and one live test post on a working
account confirms the media upload.

