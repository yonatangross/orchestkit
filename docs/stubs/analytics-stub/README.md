# `@yonatan-hq/analytics` — CI stub

Used when the real package can't be installed (e.g., feature-branch PRs where
`NPM_TOKEN` is repo-secret-branch-scoped to `main`/`dev` and isn't exposed to
PRs from other branches).

## How the swap happens

`.github/workflows/docs.yml` detects an empty `NPM_TOKEN` before running
`npm ci` in `docs/site/`. When empty, it rewrites the `@yonatan-hq/analytics`
dependency to `file:../stubs/analytics-stub` so install resolves against this
local copy instead of the private GitHub Packages registry. Production
(`main` / `dev`) pushes have the token, use the real package, emit real
analytics.

## What's stubbed

- `HQAnalytics` React component — returns `null`
- `POST` / `OPTIONS` edge route handlers — return `204 No Content`

Both match the real package's export signatures so the Next.js build
compiles with zero further changes.

## When to update

Whenever the real `@yonatan-hq/analytics` package changes its exported
signatures in a way the consumer (`docs/site/`) depends on, mirror the new
shape here. The stub never needs behavior — only types + valid empty
implementations.
