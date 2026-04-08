#!/usr/bin/env bash
# Test: Verifies Vercel upstream references are present (Option E)
# Runs the sync script in --check mode to validate all refs exist on disk.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Upstream Reference Check ==="

# Verify mapping file exists
if [[ ! -f "$REPO_ROOT/vendor/vercel-skills/mapping.json" ]]; then
  echo "FAIL: vendor/vercel-skills/mapping.json not found"
  exit 1
fi

# Verify manifest exists (sync has been run at least once)
if [[ ! -f "$REPO_ROOT/vendor/vercel-skills/manifest.json" ]]; then
  echo "FAIL: vendor/vercel-skills/manifest.json not found (run: bash scripts/sync-vercel-skills.sh)"
  exit 1
fi

# Run check mode
if bash "$REPO_ROOT/scripts/sync-vercel-skills.sh" --check 2>&1; then
  echo ""
  echo "PASS: All upstream references present"
else
  echo ""
  echo "FAIL: Some upstream references missing (run: bash scripts/sync-vercel-skills.sh)"
  exit 1
fi
