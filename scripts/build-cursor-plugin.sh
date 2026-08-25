#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/src/cursor/ork-cursor"
OUTPUT_DIR="$PROJECT_ROOT/plugins/ork-cursor"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CURSOR_MANIFEST="$PROJECT_ROOT/manifests/cursor/ork-cursor.json"

if [[ ! -f "$SOURCE_DIR/.cursor-plugin/plugin.json" ]]; then
  echo "Cursor plugin source is missing its manifest: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -f "$CURSOR_MANIFEST" ]] || [[ "$(jq -r '.name' "$CURSOR_MANIFEST")" != "ork-cursor" ]]; then
  echo "Cursor plugin source manifest is missing or invalid: $CURSOR_MANIFEST" >&2
  exit 1
fi

if [[ -e "$OUTPUT_DIR" ]]; then
  echo "Cursor plugin output must be cleaned by build-plugins.sh before assembly: $OUTPUT_DIR" >&2
  exit 1
fi

cp -R "$SOURCE_DIR" "$OUTPUT_DIR"

project_version="$(jq -r '.version' "$PACKAGE_JSON")"
jq --arg version "$project_version" '.version = $version' \
  "$OUTPUT_DIR/.cursor-plugin/plugin.json" > "$OUTPUT_DIR/.cursor-plugin/plugin.json.tmp"
mv "$OUTPUT_DIR/.cursor-plugin/plugin.json.tmp" "$OUTPUT_DIR/.cursor-plugin/plugin.json"

if jq -e '.mcpServers or .hooks or .commands' "$OUTPUT_DIR/.cursor-plugin/plugin.json" >/dev/null; then
  echo "Cursor adapter must not register mcpServers, hooks, or commands" >&2
  exit 1
fi

echo "  Cursor plugin assembled: ork-cursor v$project_version"
