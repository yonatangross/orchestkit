#!/usr/bin/env python3
"""Generate graph statistics from mem0-graph.json for CI summary."""
import json
import sys
from pathlib import Path

def main():
    json_path = Path("outputs/mem0-graph.json")
    
    if not json_path.exists():
        print("  (No graph JSON file found)")
        return 0
    
    try:
        with open(json_path) as f:
            data = json.load(f)
        
        print(f"  Nodes: {data.get('node_count', 0)}")
        print(f"  Edges: {data.get('edge_count', 0)}")
        
        entity_counts = {}
        for node in data.get("nodes", []):
            et = node.get("entity_type", "Unknown")
            entity_counts[et] = entity_counts.get(et, 0) + 1
        
        print("  Entity types:")
        for et, count in sorted(entity_counts.items()):
            print(f"    {et}: {count}")
        
        return 0
    except Exception as e:
        print(f"  Error parsing statistics: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
