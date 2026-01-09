#!/bin/bash
# Stale Instance Cleanup Demo
# Demonstrates automatic cleanup of crashed instances

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/coordination.sh"

echo "======================================"
echo "  Stale Instance Cleanup Demo"
echo "======================================"
echo ""

# Create a simulated stale instance
echo "Creating simulated stale instance..."
export INSTANCE_ID=$(coord_generate_instance_id)
coord_register_instance "Simulated task (will become stale)" "test-agent"
STALE_ID="${INSTANCE_ID}"

echo "  Instance ID: ${STALE_ID}"
echo "  Registered at: $(date)"

# Acquire some locks
echo ""
echo "Acquiring locks..."
coord_acquire_lock "test-file-1.txt" "Test lock 1"
coord_acquire_lock "test-file-2.txt" "Test lock 2"
echo "  Locks acquired: 2"

# Show current state
echo ""
echo "Current status:"
../bin/coord-status

# Simulate instance crash by manipulating heartbeat timestamp
echo ""
echo "Simulating instance crash (backdating heartbeat by 10 minutes)..."
HEARTBEAT_FILE="${HEARTBEATS_DIR}/${STALE_ID}.json"

# Backdate the heartbeat to 10 minutes ago
if [[ "$(uname -s)" == "Darwin" ]]; then
  OLD_TIME=$(date -u -v-10M +"%Y-%m-%dT%H:%M:%SZ")
else
  OLD_TIME=$(date -u -d "10 minutes ago" +"%Y-%m-%dT%H:%M:%SZ")
fi

jq --arg old_time "${OLD_TIME}" \
   '.last_ping = $old_time' \
   "${HEARTBEAT_FILE}" > "${HEARTBEAT_FILE}.tmp" && \
mv "${HEARTBEAT_FILE}.tmp" "${HEARTBEAT_FILE}"

echo "  Heartbeat backdated to: ${OLD_TIME}"
echo "  Instance is now considered stale (>5 min timeout)"

# Create a new instance that will trigger cleanup
echo ""
echo "Creating new instance (will trigger stale cleanup)..."
export INSTANCE_ID=$(coord_generate_instance_id)
coord_register_instance "New active instance" "cleanup-agent"
ACTIVE_ID="${INSTANCE_ID}"

echo "  New instance ID: ${ACTIVE_ID}"

# The cleanup should have removed the stale instance
echo ""
echo "Checking cleanup results..."
STALE_EXISTS=$(coord_list_instances | jq --arg sid "${STALE_ID}" '[.[] | select(.instance_id == $sid)] | length')

if [[ ${STALE_EXISTS} -eq 0 ]]; then
  echo "  SUCCESS: Stale instance was automatically cleaned up!"
else
  echo "  ERROR: Stale instance still exists"
fi

# Check that locks were released
echo ""
echo "Checking lock cleanup..."
REMAINING_LOCKS=$(../bin/coord-lock list | grep -c "Locked By: ${STALE_ID}" || echo 0)

if [[ ${REMAINING_LOCKS} -eq 0 ]]; then
  echo "  SUCCESS: All locks from stale instance were released!"
else
  echo "  ERROR: ${REMAINING_LOCKS} locks still held by stale instance"
fi

# Show final status
echo ""
echo "--------------------------------------"
echo "Final Status:"
../bin/coord-status

# Cleanup
echo ""
echo "Cleaning up demo..."
export INSTANCE_ID="${ACTIVE_ID}"
coord_unregister_instance

echo ""
echo "Demo complete!"
