#!/usr/bin/env bash
#
# dependency-mapper.sh
# Extract import statements and identify dependency hotspots
#
# Usage: ./dependency-mapper.sh [directory] [--top N]
#
# Supports: Python, TypeScript, JavaScript
#

set -euo pipefail

# Defaults
TARGET_DIR="${1:-.}"
TOP_N=10

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --top)
            TOP_N="$2"
            shift 2
            ;;
        *)
            TARGET_DIR="$1"
            shift
            ;;
    esac
done

# Temp files
IMPORTS_FILE=$(mktemp)
COUNTS_FILE=$(mktemp)
trap 'rm -f "$IMPORTS_FILE" "$COUNTS_FILE"' EXIT

echo "Scanning: $TARGET_DIR"
echo "======================================"
echo ""

# Extract Python imports
extract_python() {
    find "$TARGET_DIR" -name "*.py" -type f 2>/dev/null | while read -r file; do
        grep -E "^(import |from .+ import )" "$file" 2>/dev/null | while read -r line; do
            # Extract module name
            if [[ "$line" =~ ^import[[:space:]]+([a-zA-Z0-9_.]+) ]]; then
                echo "${file}:${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^from[[:space:]]+([a-zA-Z0-9_.]+)[[:space:]]+import ]]; then
                echo "${file}:${BASH_REMATCH[1]}"
            fi
        done
    done
}

# Extract TypeScript/JavaScript imports
extract_js_ts() {
    find "$TARGET_DIR" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -type f 2>/dev/null | while read -r file; do
        grep -E "^import .+ from ['\"]" "$file" 2>/dev/null | while read -r line; do
            # Extract module path
            if [[ "$line" =~ from[[:space:]]+[\'\"]([@a-zA-Z0-9_./-]+)[\'\"] ]]; then
                echo "${file}:${BASH_REMATCH[1]}"
            fi
        done
        # Also check require statements
        grep -E "require\(['\"]" "$file" 2>/dev/null | while read -r line; do
            if [[ "$line" =~ require\([\'\"]([@a-zA-Z0-9_./-]+)[\'\"]\) ]]; then
                echo "${file}:${BASH_REMATCH[1]}"
            fi
        done
    done
}

# Collect all imports
echo "Extracting imports..."
{
    extract_python
    extract_js_ts
} > "$IMPORTS_FILE"

TOTAL_IMPORTS=$(wc -l < "$IMPORTS_FILE" | tr -d ' ')
echo "Found $TOTAL_IMPORTS import statements"
echo ""

# Count dependencies per file (fan-out)
echo "## Fan-Out (Dependencies per File)"
echo "Files with most outgoing dependencies:"
echo ""
cut -d: -f1 "$IMPORTS_FILE" | sort | uniq -c | sort -rn | head -n "$TOP_N" | while read -r count file; do
    printf "  %-50s %3d deps\n" "$file" "$count"
done
echo ""

# Count how often each module is imported (fan-in)
echo "## Fan-In (Most Imported Modules)"
echo "Modules that other files depend on most:"
echo ""
cut -d: -f2 "$IMPORTS_FILE" | sort | uniq -c | sort -rn | head -n "$TOP_N" | while read -r count module; do
    printf "  %-40s %3d imports\n" "$module" "$count"
done
echo ""

# Identify potential hotspots (high fan-in + high fan-out)
echo "## Potential Hotspots"
echo "Files with both high fan-in and fan-out:"
echo ""

# Get fan-out per file
cut -d: -f1 "$IMPORTS_FILE" | sort | uniq -c | sort -rn > "$COUNTS_FILE"

# For each high fan-out file, check if it's also frequently imported
while read -r fanout file; do
    # Skip if fan-out is low
    [[ "$fanout" -lt 5 ]] && continue

    # Get base name for fan-in check
    basename=$(basename "$file" | sed 's/\.[^.]*$//')
    fanin=$(grep -c "$basename" "$IMPORTS_FILE" 2>/dev/null || echo 0)

    if [[ "$fanin" -gt 3 ]]; then
        coupling=$((fanout + fanin))
        printf "  %-45s fan-in: %2d  fan-out: %2d  coupling: %2d\n" "$file" "$fanin" "$fanout" "$coupling"
    fi
done < "$COUNTS_FILE" | sort -t: -k4 -rn | head -n "$TOP_N"

echo ""
echo "======================================"
echo "Scan complete. Total imports: $TOTAL_IMPORTS"
