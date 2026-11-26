#!/usr/bin/env bash
# Vercel "Ignored Build Step" for the docs site (vercel.json -> ignoreCommand).
# Runs from docs/site. Exit 1 = build, exit 0 = skip.
#
#   main            builds on release commits only ("chore(main): release ..." and
#                   "chore(release): pin stable channel to ..."), on a redeploy of
#                   the deployed SHA, when version.txt changed since the deployed
#                   SHA, or when the subject carries [deploy]. A docs fix that
#                   cannot wait for a release: add [deploy] to the subject.
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
	subject="${msg%%$'\n'*}"
	if [ -z "$subject" ]; then
		subject="$(git log -1 --format=%s)"
	fi
	if [ -z "$subject" ]; then
		echo "vercel-ignore: build (main, commit subject unknown, fails toward building)"
		exit 1
	fi
	case "$subject" in
	"chore(main): release "* | "chore(release): pin stable channel to "*)
		echo "vercel-ignore: build (main, release commit)"
		exit 1
		;;
	*"[deploy]"*)
		echo "vercel-ignore: build (main, [deploy] requested)"
		exit 1
		;;
	esac
	# A release that was never deployed (failed or replaced build) is picked up by
	# the next commit while its deployed predecessor is still in the clone. git's
	# own error for a missing commit stays in the build log.
	if [ -n "$prev" ] && git cat-file -e "${prev}^{commit}"; then
		# The same SHA again is a redeploy someone asked for.
		if [ "$(git rev-parse "${prev}^{commit}")" = "$(git rev-parse HEAD)" ]; then
			echo "vercel-ignore: build (main, redeploy of ${prev:0:7})"
			exit 1
		fi
		if ! git diff --quiet "$prev" HEAD -- ':(top)version.txt'; then
			echo "vercel-ignore: build (main, version changed since ${prev:0:7})"
			exit 1
		fi
	fi
	echo "vercel-ignore: skip main (not a release commit; add [deploy] to the subject to deploy)"
	exit 0
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
