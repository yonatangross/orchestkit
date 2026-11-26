#!/usr/bin/env bash
# docs/site/scripts/vercel-ignore.sh on main: build only when a site input
# changed since the last successful deployment. Exit 1 = build, exit 0 = skip.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/../../docs/site/scripts/vercel-ignore.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0

g() { git -C "$tmp" -c user.email=t@example.invalid -c user.name=t "$@"; }

commit_file() { # path
	mkdir -p "$tmp/$(dirname "$1")"
	echo "$RANDOM$RANDOM" >>"$tmp/$1"
	g add -A
	g commit -q --no-gpg-sign -m "touch $1"
}

expect() { # name want_rc ref prev
	local rc=0
	(cd "$tmp/docs/site" && VERCEL_GIT_COMMIT_REF="$3" VERCEL_GIT_PREVIOUS_SHA="$4" \
		VERCEL_GIT_COMMIT_MESSAGE="x" bash "$script" >/dev/null 2>&1) || rc=$?
	if [ "$rc" -eq "$2" ]; then
		echo "ok   $1"
	else
		echo "FAIL $1: rc $rc, want $2"
		fail=1
	fi
}

g init -q
commit_file docs/site/page.mdx

for input in docs/site/page.mdx scripts/seo/link-graph.mjs scripts/lib/parse-frontmatter.js \
	shared/cc-support.json manifests/ork.json package.json package-lock.json version.txt \
	docs/lab/page.html; do
	prev="$(g rev-parse HEAD)"
	commit_file "$input"
	expect "main builds when $input changed" 1 main "$prev"
done

prev="$(g rev-parse HEAD)"
commit_file src/hooks/a.ts
commit_file tests/unit/b.sh
expect "main skips when only non-site files changed" 0 main "$prev"

prev="$(g rev-parse HEAD)"
commit_file docs/site/page.mdx
commit_file src/hooks/a.ts
expect "main builds when an earlier undeployed commit changed the site" 1 main "$prev"

expect "main builds with no previous SHA" 1 main ""
expect "main builds when the previous SHA is not in the clone" 1 main 0123456789012345678901234567890123456789
expect "main builds on a redeploy of the deployed SHA" 1 main "$(g rev-parse HEAD)"
expect "unknown ref builds" 1 "" ""
expect "other branch skips" 0 feat/x ""

exit "$fail"
