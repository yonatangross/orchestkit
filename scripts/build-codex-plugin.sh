#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/src/codex/ork-codex"
OUTPUT_DIR="$PROJECT_ROOT/plugins/ork-codex"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CODEX_MANIFEST="$PROJECT_ROOT/manifests/codex/ork-codex.json"

if [[ ! -f "$SOURCE_DIR/.codex-plugin/plugin.json" ]]; then
  echo "Codex plugin source is missing its manifest: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -f "$CODEX_MANIFEST" ]] || [[ "$(jq -r '.name' "$CODEX_MANIFEST")" != "ork-codex" ]]; then
  echo "Codex plugin source manifest is missing or invalid: $CODEX_MANIFEST" >&2
  exit 1
fi

if [[ -e "$OUTPUT_DIR" ]]; then
  echo "Codex plugin output must be cleaned by build-plugins.sh before assembly: $OUTPUT_DIR" >&2
  exit 1
fi

cp -R "$SOURCE_DIR" "$OUTPUT_DIR"

project_version="$(jq -r '.version' "$PACKAGE_JSON")"
jq --arg version "$project_version" '.version = $version' \
  "$OUTPUT_DIR/.codex-plugin/plugin.json" > "$OUTPUT_DIR/.codex-plugin/plugin.json.tmp"
mv "$OUTPUT_DIR/.codex-plugin/plugin.json.tmp" "$OUTPUT_DIR/.codex-plugin/plugin.json"

echo "  Codex plugin assembled: ork-codex v$project_version"
