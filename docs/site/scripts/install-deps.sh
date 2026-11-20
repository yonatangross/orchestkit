#!/usr/bin/env bash
# Install docs dependencies for CI, Vercel, and local contributors.
# Auth failures use the local analytics stub, except in Vercel production.
# Restore the original manifest and lockfile on exit.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
backup=$(mktemp -d)
cp package.json package-lock.json "$backup/"
cleanup() {
  cp "$backup/package.json" package.json
  cp "$backup/package-lock.json" package-lock.json
  rm -rf "$backup"
}
trap cleanup EXIT

set +e
npm ci --no-audit --no-fund 2>&1 | tee "$backup/npm-ci.log"
npm_exit=${PIPESTATUS[0]}
set -e
if [[ $npm_exit -eq 0 ]]; then
  echo "${GITHUB_ACTIONS:+::notice::}docs-install: @yonatan-hq/analytics installed from the private registry"
  exit 0
fi
if grep -qE "401 Unauthorized|E401|unauthenticated" "$backup/npm-ci.log"; then
  # Production never ships the no-op stub: a dead NPM_TOKEN fails the build
  # here, by name, instead of deploying a site with analytics silently off.
  if [[ "${VERCEL_ENV:-}" == "production" ]]; then
    echo "docs-install: npm ci hit 401 on @yonatan-hq/analytics in production; NPM_TOKEN is missing or dead, refusing the stub" >&2
    exit "$npm_exit"
  fi
  echo "${GITHUB_ACTIONS:+::notice::}docs-install: npm ci hit 401 on @yonatan-hq/analytics (exit $npm_exit), swapping to the local stub"
  npm pkg set 'dependencies.@yonatan-hq/analytics=file:../stubs/analytics-stub'
  # Update the lock in place, never delete it: a fresh resolve floated
  # fumadocs-ui past the locked version and broke every prod build (TS2724,
  # 2026-10-11 to 2026-10-14). Only the swapped entry changes.
  npm install --no-audit --no-fund --package-lock-only --ignore-scripts
  npm ci --no-audit --no-fund
  exit 0
fi
echo "docs-install: npm ci failed with exit $npm_exit for a reason other than auth" >&2
exit "$npm_exit"
