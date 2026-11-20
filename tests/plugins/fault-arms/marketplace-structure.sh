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

# unlisted_control and fault3 share a tree: mods/demo has an entry. In
# unlisted_control, mods/quiet has none and its README says "Not listed in any
# marketplace.", a normal state while a listing waits for the operator. fault3:
# demo is listed AND its README says it is not, which the gate must refuse.
for arm in unlisted_control fault3; do
  mkdir -p "$FIX/$arm/tests/plugins" "$FIX/$arm/.claude-plugin" \
           "$FIX/$arm/plugins/ork/.claude-plugin" "$FIX/$arm/mods/demo" "$FIX/$arm/mods/quiet"
  cp "$REPO/tests/plugins/test-marketplace-structure.sh" "$FIX/$arm/tests/plugins/"
  cp "$REPO/plugins/ork/.claude-plugin/plugin.json" "$FIX/$arm/plugins/ork/.claude-plugin/"
  cat > "$FIX/$arm/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "owner": { "name": "Yonatan Gross" },
  "plugins": [
    { "name": "ork", "source": "./plugins/ork" },
    { "name": "demo", "source": { "source": "git-subdir", "url": "https://example.invalid/r.git", "path": "mods/demo" } }
  ]
}
JSON
done
printf '# quiet\n\nNot listed in any marketplace. A listing waits for the operator.\n' > "$FIX/unlisted_control/mods/quiet/README.md"
# fault3 has no unlisted mod, so the only fault left is demo's README line.
rmdir "$FIX/fault3/mods/quiet"
printf '# demo\n\nInstall it from the marketplace.\n' > "$FIX/unlisted_control/mods/demo/README.md"
printf '# demo\n\nNot listed in any marketplace.\n' > "$FIX/fault3/mods/demo/README.md"

# fault4 (Codex HOLD 6247727695): mods/demo says it is not listed, but an entry
# named demo lists it through a plugins/ source. A listing is found by name as
# well as by source path, so this must fail.
mkdir -p "$FIX/fault4/tests/plugins" "$FIX/fault4/.claude-plugin" \
         "$FIX/fault4/plugins/ork/.claude-plugin" "$FIX/fault4/plugins/demo/.claude-plugin" "$FIX/fault4/mods/demo"
cp "$REPO/tests/plugins/test-marketplace-structure.sh" "$FIX/fault4/tests/plugins/"
cp "$REPO/plugins/ork/.claude-plugin/plugin.json" "$FIX/fault4/plugins/ork/.claude-plugin/"
printf '{"name":"demo","version":"0.1.0","description":"demo"}\n' > "$FIX/fault4/plugins/demo/.claude-plugin/plugin.json"
printf '# demo\n\nNot listed in any marketplace.\n' > "$FIX/fault4/mods/demo/README.md"
cat > "$FIX/fault4/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "owner": { "name": "Yonatan Gross" },
  "plugins": [
    { "name": "ork", "source": "./plugins/ork" },
    { "name": "demo", "source": "./plugins/demo" }
  ]
}
JSON

# fault5 (CodeRabbit r4306524346): mods/required has no entry and no unlisted
# line, mods/quiet is unlisted, and a dangling entry for mods/foreign balances
# the count (1 entry = 2 dirs - 1 unlisted). Each folder is judged on its own.
mkdir -p "$FIX/fault5/tests/plugins" "$FIX/fault5/.claude-plugin" \
         "$FIX/fault5/plugins/ork/.claude-plugin" "$FIX/fault5/mods/required" "$FIX/fault5/mods/quiet"
cp "$REPO/tests/plugins/test-marketplace-structure.sh" "$FIX/fault5/tests/plugins/"
cp "$REPO/plugins/ork/.claude-plugin/plugin.json" "$FIX/fault5/plugins/ork/.claude-plugin/"
printf '# required\n\nSome text.\n' > "$FIX/fault5/mods/required/README.md"
printf '# quiet\n\nNot listed in any marketplace.\n' > "$FIX/fault5/mods/quiet/README.md"
cat > "$FIX/fault5/.claude-plugin/marketplace.json" <<'JSON'
{
  "name": "orchestkit",
  "owner": { "name": "Yonatan Gross" },
  "plugins": [
    { "name": "ork", "source": "./plugins/ork" },
    { "name": "foreign", "source": { "source": "git-subdir", "url": "https://example.invalid/r.git", "path": "mods/foreign" } }
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

control_rc=0; fault_rc=0; fault2_rc=0; mods_control_rc=0; unlisted_control_rc=0; fault3_rc=0; fault4_rc=0; fault5_rc=0
bash "$FIX/control/tests/plugins/test-marketplace-structure.sh" >"$FIX/control.log" 2>&1 || control_rc=$?
bash "$FIX/fault/tests/plugins/test-marketplace-structure.sh"   >"$FIX/fault.log"   2>&1 || fault_rc=$?
bash "$FIX/fault2/tests/plugins/test-marketplace-structure.sh"  >"$FIX/fault2.log"  2>&1 || fault2_rc=$?
bash "$FIX/mods_control/tests/plugins/test-marketplace-structure.sh" >"$FIX/mods_control.log" 2>&1 || mods_control_rc=$?
bash "$FIX/unlisted_control/tests/plugins/test-marketplace-structure.sh" >"$FIX/unlisted_control.log" 2>&1 || unlisted_control_rc=$?
bash "$FIX/fault3/tests/plugins/test-marketplace-structure.sh" >"$FIX/fault3.log" 2>&1 || fault3_rc=$?
bash "$FIX/fault4/tests/plugins/test-marketplace-structure.sh" >"$FIX/fault4.log" 2>&1 || fault4_rc=$?
bash "$FIX/fault5/tests/plugins/test-marketplace-structure.sh" >"$FIX/fault5.log" 2>&1 || fault5_rc=$?

{
  echo "--- control tail ---"; tail -4 "$FIX/control.log"
  echo "--- fault tail ---";   tail -6 "$FIX/fault.log"
  echo "== fault2 tail ==";  tail -8 "$FIX/fault2.log"
  echo "== mods_control tail =="; tail -4 "$FIX/mods_control.log"
  echo "== unlisted_control tail =="; tail -4 "$FIX/unlisted_control.log"
  echo "== fault3 tail =="; tail -6 "$FIX/fault3.log"
  echo "== fault4 tail =="; tail -6 "$FIX/fault4.log"
  echo "== fault5 tail =="; tail -6 "$FIX/fault5.log"
} >&2

printf 'RESULT gate=%s control=%s fault=%s fault2=%s mods_control=%s unlisted_control=%s fault3=%s fault4=%s fault5=%s\n' \
  "marketplace-structure" "$control_rc" "$fault_rc" "$fault2_rc" "$mods_control_rc" "$unlisted_control_rc" "$fault3_rc" "$fault4_rc" "$fault5_rc"
