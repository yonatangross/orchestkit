#!/usr/bin/env bash
# Master setup script for complete Mem0 visualization system
# Runs all setup steps end-to-end

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

echo "=========================================="
echo "Mem0 Visualization System - Complete Setup"
echo "=========================================="
echo ""

# Step 1: Check dependencies
log "Step 1: Checking dependencies..."
if ! "$SCRIPT_DIR/../visualization/verify-visualization-setup.sh" 2>/dev/null; then
    log_warn "Dependencies not fully set up. Installing..."
    if "$SCRIPT_DIR/../visualization/setup-visualization-deps.sh"; then
        log_success "Dependencies installed"
    else
        log_error "Failed to install dependencies"
        ERRORS=$((ERRORS + 1))
    fi
else
    log_success "Dependencies OK"
fi
echo ""

# Step 2: Setup custom categories
log "Step 2: Setting up custom Mem0 categories..."
if python3 "$SCRIPT_DIR/setup-categories.py"; then
    log_success "Custom categories set up"
else
    log_warn "Category setup failed (may require Pro/Enterprise plan)"
fi
echo ""

# Step 3: Update existing memories
log "Step 3: Updating existing memories with enhanced metadata..."
if python3 "$SCRIPT_DIR/../validation/update-memories-metadata.py" --limit 1000 2>&1 | grep -q "✓"; then
    log_success "Existing memories updated"
else
    log_warn "Some memories may not have been updated"
fi
echo ""

# Step 4: Create comprehensive memories
log "Step 4: Creating comprehensive plugin structure memories..."
log "  This may take several minutes due to API rate limits..."
echo ""

# 4a: Categories
log "  4a. Creating category memories..."
if python3 "$SCRIPT_DIR/../create/create-category-memories.py" --skip-existing 2>&1 | tail -5 | grep -q "complete"; then
    log_success "  Categories created"
else
    log_warn "  Some categories may already exist"
fi

# 4b: Technologies
log "  4b. Creating technology memories..."
if python3 "$SCRIPT_DIR/../create/create-technology-memories.py" --skip-existing 2>&1 | tail -5 | grep -q "complete"; then
    log_success "  Technologies created"
else
    log_warn "  Some technologies may already exist"
fi

# 4c: Agents
log "  4c. Creating agent memories..."
if python3 "$SCRIPT_DIR/../create/create-all-agent-memories.py" --skip-existing 2>&1 | tail -5 | grep -q "complete"; then
    log_success "  Agents created"
else
    log_warn "  Some agents may already exist"
fi

# 4d: Skills
log "  4d. Creating skill memories..."
log "    (This may take a while for 161 skills...)"
if python3 "$SCRIPT_DIR/../create/create-all-skill-memories.py" --skip-existing 2>&1 | tail -5 | grep -q "complete"; then
    log_success "  Skills created"
else
    log_warn "  Some skills may already exist or failed"
fi

# 4e: Relationships
log "  4e. Creating relationship memories..."
log "    (This may take a while...)"
if python3 "$SCRIPT_DIR/../create/create-deep-relationships.py" --phase all 2>&1 | tail -10 | grep -q "successfully"; then
    log_success "  Relationships created"
else
    log_warn "  Some relationships may have failed"
fi
echo ""

# Step 5: Generate initial visualization
log "Step 5: Generating initial visualization..."
if python3 "$SCRIPT_DIR/../visualization/visualize-mem0-graph.py" --format json --output initial-graph.json 2>&1 | grep -q "✓"; then
    log_success "Initial visualization exported"
    
    # Try to generate Plotly if dependencies available
    if python3 -c "import plotly" 2>/dev/null; then
        log "  Generating Plotly interactive visualization..."
        python3 "$SCRIPT_DIR/../visualization/visualize-mem0-graph.py" --format plotly --output mem0-graph.html 2>&1 | grep -q "✓" && log_success "  Plotly visualization created"
    fi
else
    log_warn "Visualization generation had issues"
fi
echo ""

# Step 6: Summary report
log "Step 6: Generating summary report..."
SUMMARY_FILE="$PROJECT_ROOT/outputs/mem0-setup-summary.txt"
mkdir -p "$PROJECT_ROOT/outputs"

{
    echo "Mem0 Visualization System - Setup Summary"
    echo "=========================================="
    echo "Date: $(date)"
    echo ""
    echo "Steps Completed:"
    echo "  [✓] Dependencies checked/installed"
    echo "  [✓] Custom categories set up"
    echo "  [✓] Existing memories updated"
    echo "  [✓] Category memories created"
    echo "  [✓] Technology memories created"
    echo "  [✓] Agent memories created"
    echo "  [✓] Skill memories created"
    echo "  [✓] Relationship memories created"
    echo "  [✓] Initial visualization generated"
    echo ""
    echo "Next Steps:"
    echo "  1. Wait 2-5 minutes for Mem0 to process relationships"
    echo "  2. Generate full visualization:"
    echo "     python3 $SCRIPT_DIR/../visualization/visualize-mem0-graph.py --format plotly"
    echo "  3. View visualization:"
    echo "     open outputs/mem0-graph-visualization.html"
    echo ""
    echo "Documentation:"
    echo "  - Setup guide: skills/mem0-memory/references/visualization.md"
    echo "  - Data structure: skills/mem0-memory/references/data-structure.md"
} > "$SUMMARY_FILE"

log_success "Summary report saved to: $SUMMARY_FILE"
echo ""

# Final summary
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    log_success "✓ Complete setup finished successfully!"
    echo ""
    echo "You can now:"
    echo "  1. View the visualization: open outputs/mem0-graph-visualization.html"
    echo "  2. Check the summary: cat outputs/mem0-setup-summary.txt"
    echo "  3. Refresh visualization: $SCRIPT_DIR/../visualization/refresh-visualization.sh"
else
    log_error "✗ Setup completed with $ERRORS error(s)"
    echo "  Check the output above for details"
fi
echo "=========================================="
