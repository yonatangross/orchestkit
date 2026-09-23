#!/usr/bin/env bash
# #4220 IC-8: bump-version sync_versions must not stamp pinned marketplace
# entries whose source.ref is not main.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/.claude-plugin"
cat > "$TMP/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "version": "1.0.0",
  "plugins": [
    {"name": "ork", "version": "9.8.0", "source": {"source": "git-subdir", "ref": "v9.8.0"}},
    {"name": "ork-alpha", "version": "1.0.0", "source": {"source": "git-subdir", "ref": "main"}}
  ]
}
JSON

# Extract and run only sync_versions against TMP by sourcing a stub.
# Call the jq fragment identical to bin/bump-version.sh.
version="10.0.0-beta.99"
marketplace="$TMP/.claude-plugin/marketplace.json"
jq --arg v "$version" '
  .version = $v
  | (if any(.plugins[]; .source.ref? == "main")
     then (.plugins[] | select(.source.ref? == "main") | .version) |= $v
     else .
     end)' "$marketplace" > "$marketplace.tmp"
mv "$marketplace.tmp" "$marketplace"

pinned=$(jq -r '.plugins[] | select(.name=="ork") | .version' "$marketplace")
track=$(jq -r '.plugins[] | select(.name=="ork-alpha") | .version' "$marketplace")
top=$(jq -r '.version' "$marketplace")

if [[ "$pinned" != "9.8.0" ]]; then
  echo "FAIL: pinned ork version moved to $pinned"
  exit 1
fi
if [[ "$track" != "10.0.0-beta.99" ]]; then
  echo "FAIL: tracking ork-alpha not stamped (got $track)"
  exit 1
fi
if [[ "$top" != "10.0.0-beta.99" ]]; then
  echo "FAIL: top-level version not stamped (got $top)"
  exit 1
fi
echo "PASS: IC-8 pinned marketplace entry untouched"
