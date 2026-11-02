#!/usr/bin/env bash
# Test: the claude-health workflow keeps its model away from credentials and untrusted text.
#
# The model step reads repository data on a public repo. Four assertions on the
# workflow file (WORKFLOW_FILE overrides the path, so a bad fixture can prove each arm):
#   1. the model step passes --tools "" and --strict-mcp-config and no --allowedTools
#   2. the model step sees no GH_TOKEN (data is collected in an earlier step)
#   3. no artifact upload of the raw model report
#   4. the data-collection step emits no free text fields (title, body, name)
# Each assertion first proves its target exists, so an empty parse cannot pass.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WF="${WORKFLOW_FILE:-$REPO_ROOT/.github/workflows/claude-health.yml}"

[ -f "$WF" ] || { echo "FAIL: $WF not found"; exit 1; }

fail=0
bad() { echo "FAIL: $1"; fail=1; }

grep -q 'claude -p' "$WF" || bad "no claude -p step found, parse proved nothing"

# The model gets no tools at all: an empty --tools list, and no allowlist that
# could grant Bash, Read, Grep, Glob or cat back (any --allowedTools fails).
if ! grep -q -e '--tools ""' "$WF"; then
  bad "model step does not pass --tools \"\" (no tools defined)"
fi
if grep -q -e '--allowedTools' "$WF"; then
  bad "an --allowedTools list is present, the model must get no tools"
fi
if ! grep -q -e '--strict-mcp-config' "$WF"; then
  bad "model step does not pass --strict-mcp-config"
fi

# The step that runs claude -p must not carry GH_TOKEN in its env block.
model_step="$(awk '/- name: Run health assessment/{f=1;next} /^      - name:/{f=0} f' "$WF")"
if [ -z "$model_step" ]; then
  bad "model step 'Run health assessment' not found"
elif [[ "$model_step" == *GH_TOKEN* ]]; then
  bad "model step still holds GH_TOKEN"
fi

if grep -q 'upload-artifact' "$WF"; then
  bad "workflow uploads an artifact, the raw report must not be public"
fi

collect="$(awk '/- name: Collect repository data/{f=1;next} /^      - name:/{f=0} f' "$WF")"
if [ -z "$collect" ]; then
  bad "data collection step 'Collect repository data' not found"
elif [[ "$collect" =~ title|body|headRefName|author ]]; then
  bad "collection step emits free text fields from outside contributors"
fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "PASS: claude-health tool scope"
