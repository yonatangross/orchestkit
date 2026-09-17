#!/usr/bin/env bash
set -euo pipefail

# Jev shadow for /ork:expect. SHADOW ONLY.
#
# Runs once per expect step, after the agent has picked its action and before
# it executes. Emits at most one line on stdout:
#   JEV_SHADOW|<step-id>|<one-line JSON>
# The lead agent pipes that line into report.sh, which carries it into the
# run report. The Jev pick is never used to drive the browser.
#
# Gate: ORK_EXPECT_JEV_SHADOW must be truthy (1|true|yes|on). Anything else,
# including unset, exits here before python or the network are touched.
# Auth: ORK_TYPESAFE_API_KEY (same variable the hooks-side Jev lane uses).
# Tunables (element cap, thresholds, latency budget, model, endpoint) live in
# .expect/config.yaml under `jev_shadow:` with shipped fallbacks in
# ../jev-shadow.defaults.yaml. See ../references/jev-shadow.md.

case "${ORK_EXPECT_JEV_SHADOW:-}" in
  1|true|TRUE|yes|YES|on|ON) ;;
  *) exit 0 ;;
esac

exec python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/jev_shadow.py" "$@"
