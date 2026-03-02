#!/bin/bash
# fileSuggestion hook — suggests key project files for @ autocomplete
# Reads query from stdin JSON, outputs matching file paths to stdout (max 15)

set -uo pipefail

QUERY=$(cat | jq -r '.query // ""' 2>/dev/null || echo "")

# Key project files — static list, zero latency
FILES=(
  "CLAUDE.md"
  "CHANGELOG.md"
  "CONTRIBUTING.md"
  "README.md"
  "package.json"
  "manifests/ork.json"
  "src/hooks/hooks.json"
  "src/settings/ork.settings.json"
  "pyproject.toml"
)

# Print files matching query (case-insensitive), max 15
count=0
for f in "${FILES[@]}"; do
  if [[ -z "$QUERY" ]] || [[ "${f,,}" == *"${QUERY,,}"* ]]; then
    echo "$f"
    count=$((count + 1))
    [[ $count -ge 15 ]] && break
  fi
done

exit 0
