# Release announce rail

`release-announce.yml` sends published release facts to the Yonatan-HQ marketing
intake. The platform creates drafts only. It never publishes a social post.

For a live announce, the workflow first runs an authenticated platform dry-run.
This validates `HQ_API_TOKEN` before the live POST and does not create drafts.
Manual dispatches with `dry_run: true` remain fully local and skip the preflight.

## Rotate `HQ_API_TOKEN`

If the preflight reports an authentication failure, rotate
`op://Platform/API-Static-Token/credential`. Read the replacement once through
the estate chokepoint with a bounded cache, then update the repository secret:

```bash
HQ_API_TOKEN="$(~/.claude/hooks/op-read.sh --cache 3600 \
  op://Platform/API-Static-Token/credential)"
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
