#!/usr/bin/env bash
# Vercel "Ignored Build Step" for the docs site (vercel.json -> ignoreCommand).
# Runs from docs/site. Exit 1 = build, exit 0 = skip.
#
#   main            always builds.
#   other branches  skipped, unless the head commit message contains [preview].
#                   A requested preview builds when docs/site changed since the
#                   branch's last successful deployment ($VERCEL_GIT_PREVIOUS_SHA).
#                   When that SHA is empty or missing from the shallow clone, it builds.
#
# release-please--** and dependabot/** never reach this script:
# vercel.json git.deploymentEnabled turns their deployments off.
#
# Request a preview:  git commit --allow-empty -m "chore: request preview [preview]" && git push
set -uo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"
msg="${VERCEL_GIT_COMMIT_MESSAGE:-}"
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ "$ref" = "main" ]; then
	echo "vercel-ignore: main always builds"
	exit 1
fi

case "$msg" in
*"[preview]"*) ;;
*)
	echo "vercel-ignore: skip $ref (add [preview] to the commit message to build a preview)"
	exit 0
	;;
esac

if [ -z "$prev" ] || ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
	echo "vercel-ignore: [preview] requested, no usable previous SHA, building"
	exit 1
fi

if git diff --quiet "$prev" HEAD -- .; then
	echo "vercel-ignore: [preview] requested, docs/site unchanged since ${prev:0:7}, skipping"
	exit 0
fi

echo "vercel-ignore: [preview] requested, docs/site changed since ${prev:0:7}, building"
exit 1
