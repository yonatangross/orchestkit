#!/usr/bin/env bash
# Test: the claude-health workflow keeps its model away from credentials and untrusted text.
#
# The model step reads repository data on a public repo. Four assertions on the
# workflow file (WORKFLOW_FILE overrides the path, so a bad fixture can prove each arm):
#   1. the model step grants no Read, Grep, Glob or Bash(cat) tool (they reach /proc and env)
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

allowed="$(grep -E -e '--allowedTools' "$WF" || true)"
if [ -z "$allowed" ]; then
  bad "no --allowedTools line, the model tool scope is unbounded"
elif [[ "$allowed" =~ Read|Grep|Glob|Bash\(cat ]]; then
  bad "model tool scope still grants Read, Grep, Glob or cat"
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
