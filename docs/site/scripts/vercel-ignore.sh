#!/usr/bin/env bash
# Vercel "Ignored Build Step" for the docs site (vercel.json -> ignoreCommand).
# Runs from docs/site. Exit 1 = build, exit 0 = skip.
#
#   main            builds when a site input changed since the last successful
#                   deployment; also with no usable previous SHA or on a redeploy.
#   unknown ref     builds: when Vercel does not expose VERCEL_GIT_COMMIT_REF
#                   to this step, failing toward a build is the safe answer.
#   other branches  skipped, unless the head commit message contains [preview].
#                   A requested preview builds when docs/site changed since the
#                   branch's last successful deployment ($VERCEL_GIT_PREVIOUS_SHA).
#                   When that SHA is empty or missing from the shallow clone, it builds.
#
# release-please--** and dependabot/** never reach this script:
# vercel.json git.deploymentEnabled turns their deployments off.
#
# Request a preview:  git commit --allow-empty -m "chore: request preview [preview]" && git push
set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"
msg="${VERCEL_GIT_COMMIT_MESSAGE:-}"
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$ref" ]; then
	echo "vercel-ignore: build (ref unknown, fails toward building)"
	exit 1
fi

if [ "$ref" = "main" ]; then
	# Everything the site build reads: this folder, the shared generators and
	# data it imports, the root manifests, and any HTML page a lab entry copies.
	# A new input outside this list must be added here, or main will not redeploy
	# when it changes.
	inputs=(
		':(top)docs/site' ':(top)scripts/seo' ':(top)scripts/lib' ':(top)shared'
		':(top)manifests' ':(top)package.json' ':(top)package-lock.json'
		':(top)version.txt' ':(top,glob)**/*.html'
	)
	# git's own error for a missing commit stays in the build log.
	if [ -z "$prev" ] || ! git cat-file -e "${prev}^{commit}"; then
		echo "vercel-ignore: build (main, no usable previous SHA)"
		exit 1
	fi
	# The same SHA again is a redeploy someone asked for.
	if [ "$(git rev-parse "${prev}^{commit}")" = "$(git rev-parse HEAD)" ]; then
		echo "vercel-ignore: build (main, redeploy of ${prev:0:7})"
		exit 1
	fi
	# Any other git result, an error included, builds.
	if git diff --quiet "$prev" HEAD -- "${inputs[@]}"; then
		echo "vercel-ignore: skip main (no site input changed since ${prev:0:7})"
		exit 0
	fi
	echo "vercel-ignore: build (main, site inputs changed since ${prev:0:7})"
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
