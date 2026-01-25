#!/usr/bin/env python3
"""
Update existing Mem0 memories with enhanced metadata (entity_type, color_group, category).
This script adds metadata fields to existing memories for better visualization and filtering.
"""
import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
MEM0_LIB_DIR = SCRIPT_DIR.parent / "lib"
if str(MEM0_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(MEM0_LIB_DIR))

from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

USER_ID = "orchestkit:all-agents"


def extract_entity_type_from_memory(memory: Dict[str, Any]) -> tuple[str, str, str]:
    """Extract entity_type, color_group, and category from memory content and existing metadata."""
    metadata = memory.get("metadata", {})
    content = memory.get("memory", "").lower()
    
    # Check existing metadata first
    if "entity_type" in metadata:
        entity_type = metadata["entity_type"]
    elif "type" in metadata:
        type_val = metadata["type"]
        if type_val == "agent":
            entity_type = "Agent"
        elif type_val == "skill":
            entity_type = "Skill"
        elif type_val == "technology":
            entity_type = "Technology"
        elif type_val == "category":
            entity_type = "Category"
        elif type_val in ["architecture", "architecture-decision"]:
            entity_type = "Architecture"
        else:
            entity_type = type_val.capitalize()
    else:
        # Infer from content
        if "agent" in content and ("uses" in content or "specialized" in content):
            entity_type = "Agent"
        elif "skill" in content and ("pattern" in content or "provides" in content):
            entity_type = "Skill"
        elif "technology" in content or "framework" in content:
            entity_type = "Technology"
        elif "category" in content or "contains" in content:
            entity_type = "Category"
        elif "architecture" in content or "decision" in content:
            entity_type = "Architecture"
        else:
            entity_type = "Unknown"
    
    # Determine color_group
    color_group_map = {
        "Agent": "agent",
        "Skill": "skill",
        "Technology": "technology",
        "Category": "category",
        "Architecture": "architecture"
    }
    color_group = color_group_map.get(entity_type, "unknown")
    
    # Determine category from metadata or content
    if "category" in metadata:
        category = metadata["category"]
    elif "name" in metadata:
        name = metadata["name"].lower()
        # Map names to categories
        if "backend" in name or "fastapi" in name or "api" in name:
            category = "backend-skills"
        elif "frontend" in name or "react" in name:
            category = "frontend-skills"
        elif "ai" in name or "llm" in name or "rag" in name or "langgraph" in name:
            category = "ai-llm-skills"
        elif "test" in name:
            category = "testing-skills"
        elif "security" in name or "auth" in name or "owasp" in name:
            category = "security-skills"
        elif "memory" in name or "context" in name:
            category = "context-skills"
        elif entity_type == "Agent":
            category = "agents"
        elif entity_type == "Technology":
            category = "technologies"
        elif entity_type == "Architecture":
            category = "architecture-decisions"
        else:
            category = "unknown"
    else:
        category = "unknown"
    
    return entity_type, color_group, category


def update_memory_metadata(client, memory_id: str, memory: Dict[str, Any], dry_run: bool = False) -> bool:
    """Update a single memory with enhanced metadata."""
    entity_type, color_group, category = extract_entity_type_from_memory(memory)
    
    existing_metadata = memory.get("metadata", {}).copy()
    
    # Only update if missing or different
    needs_update = False
    new_metadata = existing_metadata.copy()
    
    if existing_metadata.get("entity_type") != entity_type:
        new_metadata["entity_type"] = entity_type
        needs_update = True
    
    if existing_metadata.get("color_group") != color_group:
        new_metadata["color_group"] = color_group
        needs_update = True
    
    if existing_metadata.get("category") != category:
        new_metadata["category"] = category
        needs_update = True
    
    if not existing_metadata.get("plugin_component"):
        new_metadata["plugin_component"] = True
        needs_update = True
    
    if not needs_update:
        return False
    
    if dry_run:
        print(f"  [DRY RUN] Would update {memory_id[:8]}...: entity_type={entity_type}, color_group={color_group}, category={category}")
        return True
    
    try:
        # Update memory with new metadata
        client.update(
            memory_id=memory_id,
            text=memory.get("memory"),  # Keep existing text
            metadata=new_metadata
        )
        print(f"  ✓ Updated {memory_id[:8]}...: {entity_type} ({category})")
        return True
    except Exception as e:
        print(f"  ✗ Failed to update {memory_id[:8]}...: {e}", file=sys.stderr)
        return False


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Update existing Mem0 memories with enhanced metadata")
    parser.add_argument("--user-id", default=USER_ID, help="Mem0 user ID")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated without making changes")
    parser.add_argument("--limit", type=int, help="Limit number of memories to update")
    args = parser.parse_args()
    
    try:
        client = get_mem0_client()
        
        print(f"Fetching memories for user_id: {args.user_id}")
        
        # Get all memories (use broad query since empty query not allowed)
        result = client.search(
            query="OrchestKit Plugin structure agent skill technology",
            filters={"user_id": args.user_id} if args.user_id else None,
            limit=args.limit or 1000,
            enable_graph=True
        )
        
        memories = result.get("results", [])
        print(f"Found {len(memories)} memories to process\n")
        
        if args.dry_run:
            print("DRY RUN MODE - No changes will be made\n")
        
        updated_count = 0
        skipped_count = 0
        
        for memory in memories:
            memory_id = memory.get("id")
            if not memory_id:
                continue
            
            if update_memory_metadata(client, memory_id, memory, dry_run=args.dry_run):
                updated_count += 1
            else:
                skipped_count += 1
        
        print(f"\n=== Summary ===")
        print(f"Updated: {updated_count}")
        print(f"Skipped (already up-to-date): {skipped_count}")
        print(f"Total: {len(memories)}")
        
        if args.dry_run:
            print("\nRun without --dry-run to apply updates")
        else:
            print("\n✓ Metadata updates complete!")
            print("Note: Mem0 may take a few minutes to re-categorize memories")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
