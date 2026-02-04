#!/bin/bash
# Quick visualization script - generates all graphs and opens dashboard
# Usage: ./quick-visualize.sh [--agents agent1 agent2] [--limit 100]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

echo "🎯 Generating Mem0 Graph Visualizations..."
echo ""

# Check if mem0 API key is set
if [[ -z "${MEM0_API_KEY:-}" ]]; then
    echo "⚠️  MEM0_API_KEY not set. Some operations may fail."
    echo "   Set it with: export MEM0_API_KEY='sk-...'"
    echo ""
fi

# Generate all graphs
python3 "$SCRIPT_DIR/generate-all-graphs.py" "$@"

# Open dashboard if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    DASHBOARD="$PROJECT_ROOT/outputs/mem0-graph-dashboard.html"
    if [[ -f "$DASHBOARD" ]]; then
        echo ""
        echo "🚀 Opening dashboard in browser..."
        open "$DASHBOARD"
    fi
fi

echo ""
echo "✅ Done! Check outputs/ directory for all visualizations."
