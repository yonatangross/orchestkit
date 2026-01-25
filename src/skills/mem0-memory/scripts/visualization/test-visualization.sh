#!/usr/bin/env bash
# Test Mem0 visualization: verify entity types, categories, relationships, visualization generation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

TESTS_PASSED=0
TESTS_FAILED=0

echo "=========================================="
echo "Mem0 Visualization System - Test Suite"
echo "=========================================="
echo ""

# Test 1: Verify entity types are present
log "Test 1: Verifying entity types..."
if python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format json --limit 50 --output test-entities.json 2>&1 | python3 -c "
import json, sys
data = json.load(sys.stdin) if not sys.stdin.isatty() else {}
if 'nodes' in data:
    entity_types = set(node.get('entity_type') for node in data['nodes'])
    expected = {'Agent', 'Skill', 'Technology', 'Category', 'Architecture'}
    found = entity_types & expected
    if found:
        print(f'Found entity types: {found}')
        sys.exit(0)
    else:
        print(f'No expected entity types found. Found: {entity_types}')
        sys.exit(1)
else:
    # Try to parse from file
    try:
        with open('$PROJECT_ROOT/outputs/test-entities.json') as f:
            data = json.load(f)
            entity_types = set(node.get('entity_type') for node in data.get('nodes', []))
            expected = {'Agent', 'Skill', 'Technology', 'Category', 'Architecture'}
            found = entity_types & expected
            if found:
                print(f'Found entity types: {found}')
                sys.exit(0)
    except:
        pass
    print('Could not verify entity types')
    sys.exit(1)
" 2>/dev/null; then
    log_success "Entity types present"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    log_fail "Entity types missing or incorrect"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 2: Check category coverage
log "Test 2: Checking category coverage..."
if python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR/../lib')
from mem0_client import get_mem0_client
client = get_mem0_client()
result = client.search(
    query='category groups related',
    filters={'user_id': 'orchestkit-plugin-structure', 'metadata.entity_type': 'Category'},
    limit=20
)
categories = [m.get('metadata', {}).get('category_slug') or m.get('metadata', {}).get('category') for m in result.get('results', [])]
expected_count = 18
if len(categories) >= 10:
    print(f'Found {len(categories)} categories')
    sys.exit(0)
else:
    print(f'Only found {len(categories)} categories (expected ~18)')
    sys.exit(1)
" 2>&1 | grep -q "Found"; then
    log_success "Category coverage OK"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    log_warn "Category coverage may be incomplete"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 3: Validate relationship integrity
log "Test 3: Validating relationship integrity..."
if python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format json --limit 100 --output test-relationships.json 2>&1 | python3 -c "
import json, sys
try:
    with open('$PROJECT_ROOT/outputs/test-relationships.json') as f:
        data = json.load(f)
    nodes = data.get('nodes', [])
    edges = data.get('edges', [])
    
    # Check that edges reference valid nodes
    node_indices = set(range(len(nodes)))
    edge_indices = set()
    for edge in edges:
        edge_indices.add(edge.get('source'))
        edge_indices.add(edge.get('target'))
    
    invalid = edge_indices - node_indices
    if invalid:
        print(f'Invalid edge references: {invalid}')
        sys.exit(1)
    else:
        print(f'All {len(edges)} edges reference valid nodes')
        sys.exit(0)
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
" 2>/dev/null; then
    log_success "Relationship integrity OK"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    log_fail "Relationship integrity issues found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 4: Test visualization generation
log "Test 4: Testing visualization generation..."
if python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format json --limit 10 --output test-viz.json 2>&1 | grep -q "✓"; then
    if [ -f "$PROJECT_ROOT/outputs/test-viz.json" ]; then
        log_success "Visualization generation works"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_fail "Visualization file not created"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    log_fail "Visualization generation failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 5: Verify color mapping
log "Test 5: Verifying color mapping..."
if python3 -c "
import json
with open('$PROJECT_ROOT/outputs/test-entities.json') as f:
    data = json.load(f)
color_map = {
    'Agent': '#3B82F6',
    'Skill': '#10B981',
    'Technology': '#F59E0B',
    'Category': '#8B5CF6',
    'Architecture': '#EF4444'
}
errors = []
for node in data.get('nodes', []):
    et = node.get('entity_type')
    color = node.get('color')
    expected = color_map.get(et, '#9CA3AF')
    if color != expected:
        errors.append(f'{et}: expected {expected}, got {color}')
if errors:
    print('Color mapping errors:', errors)
    exit(1)
else:
    print('Color mapping correct')
    exit(0)
" 2>/dev/null; then
    log_success "Color mapping correct"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    log_fail "Color mapping errors found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 6: Check export formats
log "Test 6: Testing export formats..."
FORMATS=("json" "mermaid" "graphml" "csv")
FORMAT_COUNT=0

for fmt in "${FORMATS[@]}"; do
    if python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format "$fmt" --limit 5 --output "test.$fmt" 2>&1 | grep -q "✓"; then
        FORMAT_COUNT=$((FORMAT_COUNT + 1))
    fi
done

if [ $FORMAT_COUNT -ge 2 ]; then
    log_success "Export formats working ($FORMAT_COUNT/${#FORMATS[@]})"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    log_warn "Some export formats may not be working ($FORMAT_COUNT/${#FORMATS[@]})"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Cleanup test files
rm -f "$PROJECT_ROOT/outputs/test-*.json" "$PROJECT_ROOT/outputs/test-*.mmd" "$PROJECT_ROOT/outputs/test-*.graphml" "$PROJECT_ROOT/outputs/nodes.csv" "$PROJECT_ROOT/outputs/edges.csv" 2>/dev/null || true

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Total:  $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    log_success "All tests passed!"
    exit 0
else
    log_fail "Some tests failed. Review output above."
    exit 1
fi
