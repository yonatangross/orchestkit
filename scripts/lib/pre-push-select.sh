#!/bin/bash
# Targeted-mode selection for bin/git-hooks/pre-push (#4238).
#
# Sourced library, not a script. Every function is pure: CHANGED_FILES (a
# newline-separated list of repo-relative paths) is the only input, stdout is
# the only output. No git calls, no writes, no clock. A test points
# PRE_PUSH_SELECT_UNIT_DIR at a fixture directory instead of tests/unit.
#
# A path counts as "code" the same way the hook's version gate counts it:
# anything not matching *.md, *.txt, or docs/.

_pre_push_select_is_code() {
  case "$1" in
    *.md|*.txt|docs/*) return 1 ;;
    *) return 0 ;;
  esac
}

# Unit test files that should run for this diff, one per line:
#   1. every tests/unit/test-*.sh / test-*.mjs that names a changed path, and
#   2. every changed path that is itself a unit test file.
# When a code diff matches nothing, a one-file smoke pick keeps a local
# signal on the push (override with PRE_PUSH_SELECT_SMOKE; empty disables).
# A docs-only diff selects nothing on purpose: CI runs the suite on the PR.
pre_push_select_unit_tests() {
  local unit_dir="${PRE_PUSH_SELECT_UNIT_DIR:-tests/unit}"
  local changed="${CHANGED_FILES:-}"
  local f hits="" code=0

  while IFS= read -r f || [[ -n "$f" ]]; do
    [[ -n "$f" ]] || continue
    if _pre_push_select_is_code "$f"; then
      code=1
    else
      # Doc paths feed nothing: tests that happen to name README.md or a
      # docs page would otherwise elect themselves on every docs-only push,
      # and the contract for this mode is that docs-only selects zero.
      continue
    fi
    case "$f" in
      tests/unit/test-*.sh|tests/unit/test-*.mjs)
        [[ -f "$unit_dir/$(basename "$f")" ]] && hits+="$unit_dir/$(basename "$f")"$'\n'
        ;;
    esac
    if [[ -d "$unit_dir" ]]; then
      # -e, not a bare pattern arg: a changed path that started with a dash
      # would read as a flag. grep -lF is a literal substring match.
      hits+="$(grep -lF -e "$f" "$unit_dir"/test-*.sh "$unit_dir"/test-*.mjs 2>/dev/null || true)"
      hits+=$'\n'
    fi
  done <<< "$changed"

  hits=$(printf '%s\n' "$hits" | awk 'NF' | sort -u)
  if [[ -z "$hits" && "$code" -eq 1 ]]; then
    local smoke="${PRE_PUSH_SELECT_SMOKE-tests/unit/test-pre-push-hook.sh}"
    if [[ -n "$smoke" ]]; then
      if [[ -f "$smoke" ]]; then
        hits="$smoke"
      elif [[ -f "$unit_dir/$(basename "$smoke")" ]]; then
        hits="$unit_dir/$(basename "$smoke")"
      fi
    fi
  fi
  printf '%s\n' "$hits" | awk 'NF'
}

# Whether the diff touches a path the security suite exists to guard:
# the hook chain itself (src/hooks, bin/), the scripts the hook and the build
# source (scripts/), the security suite and its fault arms (tests/security,
# tests/ci), the CI definitions (.github), any hooks.json anywhere, and the
# secret-scan configuration (.gitleaks.toml and friends): the suite's own
# findings are driven by that config, so editing it IS a security change.
# Anything narrower than this list is a content change the suite cannot see.
pre_push_select_wants_security() {
  local f
  while IFS= read -r f || [[ -n "$f" ]]; do
    [[ -n "$f" ]] || continue
    case "$f" in
      src/hooks/*|scripts/*|bin/*|tests/security/*|tests/ci/*|.github/*|*hooks.json|\
.gitleaks.toml|*gitleaks*|.secrets.baseline|.secretlintrc*)
        return 0
        ;;
    esac
  done <<< "${CHANGED_FILES:-}"
  return 1
}

# Whether the diff touches an input of tsc (src/hooks) or of the build
# (src/, manifests/). Both stages share one answer because a src/ change is
# the common case for both; skipping either on a docs-only push is the point.
pre_push_select_wants_src_stages() {
  local f
  while IFS= read -r f || [[ -n "$f" ]]; do
    [[ -n "$f" ]] || continue
    case "$f" in
      src/*|manifests/*)
        return 0
        ;;
    esac
  done <<< "${CHANGED_FILES:-}"
  return 1
}
