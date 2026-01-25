#!/usr/bin/env python3
"""
Validate Mem0 data: check metadata completeness, entity types, categories, orphaned nodes, relationship consistency.
"""
import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Set

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent

sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

USER_ID = "orchestkit:all-agents"

# Valid entity types
VALID_ENTITY_TYPES = {"Agent", "Skill", "Technology", "Category", "Architecture", "Unknown"}

# Valid categories
VALID_CATEGORIES = {
    "agents", "backend-skills", "frontend-skills", "ai-llm-skills",
    "testing-skills", "security-skills", "devops-skills", "git-github-skills",
    "workflow-skills", "quality-skills", "context-skills", "event-driven-skills",
    "database-skills", "accessibility-skills", "mcp-skills",
    "technologies", "architecture-decisions", "relationships", "unknown"
}

# Required metadata fields
REQUIRED_FIELDS = ["entity_type", "color_group", "category", "plugin_component", "name"]


def validate_metadata_completeness(memory: Dict[str, Any]) -> List[str]:
    """Check if memory has all required metadata fields."""
    errors = []
    metadata = memory.get("metadata", {})
    
    for field in REQUIRED_FIELDS:
        if field not in metadata:
            errors.append(f"Missing required field: {field}")
    
    return errors


def validate_entity_type(memory: Dict[str, Any]) -> List[str]:
    """Validate entity_type value."""
    errors = []
    metadata = memory.get("metadata", {})
    entity_type = metadata.get("entity_type")
    
    if not entity_type:
        errors.append("Missing entity_type")
    elif entity_type not in VALID_ENTITY_TYPES:
        errors.append(f"Invalid entity_type: {entity_type} (valid: {VALID_ENTITY_TYPES})")
    
    return errors


def validate_category(memory: Dict[str, Any]) -> List[str]:
    """Validate category value."""
    errors = []
    metadata = memory.get("metadata", {})
    category = metadata.get("category")
    
    if not category:
        errors.append("Missing category")
    elif category not in VALID_CATEGORIES:
        errors.append(f"Invalid category: {category} (valid: {VALID_CATEGORIES})")
    
    return errors


def validate_color_group(memory: Dict[str, Any]) -> List[str]:
    """Validate color_group matches entity_type."""
    errors = []
    metadata = memory.get("metadata", {})
    entity_type = metadata.get("entity_type", "").lower()
    color_group = metadata.get("color_group", "")
    
    if not color_group:
        errors.append("Missing color_group")
    elif entity_type and color_group != entity_type:
        # Allow some flexibility (e.g., "Unknown" entity_type might have "skill" color_group)
        if entity_type != "unknown" and color_group not in ["agent", "skill", "technology", "category", "architecture", "unknown"]:
            errors.append(f"color_group '{color_group}' doesn't match entity_type '{entity_type}'")
    
    return errors


def find_orphaned_nodes(memories: List[Dict[str, Any]], relations: List[Dict[str, Any]]) -> Set[str]:
    """Find nodes that have no relationships."""
    memory_ids = {m.get("id") for m in memories if m.get("id")}
    
    # Extract all node IDs involved in relationships
    connected_ids = set()
    for rel in relations:
        source_id = rel.get("source_id") or rel.get("from_id")
        target_id = rel.get("target_id") or rel.get("to_id") or rel.get("memory_id")
        if source_id:
            connected_ids.add(source_id)
        if target_id:
            connected_ids.add(target_id)
    
    # Also check metadata-based relationships
    for memory in memories:
        metadata = memory.get("metadata", {})
        if "from" in metadata and "to" in metadata:
            memory_id = memory.get("id")
            if memory_id:
                connected_ids.add(memory_id)
    
    orphaned = memory_ids - connected_ids
    return orphaned


def validate_relationship_consistency(memories: List[Dict[str, Any]], relations: List[Dict[str, Any]]) -> List[str]:
    """Validate that relationships reference existing nodes."""
    errors = []
    memory_ids = {m.get("id") for m in memories if m.get("id")}
    
    for rel in relations:
        source_id = rel.get("source_id") or rel.get("from_id")
        target_id = rel.get("target_id") or rel.get("to_id") or rel.get("memory_id")
        
        if source_id and source_id not in memory_ids:
            errors.append(f"Relationship source_id '{source_id}' not found in memories")
        if target_id and target_id not in memory_ids:
            errors.append(f"Relationship target_id '{target_id}' not found in memories")
    
    return errors


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate Mem0 data structure")
    parser.add_argument("--user-id", default=USER_ID, help="Mem0 user ID")
    parser.add_argument("--limit", type=int, help="Limit number of memories to validate")
    parser.add_argument("--check-orphans", action="store_true", help="Check for orphaned nodes")
    args = parser.parse_args()
    
    try:
        client = get_mem0_client()
        
        print(f"Fetching memories for validation (user_id: {args.user_id})...")
        
        # Get all memories
        result = client.search(
            query="OrchestKit Plugin structure agent skill technology",
            filters={"user_id": args.user_id} if args.user_id else None,
            limit=args.limit or 1000,
            enable_graph=True
        )
        
        memories = result.get("results", [])
        relations = result.get("relations", [])
        
        print(f"Validating {len(memories)} memories and {len(relations)} relationships\n")
        
        # Validation results
        all_errors = []
        metadata_errors = 0
        entity_type_errors = 0
        category_errors = 0
        color_group_errors = 0
        
        for memory in memories:
            memory_id = memory.get("id", "unknown")
            
            # Check metadata completeness
            errors = validate_metadata_completeness(memory)
            if errors:
                metadata_errors += len(errors)
                all_errors.append(f"{memory_id[:8]}...: {', '.join(errors)}")
            
            # Check entity_type
            errors = validate_entity_type(memory)
            if errors:
                entity_type_errors += len(errors)
                all_errors.append(f"{memory_id[:8]}...: {', '.join(errors)}")
            
            # Check category
            errors = validate_category(memory)
            if errors:
                category_errors += len(errors)
                all_errors.append(f"{memory_id[:8]}...: {', '.join(errors)}")
            
            # Check color_group
            errors = validate_color_group(memory)
            if errors:
                color_group_errors += len(errors)
                all_errors.append(f"{memory_id[:8]}...: {', '.join(errors)}")
        
        # Check relationship consistency
        rel_errors = validate_relationship_consistency(memories, relations)
        all_errors.extend(rel_errors)
        
        # Check for orphaned nodes
        orphaned = set()
        if args.check_orphans:
            orphaned = find_orphaned_nodes(memories, relations)
        
        # Summary
        print("=== Validation Results ===")
        print(f"Memories validated: {len(memories)}")
        print(f"Relationships validated: {len(relations)}")
        print("")
        print("Issues found:")
        print(f"  Metadata completeness: {metadata_errors}")
        print(f"  Entity type: {entity_type_errors}")
        print(f"  Category: {category_errors}")
        print(f"  Color group: {color_group_errors}")
        print(f"  Relationship consistency: {len(rel_errors)}")
        if args.check_orphans:
            print(f"  Orphaned nodes: {len(orphaned)}")
        print("")
        
        if all_errors:
            print("Detailed errors:")
            for error in all_errors[:20]:  # Limit output
                print(f"  - {error}")
            if len(all_errors) > 20:
                print(f"  ... and {len(all_errors) - 20} more")
            print("")
        
        if orphaned:
            print(f"Orphaned nodes (no relationships): {len(orphaned)}")
            for node_id in list(orphaned)[:10]:
                print(f"  - {node_id[:8]}...")
            if len(orphaned) > 10:
                print(f"  ... and {len(orphaned) - 10} more")
            print("")
        
        # Final status
        total_errors = len(all_errors) + len(orphaned)
        if total_errors == 0:
            print("✓ All validations passed!")
            return 0
        else:
            print(f"✗ Found {total_errors} validation issue(s)")
            print("\nTo fix:")
            print("  1. Run: python3 skills/mem0-memory/scripts/update-memories-metadata.py")
            print("  2. Re-run validation after updates")
            return 1
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    sys.exit(main())
