#!/usr/bin/env bash
# Test: Validates marketplace structure follows Claude Code conventions
# - No plugin should use source: "./" (prevents auto-install behavior)
# - All plugins should use source: "./plugins/{name}" format
# - Root .claude-plugin/ should only contain marketplace.json
# - All referenced plugin paths should exist
#
# Based on official Claude Code marketplace architecture:
# https://github.com/anthropics/claude-code/blob/main/.claude-plugin/marketplace.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

ERRORS=0
WARNINGS=0

echo "=== Marketplace Structure Validation ==="
echo ""

# Check if marketplace.json exists
if [[ ! -f "$MARKETPLACE_JSON" ]]; then
  echo "❌ ERROR: marketplace.json not found at $MARKETPLACE_JSON"
  exit 1
fi
echo "✓ marketplace.json exists"

# Test 1: No plugin should use source: "./"
echo ""
echo "--- Test 1: Check for root source path ---"
# Look for "source": "./" pattern (exact root reference)
ROOT_SOURCE_COUNT=$(grep -cE '"source"[[:space:]]*:[[:space:]]*"\\./"' "$MARKETPLACE_JSON" 2>/dev/null || true)
ROOT_SOURCE_COUNT=${ROOT_SOURCE_COUNT:-0}
if [ "$ROOT_SOURCE_COUNT" -gt 0 ]; then
  echo "❌ ERROR: Found $ROOT_SOURCE_COUNT plugin(s) using 'source: \"./\"'"
  echo "   This causes auto-install when marketplace is added!"
  echo "   All plugins should use 'source: \"./plugins/{name}\"' format"
  grep -n '"source".*"\\./"' "$MARKETPLACE_JSON" | head -5
  ((ERRORS++))
else
  echo "✓ No plugins use root source path (./)"
fi

# Test 2: All plugins should use ./plugins/* format
echo ""
echo "--- Test 2: Validate source path format ---"
# Extract all source values that are strings (not objects) and check they start with ./plugins/
INVALID_SOURCES=$(grep -E '"source"[[:space:]]*:[[:space:]]*"[^{]' "$MARKETPLACE_JSON" | grep -v './plugins/' || true)
if [[ -n "$INVALID_SOURCES" ]]; then
  echo "❌ ERROR: Found plugins with invalid source format:"
  echo "$INVALID_SOURCES"
  echo "   All local plugins should use 'source: \"./plugins/{name}\"'"
  ((ERRORS++))
else
  echo "✓ All plugins use correct ./plugins/* source format"
fi

# Test 3: Root .claude-plugin should only contain marketplace.json
echo ""
echo "--- Test 3: Root .claude-plugin contents ---"
ROOT_PLUGIN_DIR="$REPO_ROOT/.claude-plugin"
if [[ -f "$ROOT_PLUGIN_DIR/plugin.json" ]]; then
  echo "❌ ERROR: Found plugin.json in root .claude-plugin/"
  echo "   Root should only contain marketplace.json (catalog)"
  echo "   Plugin definition should be in plugins/ork/.claude-plugin/plugin.json"
  ((ERRORS++))
else
  echo "✓ Root .claude-plugin/ does not contain plugin.json"
fi

# Check what files exist
ROOT_FILES=$(ls -1 "$ROOT_PLUGIN_DIR" 2>/dev/null | grep -v "^marketplace.json$" || true)
if [[ -n "$ROOT_FILES" ]]; then
  echo "⚠ WARNING: Extra files in root .claude-plugin/:"
  echo "$ROOT_FILES"
  ((WARNINGS++))
else
  echo "✓ Root .claude-plugin/ only contains marketplace.json"
fi

# Test 4: All referenced plugin paths should exist
echo ""
echo "--- Test 4: Validate plugin paths exist ---"
MISSING_PATHS=0
# Extract all local source paths using sed (macOS compatible)
while IFS= read -r line; do
  # Extract path from "source": "./plugins/xxx"
  source_path=$(echo "$line" | sed -n 's/.*"source"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

  # Skip empty, external, or non-plugins paths
  [[ -z "$source_path" ]] && continue
  [[ "$source_path" != "./plugins/"* ]] && continue

  FULL_PATH="$REPO_ROOT/$source_path"
  if [[ ! -d "$FULL_PATH" ]]; then
    echo "❌ ERROR: Plugin path does not exist: $source_path"
    ((MISSING_PATHS++))
  fi
done < <(grep '"source"' "$MARKETPLACE_JSON")

if [[ $MISSING_PATHS -eq 0 ]]; then
  echo "✓ All plugin paths exist"
else
  ((ERRORS++))
fi

# Test 5: Each plugin directory should have .claude-plugin/plugin.json
echo ""
echo "--- Test 5: Plugin directories have plugin.json ---"
MISSING_MANIFESTS=0
while IFS= read -r line; do
  source_path=$(echo "$line" | sed -n 's/.*"source"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

  [[ -z "$source_path" ]] && continue
  [[ "$source_path" != "./plugins/"* ]] && continue

  MANIFEST_PATH="$REPO_ROOT/$source_path/.claude-plugin/plugin.json"
  if [[ ! -f "$MANIFEST_PATH" ]]; then
    echo "❌ ERROR: Missing plugin.json at: $source_path/.claude-plugin/plugin.json"
    ((MISSING_MANIFESTS++))
  fi
done < <(grep '"source"' "$MARKETPLACE_JSON")

if [[ $MISSING_MANIFESTS -eq 0 ]]; then
  echo "✓ All plugins have .claude-plugin/plugin.json"
else
  ((ERRORS++))
fi

# Test 6: Count plugins and verify
echo ""
echo "--- Test 6: Plugin count verification ---"
# Count plugins using jq if available, otherwise use grep with context
if command -v jq &>/dev/null; then
  PLUGIN_COUNT=$(jq '.plugins | length' "$MARKETPLACE_JSON")
else
  # Fallback: count lines with "source": (each plugin has exactly one)
  PLUGIN_COUNT=$(grep -c '"source":' "$MARKETPLACE_JSON" || echo "0")
fi
echo "  Total plugins in marketplace: $PLUGIN_COUNT"

PLUGIN_DIRS=$(find "$REPO_ROOT/plugins" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
echo "  Plugin directories: $PLUGIN_DIRS"

if [[ $PLUGIN_COUNT -ne $PLUGIN_DIRS ]]; then
  echo "⚠ WARNING: Mismatch between marketplace entries ($PLUGIN_COUNT) and plugin directories ($PLUGIN_DIRS)"
  ((WARNINGS++))
else
  echo "✓ Marketplace entries match plugin directories"
fi

# Summary
echo ""
echo "=== Summary ==="
if [[ $ERRORS -eq 0 ]]; then
  echo "✅ All marketplace structure tests passed!"
  if [[ $WARNINGS -gt 0 ]]; then
    echo "   ($WARNINGS warnings)"
  fi
  exit 0
else
  echo "❌ $ERRORS error(s) found, $WARNINGS warning(s)"
  echo ""
  echo "To fix auto-install issue:"
  echo "1. Move plugin to plugins/{name}/"
  echo "2. Change source from './' to './plugins/{name}'"
  echo "3. Remove plugin.json from root .claude-plugin/"
  exit 1
fi
