#!/usr/bin/env bash
# Gate: tests/plugins/test-marketplace-structure.sh
# Pass condition: ERRORS == 0 (line 174). Tests 2, 4 and 5 all iterate over the
# entries of .plugins[]; Test 6's count mismatch is only a WARNING. A marketplace
# with "plugins": [] therefore records zero errors and prints
# "All marketplace structure tests passed!".
#
# fault2 (#4597): Test 6 was one if/elif chain, so a plugin-dir count mismatch
# (a WARNING) short-circuited the mod-count check (an ERROR). A mods/<name>/
# directory with no marketplace entry then passed whenever plugins/ also held an
# extra directory. mods_control is the same tree with the mod entry present, so
# fault2 can only fail on the missing mod entry, not on the plugin-dir warning.
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

# fault2 and mods_control share a tree: an extra plugins/ dir (warning only) and
# two mods/ dirs. mods_control lists both mods; fault2 drops the "orphan" entry.
for arm in fault2 mods_control; do
  mkdir -p "$FIX/$arm/tests/plugins" "$FIX/$arm/.claude-plugin" \
           "$FIX/$arm/plugins/ork/.claude-plugin" "$FIX/$arm/plugins/_extra" \
           "$FIX/$arm/mods/demo" "$FIX/$arm/mods/orphan"
  cp "$REPO/tests/plugins/test-marketplace-structure.sh" "$FIX/$arm/tests/plugins/"
  cp "$REPO/plugins/ork/.claude-plugin/plugin.json" "$FIX/$arm/plugins/ork/.claude-plugin/"
done
cat > "$FIX/mods_control/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "owner": { "name": "Yonatan Gross" },
  "plugins": [
    { "name": "ork", "source": "./plugins/ork" },
    { "name": "demo", "source": { "source": "git-subdir", "url": "https://example.invalid/r.git", "path": "mods/demo" } },
    { "name": "orphan", "source": { "source": "git-subdir", "url": "https://example.invalid/r.git", "path": "mods/orphan" } }
  ]
}
JSON
cat > "$FIX/fault2/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "owner": { "name": "Yonatan Gross" },
  "plugins": [
    { "name": "ork", "source": "./plugins/ork" },
    { "name": "demo", "source": { "source": "git-subdir", "url": "https://example.invalid/r.git", "path": "mods/demo" } }
  ]
}
JSON

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

control_rc=0; fault_rc=0; fault2_rc=0; mods_control_rc=0
bash "$FIX/control/tests/plugins/test-marketplace-structure.sh" >"$FIX/control.log" 2>&1 || control_rc=$?
bash "$FIX/fault/tests/plugins/test-marketplace-structure.sh"   >"$FIX/fault.log"   2>&1 || fault_rc=$?
bash "$FIX/fault2/tests/plugins/test-marketplace-structure.sh"  >"$FIX/fault2.log"  2>&1 || fault2_rc=$?
bash "$FIX/mods_control/tests/plugins/test-marketplace-structure.sh" >"$FIX/mods_control.log" 2>&1 || mods_control_rc=$?

{
  echo "--- control tail ---"; tail -4 "$FIX/control.log"
  echo "--- fault tail ---";   tail -6 "$FIX/fault.log"
  echo "== fault2 tail ==";  tail -8 "$FIX/fault2.log"
  echo "== mods_control tail =="; tail -4 "$FIX/mods_control.log"
} >&2

printf 'RESULT gate=%s control=%s fault=%s fault2=%s mods_control=%s\n' \
  "marketplace-structure" "$control_rc" "$fault_rc" "$fault2_rc" "$mods_control_rc"
