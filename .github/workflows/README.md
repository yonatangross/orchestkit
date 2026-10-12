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

`release-changelog-x.yml` writes facts-only changelog posts for X. It is off by
default. Every job runs as a dry run and writes the posts to the job summary
only. It does not post to X until you turn it on.

What it posts:

- **Stable release** (`release: published`, not a prerelease): one post with a
  headline and the top 3 changes from the `CHANGELOG.md` section for the tag. It
  makes a thread when there are more than 3 changes. The link goes to the docs
  changelog with `utm_source=x&utm_medium=social&utm_campaign=v<version>`. The
  post gets `release-<version>-square.gif` from `release-video.yml` when that
  asset exists. If it does not exist after 25 minutes, the post has no media.
- **Beta digest** (nightly, 23:30 UTC): one post when one or more prereleases
  shipped in the last 24 hours. There is no post for each beta.
- **Upstream** (nightly, 23:30 UTC): the new sections of the
  `anthropics/claude-code` `CHANGELOG.md`. It uses no LLM. The last seen version
  is in the Actions cache. With no cache entry, the job records the head and
  posts nothing. `hq-ext` is a disabled source in `scripts/changelog-x.mjs`
  because it needs a token that can read `Yonatan-HQ/hq-ext-plugin`.

Each post is 280 weighted characters or less. The only hashtag is `#ClaudeCode`.

## Turn it on

1. Set the 4 repository secrets from an X app with OAuth 1.0a user context and
   read and write access:

   ```bash
   gh secret set X_API_KEY
   gh secret set X_API_SECRET
   gh secret set X_ACCESS_TOKEN
   gh secret set X_ACCESS_SECRET
   ```

2. Do a dry run and read the job summary:

   ```bash
   gh workflow run release-changelog-x.yml -f mode=upstream
   ```

3. Set the variable. The value must be exactly `true`:

   ```bash
   gh variable set CHANGELOG_X_ENABLED --body true
   ```

To turn it off, set `CHANGELOG_X_ENABLED` to another value or delete it. A
manual run posts only when the variable is `true` and you set `dry_run` to
`false`.
