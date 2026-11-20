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

# The passive hook is a manual configuration fragment, never an installer. Its
# runtime is a tracked, dependency-free module; the committed manifest pins
# the exact bytes so bare CI can assemble plugins without installing TypeScript.
# Package tests compile packages/jev-shadow/src/runtime.ts and prove it remains
# byte-identical to this artifact before a source change can land.
JEV_RUNTIME="$SOURCE_DIR/runtime/jev-shadow-runtime.mjs"
JEV_HASH="$(shasum -a 256 "$JEV_RUNTIME" | awk '{print $1}')"
EXPECTED_JEV_HASH="$(jq -r '.jevShadow.runtime_sha256 // empty' "$CODEX_MANIFEST")"
if [[ -z "$EXPECTED_JEV_HASH" || "$EXPECTED_JEV_HASH" == "PENDING_BUILD_HASH" ]]; then
  echo "Codex manifest must pin the Jev runtime SHA-256 before assembly" >&2
  exit 1
fi
if [[ "$JEV_HASH" != "$EXPECTED_JEV_HASH" ]]; then
  echo "Pinned Jev runtime SHA-256 does not match the built artifact" >&2
  exit 1
fi
mkdir -p "$OUTPUT_DIR/runtime"
cp "$JEV_RUNTIME" "$OUTPUT_DIR/runtime/jev-shadow-runtime.mjs"
printf '{\n  "runtime_sha256": "%s",\n  "contract_sha256": "%s"\n}\n' \
  "$JEV_HASH" "$(node -e "import('$JEV_RUNTIME').then((m) => console.log(m.JEV_SHADOW_CONTRACT_SHA256))")" \
  > "$OUTPUT_DIR/hooks/jev-shadow-runtime.integrity.json"

project_version="$(jq -r '.version' "$PACKAGE_JSON")"
jq --arg version "$project_version" '.version = $version' \
  "$OUTPUT_DIR/.codex-plugin/plugin.json" > "$OUTPUT_DIR/.codex-plugin/plugin.json.tmp"
mv "$OUTPUT_DIR/.codex-plugin/plugin.json.tmp" "$OUTPUT_DIR/.codex-plugin/plugin.json"

echo "  Codex plugin assembled: ork-codex v$project_version"
