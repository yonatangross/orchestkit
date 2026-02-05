#!/usr/bin/env bash
# Verify visualization setup: check dependencies, Mem0 connection, test exports

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
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

ERRORS=0

# Check Python
log "Checking Python..."
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 not found"
    ERRORS=$((ERRORS + 1))
else
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    log_success "Python: $PYTHON_VERSION"
fi

# Check dependencies
log "Checking visualization dependencies..."
MISSING_DEPS=()

python3 -c "import plotly" 2>/dev/null || MISSING_DEPS+=("plotly")
python3 -c "import networkx" 2>/dev/null || MISSING_DEPS+=("networkx")
python3 -c "import matplotlib" 2>/dev/null || MISSING_DEPS+=("matplotlib")

if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
    log_success "All visualization dependencies installed"
else
    log_warn "Missing dependencies: ${MISSING_DEPS[*]}"
    log "Run: skills/mem0-memory/scripts/setup-visualization-deps.sh"
    ERRORS=$((ERRORS + ${#MISSING_DEPS[@]}))
fi

# Check Mem0 client
log "Checking Mem0 client..."
if python3 -c "from skills.mem0_memory.scripts.lib.mem0_client import get_mem0_client" 2>/dev/null; then
    log_success "Mem0 client importable"
elif python3 -c "import sys; sys.path.insert(0, '$SCRIPT_DIR/../lib'); from mem0_client import get_mem0_client" 2>/dev/null; then
    log_success "Mem0 client importable (via path)"
else
    log_error "Cannot import mem0_client"
    ERRORS=$((ERRORS + 1))
fi

# Test Mem0 API connection
log "Testing Mem0 API connection..."
if python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR/lib')
from mem0_client import get_mem0_client
try:
    client = get_mem0_client()
    # Try a simple search to verify connection
    result = client.search(query='test', limit=1)
    print('Connection successful')
except Exception as e:
    print(f'Connection failed: {e}')
    sys.exit(1)
" 2>&1; then
    log_success "Mem0 API connection working"
else
    log_error "Mem0 API connection failed"
    ERRORS=$((ERRORS + 1))
fi

# Check custom categories
log "Checking custom categories..."
if python3 "$SCRIPT_DIR/setup-categories.py" --check 2>/dev/null || python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR/lib')
from mem0_client import get_mem0_client
try:
    client = get_mem0_client()
    if hasattr(client, 'project'):
        info = client.project.get(fields=['custom_categories'])
        if 'custom_categories' in info and len(info['custom_categories']) > 0:
            print(f\"Found {len(info['custom_categories'])} custom categories\")
        else:
            print('No custom categories found')
            sys.exit(1)
    else:
        print('Project API not available')
        sys.exit(1)
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
" 2>&1 | grep -q "Found"; then
    log_success "Custom categories are active"
else
    log_warn "Custom categories not set (run setup-categories.py)"
fi

# Test visualization export
log "Testing visualization export (JSON format)..."
if python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --user-id "orchestkit-plugin-structure" --format json --limit 5 --output test-export.json 2>&1 | grep -q "✓"; then
    log_success "Visualization export working"
    # Cleanup test file
    rm -f "$PROJECT_ROOT/outputs/test-export.json" 2>/dev/null || true
else
    log_warn "Visualization export test failed (may be due to no memories)"
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    log_success "✓ All checks passed! Visualization setup is ready."
    exit 0
else
    log_error "✗ Found $ERRORS issue(s). Please fix before proceeding."
    exit 1
fi
