# `vendor/` — vendored third-party data

Read-only data vendored from external projects. Not authored here; kept in the
repo so builds are reproducible without network access.

- **`vercel-skills/mapping.json`** + **`vercel-skills/manifest.json`** — the
  mapping of upstream Vercel Labs skills to their OrchestKit equivalents.

## Load-bearing

`scripts/sync-vercel-skills.sh` reads `vendor/vercel-skills/mapping.json` (as its
`MAPPING_FILE`) to sync the vendored skills. The path is hardcoded in that
script — do not move without updating it.
