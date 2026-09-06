#!/usr/bin/env bash
# strict-mode: opt-out sourced library; it defines one variable and must not
# change the caller's shell options.
#
# The ONE source for the branch names that skip the version-bump gate (#1460).
#
# Sourced by both consumers:
#   bin/git-hooks/pre-push                (local, before the push)
#   .github/workflows/version-check.yml   (CI, "Check if version bump required")
#
# release-please is "release-type: simple" and computes the next version from
# conventional-commit types since the last tag. A manual bump on one of these
# branches creates a "ghost version" when the two disagree (#1457), so the gate
# stands down on every conventional-commit prefix (issue/ and bug/ included,
# see CONTRIBUTING.md "Branch naming"), on release-please's own PR branches,
# and on Dependabot branches, which never carry a version bump. Bare-named
# branches (hotfixes) are still enforced.
#
# #1458 mirrored this alternation into both consumers and held them equal with
# a drift test. That made drift loud, not impossible. Now there is one copy.
#
# Consumers must refuse to decide when this variable is empty or unset. In
# bash an empty ERE is a compile error that `[[ =~ ]]` reports as NO MATCH
# (rc 2 on /bin/bash 3.2, rc 1 on bash 5, measured 2026-09-06), so a blank
# pattern would silently ENFORCE the bump on every branch, the inverse of the
# #1457 failure. tests/ci/fault-arms/version-skip-pattern.sh proves both
# consumers fail (not skip, not enforce) with this file emptied or missing.
VERSION_SKIP_PATTERN='^(docs|chore|ci|style|test|feat|fix|perf|refactor|issue|bug)/|^release-please|^dependabot/'
export VERSION_SKIP_PATTERN
