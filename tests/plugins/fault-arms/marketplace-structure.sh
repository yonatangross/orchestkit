#!/usr/bin/env bash
# Gate: tests/plugins/test-marketplace-structure.sh
# Pass condition: ERRORS == 0 (line 174). Tests 2, 4 and 5 all iterate over the
# entries of .plugins[]; Test 6's count mismatch is only a WARNING. A marketplace
# with "plugins": [] therefore records zero errors and prints
# "All marketplace structure tests passed!".
set -uo pipefail

REPO="${REPO:?set by the fault-arms runner}"
FIX="$H/fixtures/marketplace-structure"

rm -rf "$FIX"
for arm in control fault; do
  mkdir -p "$FIX/$arm/tests/plugins" "$FIX/$arm/.claude-plugin" \
           "$FIX/$arm/plugins/ork/.claude-plugin"
  cp "$REPO/tests/plugins/test-marketplace-structure.sh" "$FIX/$arm/tests/plugins/"
  cp "$REPO/plugins/ork/.claude-plugin/plugin.json" "$FIX/$arm/plugins/ork/.claude-plugin/"
done

# control: one entry with a string source pointing at the plugin dir that exists.
cat > "$FIX/control/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "owner": { "name": "Yonatan Gross" },
  "plugins": [
    { "name": "ork", "source": "./plugins/ork" }
  ]
}
JSON

# fault: the catalog is structurally valid but lists nothing.
cat > "$FIX/fault/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "owner": { "name": "Yonatan Gross" },
  "plugins": []
}
JSON

control_rc=0; fault_rc=0
bash "$FIX/control/tests/plugins/test-marketplace-structure.sh" >"$FIX/control.log" 2>&1 || control_rc=$?
bash "$FIX/fault/tests/plugins/test-marketplace-structure.sh"   >"$FIX/fault.log"   2>&1 || fault_rc=$?

{
  echo "--- control tail ---"; tail -4 "$FIX/control.log"
  echo "--- fault tail ---";   tail -6 "$FIX/fault.log"
} >&2

printf 'RESULT gate=%s control=%s fault=%s\n' "marketplace-structure" "$control_rc" "$fault_rc"
