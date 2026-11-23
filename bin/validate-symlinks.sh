#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

broken_links="$(find plugins -type l ! -exec test -e {} \; -exec printf 'Broken symlink: %s\n' {} +)"
if [[ -n "$broken_links" ]]; then
  printf '%s\n' "$broken_links" >&2
  exit 1
fi

printf 'No broken symlinks in plugins/\n'
