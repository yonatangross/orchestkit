#!/bin/bash
# Conflict Detection Demo
# Demonstrates optimistic locking and conflict detection

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/coordination.sh"

echo "======================================"
echo "  Conflict Detection Demo"
echo "======================================"
echo ""

# Create a test file
TEST_FILE="/tmp/coord-test-file.py"
echo "# Original content" > "${TEST_FILE}"
echo "def hello():" >> "${TEST_FILE}"
echo '    print("Hello, World!")' >> "${TEST_FILE}"

echo "Created test file: ${TEST_FILE}"
echo "Original content:"
cat "${TEST_FILE}"
echo ""

# Instance 1: Acquire lock
echo "--------------------------------------"
echo "[Instance 1] Acquiring lock..."
export INSTANCE_ID=$(coord_generate_instance_id)
coord_register_instance "Editing test file" "editor-1"
INSTANCE1_ID="${INSTANCE_ID}"

coord_acquire_lock "${TEST_FILE}" "Adding new function"
echo "  Lock acquired!"

# Get original hash
ORIGINAL_HASH=$(shasum "${TEST_FILE}" 2>/dev/null | awk '{print $1}' || sha1sum "${TEST_FILE}" 2>/dev/null | awk '{print $1}')
echo "  Original file hash: ${ORIGINAL_HASH}"

# Simulate external modification (e.g., another editor, git pull, etc.)
echo ""
echo "--------------------------------------"
echo "Simulating external file modification..."
echo "# Modified externally" >> "${TEST_FILE}"
echo "  File modified outside coordination system"

NEW_HASH=$(shasum "${TEST_FILE}" 2>/dev/null | awk '{print $1}' || sha1sum "${TEST_FILE}" 2>/dev/null | awk '{print $1}')
echo "  New file hash: ${NEW_HASH}"

# Instance 1: Detect conflict
echo ""
echo "--------------------------------------"
echo "[Instance 1] Checking for conflicts before write..."
if coord_detect_conflict "${TEST_FILE}"; then
  echo "  ERROR: Should have detected conflict!"
  exit 1
else
  echo "  SUCCESS: Conflict detected!"
  echo "  File was modified since lock was acquired"
fi

echo ""
echo "Modified content:"
cat "${TEST_FILE}"

# Demonstrate safe write pattern
echo ""
echo "--------------------------------------"
echo "Safe write pattern demonstration:"
echo ""
echo "1. Detect conflict"
echo "2. Release lock"
echo "3. Re-read file"
echo "4. Re-acquire lock"
echo "5. Apply changes"

echo ""
echo "[Instance 1] Releasing lock..."
coord_release_lock "${TEST_FILE}"

echo "[Instance 1] Re-reading file content..."
echo "  Content now includes external changes"

echo "[Instance 1] Re-acquiring lock..."
coord_acquire_lock "${TEST_FILE}" "Applying changes with conflict resolution"
echo "  Lock re-acquired with new hash"

echo ""
echo "Now the write would proceed safely, incorporating external changes"

# Cleanup
echo ""
echo "--------------------------------------"
echo "Cleaning up demo..."
export INSTANCE_ID="${INSTANCE1_ID}"
coord_release_lock "${TEST_FILE}"
coord_unregister_instance
rm -f "${TEST_FILE}"

echo ""
echo "Demo complete!"
echo ""
echo "Key Takeaway:"
echo "  Optimistic locking detects when files are modified externally,"
echo "  allowing safe conflict resolution before overwriting changes."
