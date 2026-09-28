#!/usr/bin/env bash
# cc-release-watch.mjs must fetch a CHANGELOG larger than 1 MB.
#
# Measured 2026-09-29: the live path died with `spawnSync /bin/sh ENOBUFS`.
# It read the file through `gh api .../contents/CHANGELOG.md --jq .content`
# into execSync, whose default maxBuffer is 1 MiB; the 838 KB CHANGELOG is
# ~1.13 MB as base64. Past 1 MB raw the contents API stops returning base64
# content at all, so the base64 route cannot be rescued by a bigger buffer.
#
# The test runs the real script, with no fixture, from a copy in a temp root
# (ROOT derives from the script's own location, so the repo is never written).
# A stub `gh` on PATH serves a 2 MB changelog: raw for the raw media type, and
# base64 for the old `--jq .content` call, so the old code path fails the same
# way production did.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/cc-watch-large.XXXXXX")"
trap 'rm -rf "${TMP}"' EXIT

mkdir -p "${TMP}/root/scripts" "${TMP}/root/shared/cc-snapshots" "${TMP}/bin"
cp "${PROJECT_ROOT}/scripts/cc-release-watch.mjs" "${TMP}/root/scripts/"
cp "${PROJECT_ROOT}/shared/cc-support.json" "${TMP}/root/shared/"
echo '[]' > "${TMP}/root/shared/cc-adoption-gaps.json"

# 2 MB changelog: two real-looking versions, the older one padded with bullets.
python3 - "${TMP}/CHANGELOG.md" <<'PY'
import sys
lines = ["# Changelog", "", "## 9.9.2", "", "- Added a large-changelog canary", "", "## 9.9.1", ""]
pad = "- Fixed padding bullet number %06d so the file crosses the 1 MB contents-API limit"
i = 0
body = "\n".join(lines)
while len(body) < 2 * 1024 * 1024:
    body += "\n" + pad % i
    i += 1
open(sys.argv[1], "w").write(body + "\n")
PY

cat > "${TMP}/bin/gh" <<EOF
#!/usr/bin/env bash
# Stub: raw media type -> raw file; anything else -> base64 (the --jq .content shape).
for a in "\$@"; do
  if [[ "\$a" == *"application/vnd.github.raw"* ]]; then cat "${TMP}/CHANGELOG.md"; exit 0; fi
done
base64 < "${TMP}/CHANGELOG.md"
EOF
chmod +x "${TMP}/bin/gh"

size=$(wc -c < "${TMP}/CHANGELOG.md" | tr -d ' ')
[ "${size}" -gt 1048576 ] || { echo "FAIL: fixture is only ${size} bytes, not over 1 MB"; exit 1; }

set +e
( cd "${TMP}/root" && PATH="${TMP}/bin:${PATH}" CC_PUBLISHED_VERSION=0.0.0 \
    node scripts/cc-release-watch.mjs ) > "${TMP}/out.log" 2>&1
rc=$?
set -e

if [ "${rc}" -ne 0 ]; then
  echo "FAIL: cc-release-watch exited ${rc} on a ${size}-byte CHANGELOG"
  grep -m3 -E 'ENOBUFS|Error|No versions' "${TMP}/out.log" || tail -5 "${TMP}/out.log"
  exit 1
fi
if ! grep -q 'parsed 2 versions' "${TMP}/out.log"; then
  echo "FAIL: expected 'parsed 2 versions' from the ${size}-byte CHANGELOG"; tail -5 "${TMP}/out.log"; exit 1
fi
if [ ! -f "${TMP}/root/shared/cc-snapshots/9.9.2.md" ]; then
  echo "FAIL: no snapshot written for 9.9.2"; exit 1
fi
echo "PASS: ${size}-byte CHANGELOG fetched, 2 versions parsed, snapshot written"
