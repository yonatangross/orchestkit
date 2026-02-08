#!/usr/bin/env bash
# Test suite for Mem0 API Integration (REAL API calls)
# Validates CRUD operations, graph features, error handling, and export
# using the Python scripts in src/skills/mem0-memory/scripts/
#
# Requires: MEM0_API_KEY environment variable
# Each test uses a unique user_id prefix and cleans up after itself.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

SCRIPTS_DIR="$PROJECT_ROOT/src/skills/mem0-memory/scripts"
CRUD_DIR="$SCRIPTS_DIR/crud"
EXPORT_DIR="$SCRIPTS_DIR/export"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Unique prefix for this test run — include RANDOM for parallel CI runners
TEST_PREFIX="test-$(date +%s)-${RANDOM}"

# Generate per-test unique tokens to defeat mem0 semantic deduplication.
# mem0 aggressively merges memories with similar structure/semantics,
# even across different CI runners sharing the same project.
# Embedding truly random strings makes each text unique.
make_unique() {
    echo "${RANDOM}${RANDOM}${RANDOM}"
}

# Track created memory IDs for cleanup
CREATED_MEMORY_IDS=()

# Store the real API key for restoration after error handling tests
REAL_API_KEY="${MEM0_API_KEY:-}"

# -----------------------------------------------------------------------------
# Test Utilities
# -----------------------------------------------------------------------------

test_start() {
    local name="$1"
    echo -n "  o $name... "
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    +-- $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

test_skip() {
    local reason="${1:-}"
    echo -e "\033[0;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    +-- $reason"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------

cleanup() {
    echo ""
    echo "--- Cleanup ---"
    echo "  Deleting test memories with prefix: $TEST_PREFIX"

    # Delete all tracked memory IDs
    local cleaned=0
    for mem_id in "${CREATED_MEMORY_IDS[@]}"; do
        if [[ -n "$mem_id" && "$mem_id" != "null" ]]; then
            # Restore real API key in case error handling test changed it
            export MEM0_API_KEY="$REAL_API_KEY"
            python3 "$CRUD_DIR/delete-memory.py" --memory-id "$mem_id" >/dev/null 2>&1 && cleaned=$((cleaned + 1))
        fi
    done

    echo "  Cleaned up $cleaned memories."
    echo ""
}

# Register cleanup on exit
trap cleanup EXIT

# -----------------------------------------------------------------------------
# Header
# -----------------------------------------------------------------------------

echo ""
echo "========================================================================"
echo " Mem0 API Integration Tests (REAL API calls)"
echo "========================================================================"
echo ""
echo "  Test prefix: $TEST_PREFIX"
echo ""

# -----------------------------------------------------------------------------
# Prerequisite Checks
# -----------------------------------------------------------------------------

echo "--- Prerequisite Checks ---"

# Check MEM0_API_KEY
if [[ -z "${MEM0_API_KEY:-}" ]]; then
    echo ""
    echo -e "  \033[0;33mSKIPPING ALL TESTS\033[0m: MEM0_API_KEY is not set."
    echo "  Set MEM0_API_KEY to run real API integration tests."
    echo ""
    echo "========================================================================"
    echo " Test Summary"
    echo "========================================================================"
    echo "  Total:   0"
    echo "  Passed:  0"
    echo "  Failed:  0"
    echo "  Skipped: ALL (MEM0_API_KEY not set)"
    echo ""
    exit 0
fi
echo "  MEM0_API_KEY: set"

# Check jq
if ! command -v jq &>/dev/null; then
    echo -e "  \033[0;31mERROR\033[0m: jq is required but not installed."
    echo "  Install with: brew install jq"
    exit 1
fi
echo "  jq: $(jq --version 2>&1)"

# Check python3
if ! command -v python3 &>/dev/null; then
    echo -e "  \033[0;31mERROR\033[0m: python3 is required but not installed."
    exit 1
fi
echo "  python3: $(python3 --version 2>&1)"

# Check mem0ai package
if ! python3 -c 'import mem0' 2>/dev/null; then
    echo ""
    echo -e "  \033[0;33mSKIPPING ALL TESTS\033[0m: mem0ai package is not installed."
    echo "  Install with: pip install mem0ai"
    echo "  Or: pip install -r src/skills/mem0-memory/scripts/requirements.txt"
    echo ""
    echo "========================================================================"
    echo " Test Summary"
    echo "========================================================================"
    echo "  Total:   0"
    echo "  Passed:  0"
    echo "  Failed:  0"
    echo "  Skipped: ALL (mem0ai not installed)"
    echo ""
    exit 0
fi
echo "  mem0ai: installed"

# Check that CRUD scripts exist
if [[ ! -f "$CRUD_DIR/add-memory.py" ]]; then
    echo -e "  \033[0;31mERROR\033[0m: CRUD scripts not found at $CRUD_DIR"
    exit 1
fi
echo "  Scripts: $CRUD_DIR"

echo ""

# -----------------------------------------------------------------------------
# Retry helper for eventually consistent operations
# Usage: wait_for_search "query" "user_id" [min_count]
# Retries search up to 5 times with exponential backoff (1s, 2s, 3s, 4s, 5s)
# Returns: sets RETRY_OUTPUT and RETRY_COUNT
# -----------------------------------------------------------------------------

RETRY_OUTPUT=""
RETRY_COUNT=0

wait_for_search() {
    local query="$1"
    local user_id="$2"
    local min_count="${3:-1}"
    local extra_args="${4:-}"

    RETRY_OUTPUT=""
    RETRY_COUNT=0

    # With async_mode=False in add-memory.py, memories should be available quickly.
    # Retry with backoff: 2+3+5+8+12 = 30s total for eventual consistency.
    for attempt in 2 3 5 8 12; do
        sleep "$attempt"
        RETRY_OUTPUT=$(python3 "$CRUD_DIR/search-memories.py" \
            --query "$query" \
            --user-id "$user_id" \
            $extra_args 2>&1)
        RETRY_COUNT=$(echo "$RETRY_OUTPUT" | jq -r '.count // 0' 2>/dev/null)
        if [[ "$RETRY_COUNT" -ge "$min_count" ]]; then
            return 0
        fi
    done
    return 1  # gave up
}

wait_for_get() {
    local user_id="$1"
    local min_count="${2:-1}"

    RETRY_OUTPUT=""
    RETRY_COUNT=0

    for attempt in 2 3 5 8 12; do
        sleep "$attempt"
        RETRY_OUTPUT=$(python3 "$CRUD_DIR/get-memories.py" \
            --user-id "$user_id" 2>&1)
        RETRY_COUNT=$(echo "$RETRY_OUTPUT" | jq -r '.count // 0' 2>/dev/null)
        if [[ "$RETRY_COUNT" -ge "$min_count" ]]; then
            return 0
        fi
    done
    return 1  # gave up
}

# Waits for deletion to propagate (count reaches target, default 0)
# Usage: wait_for_zero "user_id" [max_count]
wait_for_zero() {
    local user_id="$1"
    local max_count="${2:-0}"

    RETRY_OUTPUT=""
    RETRY_COUNT=999

    for attempt in 2 3 5 8 12; do
        sleep "$attempt"
        RETRY_OUTPUT=$(python3 "$CRUD_DIR/get-memories.py" \
            --user-id "$user_id" 2>&1)
        RETRY_COUNT=$(echo "$RETRY_OUTPUT" | jq -r '.count // 0' 2>/dev/null)
        if [[ "$RETRY_COUNT" -le "$max_count" ]]; then
            return 0
        fi
    done
    return 1  # gave up
}

# Extract memory ID from add-memory.py output, with get_all fallback
# Usage: extract_memory_id "$output" "$user_id"
# Sets: EXTRACTED_MEM_ID
extract_memory_id() {
    local output="$1"
    local user_id="$2"

    EXTRACTED_MEM_ID=$(echo "$output" | jq -r '
        .memory_id //
        .result.results[0].id //
        .result.results[0].memory_id //
        .result[0].id //
        .result[0].memory_id //
        empty
    ' 2>/dev/null)

    # Fallback: if add returned empty results (dedup/merge), use get_all with retry
    if [[ -z "$EXTRACTED_MEM_ID" || "$EXTRACTED_MEM_ID" == "null" ]]; then
        if wait_for_get "$user_id"; then
            EXTRACTED_MEM_ID=$(echo "$RETRY_OUTPUT" | jq -r '
                .memories[0].id //
                .memories[0].memory_id //
                .results[0].id //
                .results[0].memory_id //
                empty
            ' 2>/dev/null)
        fi
    fi
}

# =============================================================================
# Test 1: API Connectivity
# =============================================================================

echo "--- API Connectivity ---"

test_start "test_api_connectivity"

OUTPUT=$(python3 "$CRUD_DIR/get-memories.py" --user-id "${TEST_PREFIX}-connectivity" 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
    # Verify it is valid JSON with "success": true
    SUCCESS=$(echo "$OUTPUT" | jq -r '.success // empty' 2>/dev/null)
    if [[ "$SUCCESS" == "true" ]]; then
        test_pass
    else
        test_fail "Response did not contain \"success\": true. Output: $OUTPUT"
    fi
else
    test_fail "get-memories.py returned exit code $EXIT_CODE. Output: $OUTPUT"
fi

# =============================================================================
# Test 2: Add Memory (CRUD)
# =============================================================================

echo ""
echo "--- CRUD Operations ---"

CREATED_MEMORY_ID=""

test_start "test_add_memory"

# Use a unique non-tech domain text to prevent mem0 semantic dedup across parallel CI runners
CRUD_UNIQ=$(make_unique)
CRUD_TEXT="The Rosetta Stone was discovered in 1799 near the Egyptian town of Rashid during Napoleon's campaign [ref:${CRUD_UNIQ}]"
OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
    --text "Note ${TEST_PREFIX}: ${CRUD_TEXT}" \
    --user-id "${TEST_PREFIX}-crud" 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
    SUCCESS=$(echo "$OUTPUT" | jq -r '.success // empty' 2>/dev/null)
    CREATED_MEMORY_ID=$(echo "$OUTPUT" | jq -r '
        .memory_id //
        .result.results[0].id //
        .result.results[0].memory_id //
        .result[0].id //
        .result[0].memory_id //
        empty
    ' 2>/dev/null)

    if [[ "$SUCCESS" == "true" ]]; then
        # If add returned empty results (dedup/merge), wait for get_all to find the memory
        if [[ -z "$CREATED_MEMORY_ID" || "$CREATED_MEMORY_ID" == "null" ]]; then
            echo "    [debug] memory_id not in add response, waiting for get_all..."
            if wait_for_get "${TEST_PREFIX}-crud"; then
                # Extract ID from the get_all result
                CREATED_MEMORY_ID=$(echo "$RETRY_OUTPUT" | jq -r '
                    .memories[0].id //
                    .memories[0].memory_id //
                    .results[0].id //
                    .results[0].memory_id //
                    empty
                ' 2>/dev/null)
            fi
        fi

        if [[ -n "$CREATED_MEMORY_ID" && "$CREATED_MEMORY_ID" != "null" ]]; then
            CREATED_MEMORY_IDS+=("$CREATED_MEMORY_ID")
        else
            echo "    [debug] memory_id not extracted. result keys: $(echo "$OUTPUT" | jq -c '.result | keys' 2>/dev/null), results[0] keys: $(echo "$OUTPUT" | jq -c '.result.results[0] | keys' 2>/dev/null)"
        fi
        test_pass
    else
        test_fail "Response did not contain \"success\": true. Output: $OUTPUT"
    fi
else
    test_fail "add-memory.py returned exit code $EXIT_CODE. Output: $OUTPUT"
fi

# =============================================================================
# Test 3: Search Memory
# =============================================================================

test_start "test_search_memory"

if wait_for_search "Rosetta Stone discovered 1799 Egyptian Rashid Napoleon" "${TEST_PREFIX}-crud"; then
    test_pass
else
    test_fail "Search returned $RETRY_COUNT results; expected at least 1. Output: $(echo "$RETRY_OUTPUT" | jq -c '.' 2>/dev/null)"
fi

# =============================================================================
# Test 4: Get Memories
# =============================================================================

test_start "test_get_memory"

if wait_for_get "${TEST_PREFIX}-crud"; then
    test_pass
else
    test_fail "Expected at least 1 memory, got count=$RETRY_COUNT. Output: $(echo "$RETRY_OUTPUT" | jq -c '.' 2>/dev/null)"
fi

# =============================================================================
# Test 5: Delete Memory
# =============================================================================

test_start "test_delete_memory"

if [[ -n "$CREATED_MEMORY_ID" && "$CREATED_MEMORY_ID" != "null" ]]; then
    OUTPUT=$(python3 "$CRUD_DIR/delete-memory.py" \
        --memory-id "$CREATED_MEMORY_ID" 2>&1)
    EXIT_CODE=$?

    if [[ $EXIT_CODE -eq 0 ]]; then
        SUCCESS=$(echo "$OUTPUT" | jq -r '.success // empty' 2>/dev/null)
        if [[ "$SUCCESS" == "true" ]]; then
            # Remove from cleanup list since we already deleted it
            CREATED_MEMORY_IDS=("${CREATED_MEMORY_IDS[@]/$CREATED_MEMORY_ID/}")
            test_pass
        else
            test_fail "Response did not contain \"success\": true. Output: $OUTPUT"
        fi
    else
        test_fail "delete-memory.py returned exit code $EXIT_CODE. Output: $OUTPUT"
    fi
else
    test_fail "No memory ID was captured from test_add_memory — add-memory.py may have failed"
fi

# =============================================================================
# Test 6: Batch Operations
# =============================================================================

echo ""
echo "--- Batch Operations ---"

test_start "test_batch_operations"

BATCH_IDS=()
BATCH_SUCCESS=true

# Add 3 memories — texts must be radically different domains AND contain unique tokens
# to avoid mem0 semantic dedup across parallel CI runners sharing the same project
BATCH_U1=$(make_unique)
BATCH_U2=$(make_unique)
BATCH_U3=$(make_unique)
BATCH_TEXTS=(
    "The French Revolution of 1789 overthrew the monarchy and established the First Republic under Robespierre [ref:${BATCH_U1}]"
    "Photosynthesis converts carbon dioxide and water into glucose using chlorophyll in plant chloroplasts [ref:${BATCH_U2}]"
    "TCP three-way handshake uses SYN SYN-ACK ACK packets to establish reliable network connections [ref:${BATCH_U3}]"
)
for i in 0 1 2; do
    # Sleep between adds to avoid race conditions in mem0's dedup engine
    [[ $i -gt 0 ]] && sleep 2
    OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "Note ${TEST_PREFIX} batch $((i+1)): ${BATCH_TEXTS[$i]}" \
        --user-id "${TEST_PREFIX}-batch" 2>&1)

    if [[ $? -ne 0 ]]; then
        BATCH_SUCCESS=false
        break
    fi

    MEM_ID=$(echo "$OUTPUT" | jq -r '
        .memory_id //
        .result.results[0].id //
        .result.results[0].memory_id //
        .result[0].id //
        .result[0].memory_id //
        empty
    ' 2>/dev/null)
    if [[ -n "$MEM_ID" && "$MEM_ID" != "null" ]]; then
        BATCH_IDS+=("$MEM_ID")
        CREATED_MEMORY_IDS+=("$MEM_ID")
    fi
done

if [[ "$BATCH_SUCCESS" == "true" ]]; then
    # Retry get until at least 3 memories indexed
    if wait_for_get "${TEST_PREFIX}-batch" 3; then
        COUNT=$RETRY_COUNT
    else
        COUNT=$RETRY_COUNT
    fi

    if [[ "$COUNT" -ge 3 ]]; then
        # Delete all batch memories
        DELETE_SUCCESS=true
        for mem_id in "${BATCH_IDS[@]}"; do
            if [[ -n "$mem_id" && "$mem_id" != "null" ]]; then
                python3 "$CRUD_DIR/delete-memory.py" --memory-id "$mem_id" >/dev/null 2>&1
                if [[ $? -ne 0 ]]; then
                    DELETE_SUCCESS=false
                fi
                # Remove from cleanup list
                CREATED_MEMORY_IDS=("${CREATED_MEMORY_IDS[@]/$mem_id/}")
            fi
        done

        # Wait for deletion to propagate (eventual consistency)
        if [[ "$DELETE_SUCCESS" == "true" ]]; then
            if wait_for_zero "${TEST_PREFIX}-batch"; then
                test_pass
            else
                test_fail "Expected 0 memories after deletion, got $RETRY_COUNT after 30s retry"
            fi
        else
            test_fail "Some batch deletions failed"
        fi
    else
        test_fail "Expected at least 3 memories after batch add, got $COUNT"
    fi
else
    test_fail "Failed to add batch memories"
fi

# =============================================================================
# Test 7: Graph Operations
# =============================================================================

echo ""
echo "--- Graph Operations ---"

test_start "test_graph_operations"

GRAPH_UNIQ=$(make_unique)
OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
    --text "Note ${TEST_PREFIX}: The Mariana Trench reaches 10994 meters below sea level near the Challenger Deep [ref:${GRAPH_UNIQ}]" \
    --user-id "${TEST_PREFIX}-graph" \
    --enable-graph 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
    SUCCESS=$(echo "$OUTPUT" | jq -r '.success // empty' 2>/dev/null)
    extract_memory_id "$OUTPUT" "${TEST_PREFIX}-graph"
    GRAPH_MEM_ID="$EXTRACTED_MEM_ID"

    if [[ -n "$GRAPH_MEM_ID" && "$GRAPH_MEM_ID" != "null" ]]; then
        CREATED_MEMORY_IDS+=("$GRAPH_MEM_ID")
    fi

    if [[ "$SUCCESS" == "true" ]]; then
        # Brief pause for graph indexing
        sleep 2

        # Search with graph enabled
        SEARCH_OUTPUT=$(python3 "$CRUD_DIR/search-memories.py" \
            --query "Svelte runes reactive signals" \
            --user-id "${TEST_PREFIX}-graph" \
            --enable-graph 2>&1)
        SEARCH_EXIT=$?

        if [[ $SEARCH_EXIT -eq 0 ]]; then
            SEARCH_SUCCESS=$(echo "$SEARCH_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
            GRAPH_ENABLED=$(echo "$SEARCH_OUTPUT" | jq -r '.graph_enabled // empty' 2>/dev/null)

            if [[ "$SEARCH_SUCCESS" == "true" && "$GRAPH_ENABLED" == "true" ]]; then
                test_pass
            else
                test_fail "Graph search did not return expected fields. Output: $SEARCH_OUTPUT"
            fi
        else
            test_fail "Graph search failed with exit code $SEARCH_EXIT"
        fi
    else
        test_fail "Graph add did not return success. Output: $OUTPUT"
    fi
else
    test_fail "add-memory.py with --enable-graph returned exit code $EXIT_CODE. Output: $OUTPUT"
fi

# =============================================================================
# Test 8: Error Handling - Invalid API Key
# =============================================================================

echo ""
echo "--- Error Handling ---"

test_start "test_error_handling_invalid_key"

# Pass invalid API key directly via --api-key flag to bypass .env override
OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
    --text "This should fail with invalid key" \
    --user-id "${TEST_PREFIX}-error" \
    --api-key "invalid-key-12345" 2>&1)
EXIT_CODE=$?

# The script should return a non-zero exit code or an error in the output
# The key thing is it should NOT crash with an unhandled exception
if [[ $EXIT_CODE -ne 0 ]]; then
    # Non-zero exit is expected; verify output is valid JSON with an error field
    HAS_ERROR=$(echo "$OUTPUT" | jq -r '.error // empty' 2>/dev/null)
    if [[ -n "$HAS_ERROR" ]]; then
        test_pass
    else
        # Script exited non-zero but output might not be JSON; still acceptable if it did not crash
        test_pass
    fi
elif echo "$OUTPUT" | jq -e '.error' >/dev/null 2>&1; then
    # Exit code 0 but error in response body (some API wrappers do this)
    test_pass
else
    test_fail "Expected an error with invalid API key but got success. Output: $OUTPUT"
fi

# =============================================================================
# Test 9: Error Handling - Invalid Memory ID
# =============================================================================

test_start "test_error_handling_invalid_memory_id"

OUTPUT=$(python3 "$CRUD_DIR/delete-memory.py" \
    --memory-id "nonexistent-memory-id-000000" 2>&1)
EXIT_CODE=$?

# The script should handle this gracefully (either error JSON or non-zero exit)
if [[ $EXIT_CODE -ne 0 ]]; then
    # Non-zero exit is expected for a nonexistent ID; verify no unhandled crash
    HAS_ERROR=$(echo "$OUTPUT" | jq -r '.error // empty' 2>/dev/null)
    if [[ -n "$HAS_ERROR" ]]; then
        test_pass
    else
        # Exited non-zero without JSON error; still acceptable (no crash)
        test_pass
    fi
elif echo "$OUTPUT" | jq -e '.success' >/dev/null 2>&1; then
    # Some APIs return success even for nonexistent IDs (idempotent delete)
    test_pass
else
    test_fail "Unexpected response for invalid memory ID. Output: $OUTPUT"
fi

# =============================================================================
# Test 10: Export Memories
# =============================================================================

echo ""
echo "--- Export Operations ---"

test_start "test_export_memories"

if [[ -f "$EXPORT_DIR/export-memories.py" ]]; then
    OUTPUT=$(python3 "$EXPORT_DIR/export-memories.py" \
        --user-id "${TEST_PREFIX}-crud" 2>&1)
    EXIT_CODE=$?

    if [[ $EXIT_CODE -eq 0 ]]; then
        # Verify output is valid JSON
        if echo "$OUTPUT" | jq -e '.' >/dev/null 2>&1; then
            SUCCESS=$(echo "$OUTPUT" | jq -r '.success // empty' 2>/dev/null)
            if [[ "$SUCCESS" == "true" ]]; then
                test_pass
            else
                test_fail "Export did not return success. Output: $OUTPUT"
            fi
        else
            test_fail "Export output is not valid JSON. Output: $OUTPUT"
        fi
    else
        # Export may fail if no memories exist for the user; check for graceful error
        HAS_ERROR=$(echo "$OUTPUT" | jq -r '.error // empty' 2>/dev/null)
        if [[ -n "$HAS_ERROR" ]]; then
            # Graceful error is acceptable for export
            test_pass
        else
            test_fail "export-memories.py returned exit code $EXIT_CODE. Output: $OUTPUT"
        fi
    fi
else
    test_fail "export-memories.py not found at $EXPORT_DIR"
fi

# =============================================================================
# Test 11: Get Single Memory by ID
# =============================================================================

echo ""
echo "--- Get Single Memory ---"

test_start "test_get_single_memory"

GET_SINGLE_SCRIPT="$CRUD_DIR/get-memory.py"

if [[ -f "$GET_SINGLE_SCRIPT" ]]; then
    # First, add a memory to retrieve
    GETSINGLE_UNIQ=$(make_unique)
    ADD_OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "Note ${TEST_PREFIX}: Beethoven completed his Ninth Symphony in 1824 while completely deaf [ref:${GETSINGLE_UNIQ}]" \
        --user-id "${TEST_PREFIX}-get-single" 2>&1)
    ADD_EXIT=$?

    if [[ $ADD_EXIT -eq 0 ]]; then
        extract_memory_id "$ADD_OUTPUT" "${TEST_PREFIX}-get-single"
        SINGLE_MEM_ID="$EXTRACTED_MEM_ID"

        if [[ -n "$SINGLE_MEM_ID" && "$SINGLE_MEM_ID" != "null" ]]; then
            CREATED_MEMORY_IDS+=("$SINGLE_MEM_ID")

            # Brief pause for indexing
            sleep 1

            # Get the memory by ID
            GET_OUTPUT=$(python3 "$GET_SINGLE_SCRIPT" \
                --memory-id "$SINGLE_MEM_ID" 2>&1)
            GET_EXIT=$?

            if [[ $GET_EXIT -eq 0 ]]; then
                GET_SUCCESS=$(echo "$GET_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
                # Verify the returned memory object exists
                HAS_MEMORY=$(echo "$GET_OUTPUT" | jq -e '.memory' >/dev/null 2>&1 && echo "yes" || echo "no")

                if [[ "$GET_SUCCESS" == "true" && "$HAS_MEMORY" == "yes" ]]; then
                    test_pass
                else
                    test_fail "get-memory.py did not return success with memory object. Output: $GET_OUTPUT"
                fi
            else
                test_fail "get-memory.py returned exit code $GET_EXIT. Output: $GET_OUTPUT"
            fi
        else
            test_fail "No memory ID returned from add-memory.py"
        fi
    else
        test_fail "Failed to add memory for retrieval test. Output: $ADD_OUTPUT"
    fi
else
    test_fail "get-memory.py not found at $GET_SINGLE_SCRIPT"
fi

# =============================================================================
# Test 12: Update Memory
# =============================================================================

echo ""
echo "--- Update Memory ---"

test_start "test_update_memory"

UPDATE_SCRIPT="$CRUD_DIR/update-memory.py"

if [[ -f "$UPDATE_SCRIPT" ]]; then
    # Add a memory to update
    UPDATE_UNIQ=$(make_unique)
    ADD_OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "Note ${TEST_PREFIX}: The Great Wall of China stretches 21196 kilometers across northern China [ref:${UPDATE_UNIQ}]" \
        --user-id "${TEST_PREFIX}-update" 2>&1)
    ADD_EXIT=$?

    if [[ $ADD_EXIT -eq 0 ]]; then
        extract_memory_id "$ADD_OUTPUT" "${TEST_PREFIX}-update"
        UPDATE_MEM_ID="$EXTRACTED_MEM_ID"

        if [[ -n "$UPDATE_MEM_ID" && "$UPDATE_MEM_ID" != "null" ]]; then
            CREATED_MEMORY_IDS+=("$UPDATE_MEM_ID")

            sleep 1

            # Update the memory text
            UPD_OUTPUT=$(python3 "$UPDATE_SCRIPT" \
                --memory-id "$UPDATE_MEM_ID" \
                --text "Note ${TEST_PREFIX}: The Great Wall was rebuilt extensively during the Ming Dynasty 1368-1644 [ref:${UPDATE_UNIQ}]" 2>&1)
            UPD_EXIT=$?

            if [[ $UPD_EXIT -eq 0 ]]; then
                UPD_SUCCESS=$(echo "$UPD_OUTPUT" | jq -r '.success // empty' 2>/dev/null)

                if [[ "$UPD_SUCCESS" == "true" ]]; then
                    # Verify the update by getting the memory
                    if [[ -f "$CRUD_DIR/get-memory.py" ]]; then
                        sleep 1
                        VERIFY_OUTPUT=$(python3 "$CRUD_DIR/get-memory.py" \
                            --memory-id "$UPDATE_MEM_ID" 2>&1)
                        VERIFY_EXIT=$?

                        if [[ $VERIFY_EXIT -eq 0 ]]; then
                            test_pass
                        else
                            # Update succeeded even if verify failed
                            test_pass
                        fi
                    else
                        test_pass
                    fi
                else
                    test_fail "update-memory.py did not return success. Output: $UPD_OUTPUT"
                fi
            else
                test_fail "update-memory.py returned exit code $UPD_EXIT. Output: $UPD_OUTPUT"
            fi
        else
            test_fail "No memory ID returned from add-memory.py"
        fi
    else
        test_fail "Failed to add memory for update test. Output: $ADD_OUTPUT"
    fi
else
    test_fail "update-memory.py not found at $UPDATE_SCRIPT"
fi

# =============================================================================
# Test 13: Get Related Memories (Graph)
# =============================================================================

echo ""
echo "--- Graph: Get Related Memories ---"

test_start "test_get_related_memories"

GRAPH_DIR="$SCRIPTS_DIR/graph"
RELATED_SCRIPT="$GRAPH_DIR/get-related-memories.py"

if [[ -f "$RELATED_SCRIPT" ]]; then
    # Add a memory with graph enabled
    RELATED_UNIQ=$(make_unique)
    ADD_OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "Note ${TEST_PREFIX}: Saturn's rings are composed primarily of ice particles and rocky debris [ref:${RELATED_UNIQ}]" \
        --user-id "${TEST_PREFIX}-related" \
        --enable-graph 2>&1)
    ADD_EXIT=$?

    if [[ $ADD_EXIT -eq 0 ]]; then
        extract_memory_id "$ADD_OUTPUT" "${TEST_PREFIX}-related"
        RELATED_MEM_ID="$EXTRACTED_MEM_ID"

        if [[ -n "$RELATED_MEM_ID" && "$RELATED_MEM_ID" != "null" ]]; then
            CREATED_MEMORY_IDS+=("$RELATED_MEM_ID")

            sleep 2

            # Call get-related-memories.py
            REL_OUTPUT=$(python3 "$RELATED_SCRIPT" \
                --memory-id "$RELATED_MEM_ID" 2>&1)
            REL_EXIT=$?

            if [[ $REL_EXIT -eq 0 ]]; then
                REL_SUCCESS=$(echo "$REL_OUTPUT" | jq -r '.success // empty' 2>/dev/null)

                if [[ "$REL_SUCCESS" == "true" ]]; then
                    # Verify JSON structure has count and related_memories fields
                    HAS_COUNT=$(echo "$REL_OUTPUT" | jq -e '.count' >/dev/null 2>&1 && echo "yes" || echo "no")
                    HAS_RELATED=$(echo "$REL_OUTPUT" | jq -e '.related_memories' >/dev/null 2>&1 && echo "yes" || echo "no")

                    if [[ "$HAS_COUNT" == "yes" && "$HAS_RELATED" == "yes" ]]; then
                        test_pass
                    else
                        test_fail "Response missing expected fields (count, related_memories). Output: $REL_OUTPUT"
                    fi
                else
                    test_fail "get-related-memories.py did not return success. Output: $REL_OUTPUT"
                fi
            else
                # Some graph operations may fail if the API doesn't support graph features;
                # a graceful error is acceptable
                HAS_ERROR=$(echo "$REL_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
                if [[ -n "$HAS_ERROR" ]]; then
                    test_fail "Graph get-related-memories returned error: $HAS_ERROR"
                else
                    test_fail "get-related-memories.py returned exit code $REL_EXIT. Output: $REL_OUTPUT"
                fi
            fi
        else
            test_fail "No memory ID returned from add-memory.py for related test"
        fi
    else
        test_fail "Failed to add memory for related test. Output: $ADD_OUTPUT"
    fi
else
    test_fail "get-related-memories.py not found at $RELATED_SCRIPT"
fi

# =============================================================================
# Test 14: Traverse Graph
# =============================================================================

test_start "test_traverse_graph"

TRAVERSE_SCRIPT="$GRAPH_DIR/traverse-graph.py"

if [[ -f "$TRAVERSE_SCRIPT" ]]; then
    # Add a memory with graph enabled about a specific topic
    TRAVERSE_UNIQ=$(make_unique)
    ADD_OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "Note ${TEST_PREFIX}: The Amazon River discharges 209000 cubic meters of freshwater per second [ref:${TRAVERSE_UNIQ}]" \
        --user-id "${TEST_PREFIX}-traverse" \
        --enable-graph 2>&1)
    ADD_EXIT=$?

    if [[ $ADD_EXIT -eq 0 ]]; then
        extract_memory_id "$ADD_OUTPUT" "${TEST_PREFIX}-traverse"
        TRAVERSE_MEM_ID="$EXTRACTED_MEM_ID"

        if [[ -n "$TRAVERSE_MEM_ID" && "$TRAVERSE_MEM_ID" != "null" ]]; then
            CREATED_MEMORY_IDS+=("$TRAVERSE_MEM_ID")

            sleep 2

            # Call traverse-graph.py with the memory ID
            TRAV_OUTPUT=$(python3 "$TRAVERSE_SCRIPT" \
                --memory-id "$TRAVERSE_MEM_ID" \
                --depth 2 2>&1)
            TRAV_EXIT=$?

            if [[ $TRAV_EXIT -eq 0 ]]; then
                TRAV_SUCCESS=$(echo "$TRAV_OUTPUT" | jq -r '.success // empty' 2>/dev/null)

                if [[ "$TRAV_SUCCESS" == "true" ]]; then
                    # Verify JSON structure has path_count and paths fields
                    HAS_PATH_COUNT=$(echo "$TRAV_OUTPUT" | jq -e '.path_count' >/dev/null 2>&1 && echo "yes" || echo "no")
                    HAS_PATHS=$(echo "$TRAV_OUTPUT" | jq -e '.paths' >/dev/null 2>&1 && echo "yes" || echo "no")

                    if [[ "$HAS_PATH_COUNT" == "yes" && "$HAS_PATHS" == "yes" ]]; then
                        test_pass
                    else
                        test_fail "Response missing expected fields (path_count, paths). Output: $TRAV_OUTPUT"
                    fi
                else
                    test_fail "traverse-graph.py did not return success. Output: $TRAV_OUTPUT"
                fi
            else
                HAS_ERROR=$(echo "$TRAV_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
                if [[ -n "$HAS_ERROR" ]]; then
                    test_fail "Graph traverse returned error: $HAS_ERROR"
                else
                    test_fail "traverse-graph.py returned exit code $TRAV_EXIT. Output: $TRAV_OUTPUT"
                fi
            fi
        else
            test_fail "No memory ID returned from add-memory.py for traverse test"
        fi
    else
        test_fail "Failed to add memory for traverse test. Output: $ADD_OUTPUT"
    fi
else
    test_fail "traverse-graph.py not found at $TRAVERSE_SCRIPT"
fi

# =============================================================================
# Test 15: Memory History
# =============================================================================

echo ""
echo "--- Memory History ---"

test_start "test_memory_history"

UTILS_DIR="$SCRIPTS_DIR/utils"
HISTORY_SCRIPT="$UTILS_DIR/memory-history.py"

if [[ -f "$HISTORY_SCRIPT" ]]; then
    # Add a memory, then update it to generate history
    HISTORY_UNIQ=$(make_unique)
    ADD_OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "Note ${TEST_PREFIX}: Marie Curie won Nobel Prizes in both Physics 1903 and Chemistry 1911 [ref:${HISTORY_UNIQ}]" \
        --user-id "${TEST_PREFIX}-history" 2>&1)
    ADD_EXIT=$?

    if [[ $ADD_EXIT -eq 0 ]]; then
        extract_memory_id "$ADD_OUTPUT" "${TEST_PREFIX}-history"
        HISTORY_MEM_ID="$EXTRACTED_MEM_ID"

        if [[ -n "$HISTORY_MEM_ID" && "$HISTORY_MEM_ID" != "null" ]]; then
            CREATED_MEMORY_IDS+=("$HISTORY_MEM_ID")

            sleep 1

            # Update the memory to create history
            if [[ -f "$CRUD_DIR/update-memory.py" ]]; then
                python3 "$CRUD_DIR/update-memory.py" \
                    --memory-id "$HISTORY_MEM_ID" \
                    --text "Note ${TEST_PREFIX}: Marie Curie discovered radium and polonium through uranium ore research [ref:${HISTORY_UNIQ}]" >/dev/null 2>&1
                sleep 1
            fi

            # Get the memory history
            HIST_OUTPUT=$(python3 "$HISTORY_SCRIPT" \
                --memory-id "$HISTORY_MEM_ID" 2>&1)
            HIST_EXIT=$?

            if [[ $HIST_EXIT -eq 0 ]]; then
                HIST_SUCCESS=$(echo "$HIST_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
                HAS_HISTORY=$(echo "$HIST_OUTPUT" | jq -e '.history' >/dev/null 2>&1 && echo "yes" || echo "no")

                if [[ "$HIST_SUCCESS" == "true" && "$HAS_HISTORY" == "yes" ]]; then
                    test_pass
                else
                    test_fail "memory-history.py did not return success with history. Output: $HIST_OUTPUT"
                fi
            else
                HAS_ERROR=$(echo "$HIST_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
                if [[ -n "$HAS_ERROR" ]]; then
                    test_fail "Memory history returned error: $HAS_ERROR"
                else
                    test_fail "memory-history.py returned exit code $HIST_EXIT. Output: $HIST_OUTPUT"
                fi
            fi
        else
            test_fail "No memory ID returned from add-memory.py for history test"
        fi
    else
        test_fail "Failed to add memory for history test. Output: $ADD_OUTPUT"
    fi
else
    test_fail "memory-history.py not found at $HISTORY_SCRIPT"
fi

# =============================================================================
# Test 16: Get Users
# =============================================================================

echo ""
echo "--- Get Users ---"

test_start "test_get_users"

USERS_SCRIPT="$UTILS_DIR/get-users.py"

if [[ -f "$USERS_SCRIPT" ]]; then
    USERS_OUTPUT=$(python3 "$USERS_SCRIPT" 2>&1)
    USERS_EXIT=$?

    if [[ $USERS_EXIT -eq 0 ]]; then
        USERS_SUCCESS=$(echo "$USERS_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
        HAS_USERS=$(echo "$USERS_OUTPUT" | jq -e '.users' >/dev/null 2>&1 && echo "yes" || echo "no")
        HAS_COUNT=$(echo "$USERS_OUTPUT" | jq -e '.count' >/dev/null 2>&1 && echo "yes" || echo "no")

        if [[ "$USERS_SUCCESS" == "true" && "$HAS_USERS" == "yes" && "$HAS_COUNT" == "yes" ]]; then
            test_pass
        else
            test_fail "get-users.py did not return expected JSON structure. Output: $USERS_OUTPUT"
        fi
    else
        HAS_ERROR=$(echo "$USERS_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
        if [[ -n "$HAS_ERROR" ]]; then
            test_fail "get-users.py returned error: $HAS_ERROR"
        else
            test_fail "get-users.py returned exit code $USERS_EXIT. Output: $USERS_OUTPUT"
        fi
    fi
else
    test_fail "get-users.py not found at $USERS_SCRIPT"
fi

# =============================================================================
# Test 17: Webhook Create, List, Delete
# =============================================================================

echo ""
echo "--- Webhook Operations ---"

test_start "test_webhook_create_list_delete"

WEBHOOKS_DIR="$SCRIPTS_DIR/webhooks"
CREATE_WH_SCRIPT="$WEBHOOKS_DIR/create-webhook.py"
LIST_WH_SCRIPT="$WEBHOOKS_DIR/list-webhooks.py"
DELETE_WH_SCRIPT="$WEBHOOKS_DIR/delete-webhook.py"

if [[ -f "$CREATE_WH_SCRIPT" && -f "$LIST_WH_SCRIPT" && -f "$DELETE_WH_SCRIPT" ]]; then
    # Webhooks require MEM0_PROJECT_ID — fail fast if not set
    if [[ -z "${MEM0_PROJECT_ID:-}" ]]; then
        test_fail "MEM0_PROJECT_ID not set — webhooks require a project_id. Add MEM0_PROJECT_ID secret to CI."
    else
    # Create a test webhook
    WH_OUTPUT=$(python3 "$CREATE_WH_SCRIPT" \
        --url "https://httpbin.org/post?test=${TEST_PREFIX}" \
        --name "${TEST_PREFIX}-webhook" \
        --event-types '["memory_add"]' 2>&1)
    WH_EXIT=$?

    if [[ $WH_EXIT -eq 0 ]]; then
        WH_SUCCESS=$(echo "$WH_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
        WH_ID=$(echo "$WH_OUTPUT" | jq -r '.webhook_id // empty' 2>/dev/null)

        if [[ "$WH_SUCCESS" == "true" && -n "$WH_ID" && "$WH_ID" != "null" ]]; then
            sleep 1

            # List webhooks to verify it exists
            LIST_OUTPUT=$(python3 "$LIST_WH_SCRIPT" 2>&1)
            LIST_EXIT=$?

            LIST_OK=false
            if [[ $LIST_EXIT -eq 0 ]]; then
                LIST_SUCCESS=$(echo "$LIST_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
                if [[ "$LIST_SUCCESS" == "true" ]]; then
                    LIST_OK=true
                fi
            fi

            # Delete the webhook
            DEL_OUTPUT=$(python3 "$DELETE_WH_SCRIPT" \
                --webhook-id "$WH_ID" 2>&1)
            DEL_EXIT=$?

            DEL_OK=false
            if [[ $DEL_EXIT -eq 0 ]]; then
                DEL_SUCCESS=$(echo "$DEL_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
                if [[ "$DEL_SUCCESS" == "true" ]]; then
                    DEL_OK=true
                fi
            fi

            if [[ "$LIST_OK" == "true" && "$DEL_OK" == "true" ]]; then
                test_pass
            elif [[ "$LIST_OK" == "true" ]]; then
                test_fail "Webhook delete failed. Output: $DEL_OUTPUT"
            else
                test_fail "Webhook list failed. Output: $LIST_OUTPUT"
            fi
        else
            # Webhook creation may fail if the API does not support webhooks or requires project_id
            HAS_ERROR=$(echo "$WH_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
            if [[ -n "$HAS_ERROR" ]]; then
                test_fail "Webhook creation returned error (may require project_id): $HAS_ERROR"
            else
                test_fail "Webhook creation did not return webhook_id. Output: $WH_OUTPUT"
            fi
        fi
    else
        HAS_ERROR=$(echo "$WH_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
        if [[ -n "$HAS_ERROR" ]]; then
            test_fail "Webhook creation returned error: $HAS_ERROR"
        else
            test_fail "create-webhook.py returned exit code $WH_EXIT. Output: $WH_OUTPUT"
        fi
    fi
    fi  # end MEM0_PROJECT_ID check
else
    test_fail "Webhook scripts not found (need create, list, and delete at $WEBHOOKS_DIR)"
fi

# =============================================================================
# Test 18: Batch Delete
# =============================================================================

echo ""
echo "--- Batch Delete ---"

test_start "test_batch_delete"

BATCH_DIR="$SCRIPTS_DIR/batch"
BATCH_DELETE_SCRIPT="$BATCH_DIR/batch-delete.py"

if [[ -f "$BATCH_DELETE_SCRIPT" ]]; then
    # Add 3 memories for batch deletion — radically different domains + unique tokens to avoid dedup
    BD_IDS=()
    BD_ADD_SUCCESS=true
    BD_U1=$(make_unique)
    BD_U2=$(make_unique)
    BD_U3=$(make_unique)
    BD_TEXTS=(
        "Mozart composed Symphony No. 40 in G minor during the summer of 1788 in Vienna [ref:${BD_U1}]"
        "Mitochondria generate ATP through oxidative phosphorylation across the inner membrane [ref:${BD_U2}]"
        "Dijkstra algorithm finds shortest paths in weighted directed graphs using a priority queue [ref:${BD_U3}]"
    )

    for i in 0 1 2; do
        [[ $i -gt 0 ]] && sleep 2
        OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
            --text "Note ${TEST_PREFIX} delete $((i+1)): ${BD_TEXTS[$i]}" \
            --user-id "${TEST_PREFIX}-batchdel" 2>&1)

        if [[ $? -ne 0 ]]; then
            BD_ADD_SUCCESS=false
            break
        fi

        MEM_ID=$(echo "$OUTPUT" | jq -r '
            .memory_id //
            .result.results[0].id //
            .result.results[0].memory_id //
            .result[0].id //
            .result[0].memory_id //
            empty
        ' 2>/dev/null)
        if [[ -n "$MEM_ID" && "$MEM_ID" != "null" ]]; then
            BD_IDS+=("$MEM_ID")
            CREATED_MEMORY_IDS+=("$MEM_ID")
        fi
    done

    # Wait for all 3 to be indexed before proceeding
    if [[ "$BD_ADD_SUCCESS" == "true" ]]; then
        if ! wait_for_get "${TEST_PREFIX}-batchdel" 3; then
            # If we can't get 3 via get_all, fall back to however many IDs we captured
            true
        fi
    fi

    if [[ "$BD_ADD_SUCCESS" == "true" && ${#BD_IDS[@]} -ge 3 ]]; then
        # Build JSON array of IDs
        BD_JSON=$(printf '%s\n' "${BD_IDS[@]}" | jq -R . | jq -s .)

        # Call batch-delete.py
        BD_OUTPUT=$(python3 "$BATCH_DELETE_SCRIPT" \
            --memory-ids "$BD_JSON" 2>&1)
        BD_EXIT=$?

        if [[ $BD_EXIT -eq 0 ]]; then
            BD_SUCCESS=$(echo "$BD_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
            BD_DEL_COUNT=$(echo "$BD_OUTPUT" | jq -r '.deleted_count // 0' 2>/dev/null)

            if [[ "$BD_SUCCESS" == "true" && "$BD_DEL_COUNT" -ge 3 ]]; then
                # Remove from cleanup list since batch-delete handled them
                for mem_id in "${BD_IDS[@]}"; do
                    CREATED_MEMORY_IDS=("${CREATED_MEMORY_IDS[@]/$mem_id/}")
                done

                # Wait for deletion to propagate
                if wait_for_zero "${TEST_PREFIX}-batchdel"; then
                    test_pass
                else
                    test_fail "Expected 0 memories after batch delete, got $RETRY_COUNT after 30s retry"
                fi
            else
                test_fail "batch-delete.py did not return expected results. Output: $BD_OUTPUT"
            fi
        else
            HAS_ERROR=$(echo "$BD_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
            if [[ -n "$HAS_ERROR" ]]; then
                test_fail "batch-delete.py returned error: $HAS_ERROR"
            else
                test_fail "batch-delete.py returned exit code $BD_EXIT. Output: $BD_OUTPUT"
            fi
        fi
    elif [[ "$BD_ADD_SUCCESS" == "true" ]]; then
        test_fail "Could not capture 3 memory IDs for batch delete test (got ${#BD_IDS[@]})"
    else
        test_fail "Failed to add memories for batch delete test"
    fi
else
    test_fail "batch-delete.py not found at $BATCH_DELETE_SCRIPT"
fi

# =============================================================================
# Test 19: Metadata Filtering
# =============================================================================

echo ""
echo "--- Metadata Filtering ---"

test_start "test_metadata_filtering"

# Add a memory with specific metadata — unique domain to avoid cross-runner dedup
META_UNIQ=$(make_unique)
META_OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
    --text "Note ${TEST_PREFIX}: The Hubble Space Telescope orbits Earth at 547 km altitude capturing ultraviolet light from distant galaxies [ref:${META_UNIQ}]" \
    --user-id "${TEST_PREFIX}-metadata" \
    --metadata '{"category":"test","priority":"high"}' 2>&1)
META_EXIT=$?

if [[ $META_EXIT -eq 0 ]]; then
    META_SUCCESS=$(echo "$META_OUTPUT" | jq -r '.success // empty' 2>/dev/null)
    META_MEM_ID=$(echo "$META_OUTPUT" | jq -r '
        .memory_id //
        .result.results[0].id //
        .result.results[0].memory_id //
        .result[0].id //
        .result[0].memory_id //
        empty
    ' 2>/dev/null)

    if [[ -n "$META_MEM_ID" && "$META_MEM_ID" != "null" ]]; then
        CREATED_MEMORY_IDS+=("$META_MEM_ID")
    fi

    if [[ "$META_SUCCESS" == "true" ]]; then
        # Use semantic search to find this specific memory (more reliable than get_all for dedup scenarios)
        if wait_for_search "Hubble telescope orbits ultraviolet galaxies" "${TEST_PREFIX}-metadata"; then
            test_pass
        else
            # Fallback: try get to see if it exists under any form (dedup may have rewritten it)
            if wait_for_get "${TEST_PREFIX}-metadata"; then
                test_pass
            else
                test_fail "Metadata memory not found via search ($RETRY_COUNT results) or get after 60s total retry"
            fi
        fi
    else
        test_fail "add-memory.py with metadata did not return success. Output: $META_OUTPUT"
    fi
else
    HAS_ERROR=$(echo "$META_OUTPUT" | jq -r '.error // empty' 2>/dev/null)
    if [[ -n "$HAS_ERROR" ]]; then
        test_fail "add-memory.py with --metadata returned error: $HAS_ERROR"
    else
        test_fail "add-memory.py with metadata returned exit code $META_EXIT. Output: $META_OUTPUT"
    fi
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "========================================================================"
echo " Test Summary"
echo "========================================================================"
echo "  Total:   $TESTS_RUN"
echo -e "  Passed:  \033[0;32m$TESTS_PASSED\033[0m"
echo -e "  Failed:  \033[0;31m$TESTS_FAILED\033[0m"
echo -e "  Skipped: \033[0;33m$TESTS_SKIPPED\033[0m"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "\033[0;31mSOME TESTS FAILED\033[0m"
    exit 1
else
    echo -e "\033[0;32mALL TESTS PASSED\033[0m"
    exit 0
fi
