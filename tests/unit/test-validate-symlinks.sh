#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture="$(mktemp -d "${TMPDIR:-/tmp}/ork-validate-symlinks.XXXXXX")"
trap 'rm -rf "$fixture"' EXIT

mkdir -p "$fixture/bin" "$fixture/plugins/ork/skills/example" \
  "$fixture/plugins/ork-extras/agents" "$fixture/plugins/ork-extras/commands" \
  "$fixture/plugins/ork-extras/scripts"
cp "$PROJECT_ROOT/bin/validate-symlinks.sh" "$fixture/bin/"
touch "$fixture/plugins/ork/skills/example/SKILL.md" \
  "$fixture/plugins/ork-extras/agents/copied.md" \
  "$fixture/plugins/ork-extras/commands/copied.md"
ln -s skills/example "$fixture/plugins/ork/valid-link"
ln -s missing "$fixture/outside-plugins"

if ! output="$(bash "$fixture/bin/validate-symlinks.sh" 2>&1)" ||
  [[ "$output" != "No broken symlinks in plugins/" ]]; then
  printf 'Expected a clean result with valid links, copies, and no legacy plugins; got:\n%s\n' "$output" >&2
  exit 1
fi
printf 'PASS: Resolving links and copied files pass without legacy plugins\n'

ln -s missing "$fixture/plugins/ork-extras/broken link"
status=0
output="$(bash "$fixture/bin/validate-symlinks.sh" 2>&1)" || status=$?
if [[ "$status" -ne 1 || "$output" != 'Broken symlink: plugins/ork-extras/broken link' ]]; then
  printf 'Expected only the broken link with exit 1; got exit %s:\n%s\n' "$status" "$output" >&2
  exit 1
fi
printf 'PASS: A broken plugin link is reported and exits 1\n'
