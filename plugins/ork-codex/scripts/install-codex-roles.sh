#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../roles"
DESTINATION="${1:-}"

if [[ -z "$DESTINATION" ]]; then
  echo "usage: $0 <destination-directory>" >&2
  exit 2
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "role templates not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$DESTINATION"

for source in "$SOURCE_DIR"/*.toml; do
  name="$(basename "$source")"
  target="$DESTINATION/$name"
  if [[ -e "$target" ]]; then
    echo "refusing to overwrite existing role: $target" >&2
    exit 1
  fi
  install -m 0644 "$source" "$target"
done

echo "Installed OrchestKit Codex roles in $DESTINATION"
