#!/bin/bash
# Multi-Instance Coordination Demo
# Simulates two Claude Code instances working on same codebase

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/coordination.sh"

echo "======================================"
echo "  Multi-Instance Coordination Demo"
echo "======================================"
echo ""

# Simulate Instance 1: Backend Developer
echo "[Instance 1] Registering backend-system-architect..."
export INSTANCE_ID=$(coord_register_instance "Implement user authentication" "backend-system-architect")
echo "  Instance ID: ${INSTANCE_ID}"
INSTANCE1_ID="${INSTANCE_ID}"

# Simulate Instance 2: Frontend Developer
echo ""
echo "[Instance 2] Registering frontend-ui-developer..."
export INSTANCE_ID=$(coord_generate_instance_id)
coord_register_instance "Create login form component" "frontend-ui-developer"
echo "  Instance ID: ${INSTANCE_ID}"
INSTANCE2_ID="${INSTANCE_ID}"

echo ""
echo "--------------------------------------"
echo "Active Instances:"
coord_list_instances | jq -r '.[] | "  - \(.instance_id) (\(.current_task.agent_role))"'

# Instance 1: Acquire lock on backend file
echo ""
echo "--------------------------------------"
echo "[Instance 1] Attempting to lock backend/app/api/routes/auth.py..."
export INSTANCE_ID="${INSTANCE1_ID}"
coord_acquire_lock "backend/app/api/routes/auth.py" "Adding authentication routes"
echo "  Lock acquired!"

# Update heartbeat
coord_heartbeat

# Instance 2: Try to lock same file (should fail)
echo ""
echo "[Instance 2] Attempting to lock same file..."
export INSTANCE_ID="${INSTANCE2_ID}"
if coord_acquire_lock "backend/app/api/routes/auth.py" "Checking API routes"; then
  echo "  ERROR: Should have failed!"
else
  echo "  Lock denied (as expected) - file is locked by Instance 1"
fi

# Instance 2: Lock a different file (should succeed)
echo ""
echo "[Instance 2] Attempting to lock frontend/src/components/Login.tsx..."
coord_acquire_lock "frontend/src/components/Login.tsx" "Creating login component"
echo "  Lock acquired!"

coord_heartbeat

# Show current locks
echo ""
echo "--------------------------------------"
echo "Current File Locks:"
../bin/coord-lock list

# Log decisions from both instances
echo ""
echo "--------------------------------------"
echo "[Instance 1] Logging API design decision..."
export INSTANCE_ID="${INSTANCE1_ID}"
DEC1=$(coord_log_decision "api-design" "Use JWT authentication" "Implement JWT tokens with 15min expiry" "service")
echo "  Decision logged: ${DEC1}"

echo ""
echo "[Instance 2] Logging UI pattern decision..."
export INSTANCE_ID="${INSTANCE2_ID}"
DEC2=$(coord_log_decision "ui-pattern" "Use controlled form components" "React controlled components for form state" "module")
echo "  Decision logged: ${DEC2}"

# Query decisions
echo ""
echo "--------------------------------------"
echo "Recent Decisions:"
coord_query_decisions "" 5 | jq -r '.[] | "  [\(.decision_id)] \(.title) - \(.category)"'

# Simulate Instance 1 releasing lock
echo ""
echo "--------------------------------------"
echo "[Instance 1] Releasing lock on backend file..."
export INSTANCE_ID="${INSTANCE1_ID}"
coord_release_lock "backend/app/api/routes/auth.py"
echo "  Lock released!"

# Now Instance 2 can acquire it
echo ""
echo "[Instance 2] Retrying lock on backend file..."
export INSTANCE_ID="${INSTANCE2_ID}"
coord_acquire_lock "backend/app/api/routes/auth.py" "Reviewing API structure"
echo "  Lock acquired!"

# Show final status
echo ""
echo "--------------------------------------"
echo "Final Status:"
../bin/coord-status

# Cleanup
echo ""
echo "--------------------------------------"
echo "Cleaning up demo instances..."
export INSTANCE_ID="${INSTANCE1_ID}"
coord_unregister_instance
export INSTANCE_ID="${INSTANCE2_ID}"
coord_unregister_instance

echo ""
echo "Demo complete!"
