#!/usr/bin/env bash
set -euo pipefail

# Jev step judge for /ork:expect. Three modes off ORK_EXPECT_JEV:
#
#   unset / falsey : off, this script exits before python or the network
#   shadow         : log-only second opinion beside the agent's own pick
#   1 | act        : the Jev pick becomes the step's chosen action, with a
#                    fail-closed fallback to the agent's pick on any error,
#                    timeout, empty or malformed answer, or a confidence
#                    below the configured act_confidence_floor
#
# Runs once per expect step, after the agent has picked its action and before
# it executes. Emits at most one line on stdout:
#   JEV_SHADOW|<step-id>|<one-line JSON>
# In act mode the record carries `path` and `executed_action`; the agent runs
# `executed_action` (its own pick whenever path starts with "fallback").
# The lead agent pipes that line into report.sh, which carries it into the
# run report.
#
# Gate: ORK_EXPECT_JEV selects the mode. For compatibility,
# ORK_EXPECT_JEV_SHADOW truthy with ORK_EXPECT_JEV unset selects shadow.
# Auth: ORK_TYPESAFE_API_KEY (same variable the hooks-side Jev lane uses).
# Tunables (element cap, thresholds, latency budget, model, endpoint,
# act_confidence_floor) live in .expect/config.yaml under `jev_shadow:` with
# shipped fallbacks in ../jev-shadow.defaults.yaml. See ../references/jev-shadow.md.

MODE=""
JEV_RAW="$(printf '%s' "${ORK_EXPECT_JEV:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
case "${JEV_RAW}" in
  1|act|true|yes|on) MODE=act ;;
  shadow) MODE=shadow ;;
  "") case "$(printf '%s' "${ORK_EXPECT_JEV_SHADOW:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')" in
        1|true|yes|on) MODE=shadow ;;
      esac ;;
esac
[ -n "${MODE}" ] || exit 0

exec python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/jev_shadow.py" "$@"
