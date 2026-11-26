#!/usr/bin/env bash
# docs/site/scripts/vercel-ignore.sh on main: build on release commits only.
# Exit 1 = build, exit 0 = skip.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/../../docs/site/scripts/vercel-ignore.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0
ran=0

g() { git -C "$tmp" -c user.email=t@example.invalid -c user.name=t "$@"; }

commit_file() { # path subject
	mkdir -p "$tmp/$(dirname "$1")"
	echo "$RANDOM$RANDOM" >>"$tmp/$1"
	g add -A
	g commit -q --no-gpg-sign -m "$2"
}

expect() { # name want_rc want_text ref prev message
	local rc=0 out
	out="$(cd "$tmp/docs/site" && VERCEL_GIT_COMMIT_REF="$4" VERCEL_GIT_PREVIOUS_SHA="$5" \
		VERCEL_GIT_COMMIT_MESSAGE="$6" bash "$script" 2>&1)" || rc=$?
	ran=$((ran + 1))
	# The text proves the script reached the branch, not just that it exited.
	if [ "$rc" -eq "$2" ] && [[ "$out" == *"$3"* ]]; then
		echo "ok   $1"
	else
		echo "FAIL $1: rc $rc, want $2 with '$3', got: $out"
		fail=1
	fi
}

g init -q
commit_file version.txt "chore: start"
commit_file docs/site/page.mdx "docs: page"
deployed="$(g rev-parse HEAD)"
commit_file docs/site/page.mdx "docs: another page"
missing=0123456789012345678901234567890123456789

expect "ordinary commit skips" 0 "skip main" main "$deployed" "fix(hooks): x (#1)"
expect "ordinary commit skips with no previous SHA" 0 "skip main" main "" "fix: x"
expect "ordinary commit skips when the previous SHA left the clone" 0 "skip main" main "$missing" "fix: x"
expect "release commit builds" 1 "release commit" main "$deployed" "chore(main): release 10.20.1 (#5463)"
expect "channel pin commit builds" 1 "release commit" main "" "chore(release): pin stable channel to v10.20.1 (#5471)"
expect "release text in the body does not build" 0 "skip main" main "$deployed" $'fix: x\n\nchore(main): release 1.0.0 [deploy]'
expect "[deploy] in the subject builds" 1 "[deploy] requested" main "$deployed" "docs: urgent fix [deploy]"
expect "redeploy of the deployed SHA builds" 1 "redeploy" main "$(g rev-parse HEAD)" "docs: another page"
expect "subject is read from git when Vercel gives none" 0 "skip main" main "$deployed" ""

commit_file version.txt "chore: bump by hand"
commit_file docs/site/page.mdx "docs: after bump"
expect "an undeployed version change builds" 1 "version changed" main "$deployed" "docs: after bump"

expect "unknown ref builds" 1 "ref unknown" "" "" "fix: x"
expect "other branch skips" 0 "skip feat/x" feat/x "" "fix: x"

if [ "$ran" -ne 12 ]; then
	echo "FAIL ran $ran cases, want 12"
	fail=1
fi
exit "$fail"
