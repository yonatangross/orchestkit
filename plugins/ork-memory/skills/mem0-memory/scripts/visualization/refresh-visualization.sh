#!/usr/bin/env bash
# Refresh Mem0 visualization: update memories, regenerate, export all formats

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

echo "=========================================="
echo "Refreshing Mem0 Visualization"
echo "=========================================="
echo ""

# Step 1: Update existing memories metadata
log "Step 1: Updating existing memories metadata..."
if python3 "$SCRIPT_DIR/../validation/update-memories-metadata.py" 2>&1 | tail -3 | grep -q "complete"; then
    log_success "Memories updated"
else
    log_warn "Some memories may not have been updated"
fi
echo ""

# Step 2: Regenerate visualization in all formats
log "Step 2: Regenerating visualizations..."

# JSON export (always works)
log "  Generating JSON export..."
python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format json --output mem0-graph.json 2>&1 | grep -q "✓" && log_success "  JSON exported"

# Plotly (if available)
if python3 -c "import plotly" 2>/dev/null; then
    log "  Generating Plotly interactive HTML..."
    python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format plotly --output mem0-graph.html 2>&1 | grep -q "✓" && log_success "  Plotly HTML created"
else
    log_warn "  Plotly not available (install with setup-visualization-deps.sh)"
fi

# NetworkX static image (if available)
if python3 -c "import networkx, matplotlib" 2>/dev/null; then
    log "  Generating NetworkX static image..."
    python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format networkx --output mem0-graph.png 2>&1 | grep -q "✓" && log_success "  Static image created"
fi

# Mermaid diagram
log "  Generating Mermaid diagram..."
python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format mermaid --output mem0-graph.mmd 2>&1 | grep -q "✓" && log_success "  Mermaid diagram created"

# GraphML export
log "  Generating GraphML export..."
python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format graphml --output mem0-graph.graphml 2>&1 | grep -q "✓" && log_success "  GraphML exported"

# CSV export
log "  Generating CSV export..."
python3 "$SCRIPT_DIR/visualize-mem0-graph.py" --format csv --output mem0-graph.csv 2>&1 | grep -q "✓" && log_success "  CSV files created"
echo ""

# Step 3: Create summary report
log "Step 3: Creating summary report..."
SUMMARY_FILE="$PROJECT_ROOT/outputs/mem0-refresh-summary.txt"

{
    echo "Mem0 Visualization Refresh Summary"
    echo "==================================="
    echo "Date: $(date)"
    echo ""
    echo "Exports Generated:"
    ls -lh "$PROJECT_ROOT/outputs"/mem0-graph.* 2>/dev/null | awk '{print "  -", $9, "(" $5 ")"}' || echo "  (No exports found)"
    echo ""
    echo "Graph Statistics:"
    if [ -f "$PROJECT_ROOT/outputs/mem0-graph.json" ]; then
        python3 -c "
import json
with open('$PROJECT_ROOT/outputs/mem0-graph.json') as f:
    data = json.load(f)
    print(f\"  Nodes: {data.get('node_count', 0)}\")
    print(f\"  Edges: {data.get('edge_count', 0)}\")
    entity_counts = {}
    for node in data.get('nodes', []):
        et = node.get('entity_type', 'Unknown')
        entity_counts[et] = entity_counts.get(et, 0) + 1
    print(\"  Entity types:\")
    for et, count in sorted(entity_counts.items()):
        print(f\"    {et}: {count}\")
" 2>/dev/null || echo "  (Could not parse statistics)"
    fi
    echo ""
    echo "View Visualizations:"
    echo "  - Interactive: open outputs/mem0-graph-visualization.html"
    echo "  - Static: open outputs/mem0-graph.png"
    echo "  - Data: outputs/mem0-graph.json"
} > "$SUMMARY_FILE"

log_success "Summary report: $SUMMARY_FILE"
echo ""

# Final summary
log_success "✓ Visualization refresh complete!"
echo ""
echo "Files generated in outputs/:"
ls -1 "$PROJECT_ROOT/outputs"/mem0-graph.* 2>/dev/null | sed 's|.*/|  - |' || echo "  (No files found)"
echo ""
echo "View summary: cat $SUMMARY_FILE"
