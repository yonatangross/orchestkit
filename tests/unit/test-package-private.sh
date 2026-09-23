#!/usr/bin/env bash
# #4220 AF-32: root package.json must be private so npm publish cannot leak the tree.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
priv=$(jq -r '.private // false' "$ROOT/package.json")
if [[ "$priv" != "true" ]]; then
  echo "FAIL: package.json private is $priv (want true)"
  exit 1
fi
echo "PASS: package.json private=true"
