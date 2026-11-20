#!/usr/bin/env bash
# Guards #4539: a front-door router skill must not use `context: fork`.
# A router hands the caller's own follow-up to a specialist. Under fork it
# runs in a fresh context, so a follow-up such as "now fix that" loses the
# conversation it refers to. A router is a skill whose frontmatter
# description says "DEFAULT entry point" or "front door".
#
# The check runs on a fixture first (a forked router must fail, an inherit
# router must pass), then on src/skills.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Prints one line per forked router under $1; returns 1 if any.
check_dir() {
  local dir="$1" bad=0 f desc ctx
  for f in "$dir"/*/SKILL.md; do
    [[ -f "$f" ]] || continue
    desc=$(awk '/^---$/{n++; next} n==1 && /^description:/' "$f")
    case "$desc" in
      *"DEFAULT entry point"*|*"front door"*) ;;
      *) continue ;;
    esac
    ctx=$(awk '/^---$/{n++; next} n==1 && /^context:/ { print $2 }' "$f")
    if [[ "$ctx" == "fork" ]]; then
      echo "FAIL: router skill uses context: fork: $f"
      bad=1
    fi
  done
  return "$bad"
}

fixture=$(mktemp -d "${TMPDIR:-/tmp}/router-ctx.XXXXXX")
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/forked" "$fixture/inherit"
printf -- '---\nname: forked\ndescription: "The DEFAULT entry point for any goal."\ncontext: fork\n---\nbody\n' > "$fixture/forked/SKILL.md"
printf -- '---\nname: inherit\ndescription: "One front door for visual answers."\ncontext: inherit\n---\nbody\n' > "$fixture/inherit/SKILL.md"

if check_dir "$fixture" > /dev/null; then
  echo "FAIL: self-test, a forked router fixture was not caught"
  exit 1
fi
rm -rf "$fixture/forked"
if ! check_dir "$fixture"; then
  echo "FAIL: self-test, an inherit router fixture was refused"
  exit 1
fi

check_dir "$ROOT/src/skills"
echo "PASS: no front-door router skill uses context: fork"
