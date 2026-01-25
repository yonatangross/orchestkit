#!/usr/bin/env python3
"""
Create memories for all agents in the OrchestKit plugin.
Scans agents/ directory and creates Mem0 memories with skill relationships.
"""
import json
import re
import sys
import yaml
from pathlib import Path
from typing import Dict, Any, List

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
AGENTS_DIR = PROJECT_ROOT / "agents"

sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

USER_ID = "orchestkit:all-agents"


def extract_agent_skills(agent_file: Path) -> List[str]:
    """Extract skills list from agent markdown file."""
    content = agent_file.read_text()
    skills = []
    in_skills = False
    
    for line in content.split('\n'):
        if line.strip().startswith('skills:'):
            in_skills = True
            continue
        if in_skills:
            if line.strip().startswith('- '):
                skill = line.strip()[2:].strip()
                skills.append(skill)
            elif line.strip() and not line.startswith(' ') and not line.startswith('\t') and not line.startswith('#'):
                break
    
    return skills


def extract_frontmatter(content: str) -> Dict[str, Any]:
    """Extract YAML frontmatter from markdown."""
    frontmatter = {}
    
    if not content.startswith("---"):
        return frontmatter
    
    try:
        end_idx = content.find("---", 3)
        if end_idx == -1:
            return frontmatter
        
        yaml_content = content[3:end_idx].strip()
        frontmatter = yaml.safe_load(yaml_content) or {}
    except Exception as e:
        print(f"Warning: Failed to parse frontmatter: {e}")
    
    return frontmatter


def create_agent_memory(client, agent_file: Path, agent_name: str) -> Optional[Dict[str, Any]]:
    """Create a memory for a single agent."""
    content = agent_file.read_text()
    frontmatter = extract_frontmatter(content)
    
    # Extract agent info
    name = frontmatter.get("name", agent_name)
    description = frontmatter.get("description", "")
    skills = extract_agent_skills(agent_file)
    
    # Build memory text
    text_parts = [
        f"{name} agent: {description}",
        f"The {name} agent is a specialized AI persona in the OrchestKit plugin."
    ]
    
    if skills:
        text_parts.append(f"The {name} agent uses {len(skills)} skills: {', '.join(skills[:10])}.")
        if len(skills) > 10:
            text_parts.append(f"Additional skills include: {', '.join(skills[10:20])}.")
    
    memory_text = ". ".join(text_parts) + "."
    
    # Build metadata
    metadata = {
        "type": "agent",
        "entity_type": "Agent",
        "color_group": "agent",
        "category": "agents",
        "plugin_component": True,
        "name": name,
        "agent_name": agent_name,
        "agent_type": "specialist",  # Can be "specialist", "generalist", etc.
        "shared": False,  # Agent-specific memory, not shared
        "skills": skills[:30]  # Limit skills in metadata
    }
    
    if description:
        metadata["description"] = description[:300]  # Truncate long descriptions
    
    # Add model if specified
    if "model" in frontmatter:
        metadata["model"] = frontmatter["model"]
    
    try:
        result = client.add(
            messages=[{"role": "user", "content": memory_text}],
            user_id=USER_ID,
            metadata=metadata,
            enable_graph=True
        )
        print(f"  ✓ Created: {name} ({len(skills)} skills)")
        return result
    except Exception as e:
        print(f"  ✗ Failed: {name}: {e}", file=sys.stderr)
        return None


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Create Mem0 memories for all agents")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without making changes")
    parser.add_argument("--limit", type=int, help="Limit number of agents to process")
    parser.add_argument("--skip-existing", action="store_true", help="Skip agents that already have memories")
    args = parser.parse_args()
    
    try:
        client = get_mem0_client()
        
        # Get all agent files
        agent_files = list(AGENTS_DIR.glob("*.md"))
        agent_files.sort()
        
        if args.limit:
            agent_files = agent_files[:args.limit]
        
        print(f"Found {len(agent_files)} agents to process\n")
        
        if args.dry_run:
            print("DRY RUN MODE - No changes will be made\n")
        
        # Check existing memories if skip-existing
        existing_agents = set()
        if args.skip_existing:
            print("Checking for existing agent memories...")
            try:
                result = client.search(
                    query="agent specialized AI persona",
                    filters={"user_id": USER_ID, "metadata.entity_type": "Agent"},
                    limit=1000
                )
                for memory in result.get("results", []):
                    metadata = memory.get("metadata", {})
                    if "agent_name" in metadata:
                        existing_agents.add(metadata["agent_name"])
                    elif "name" in metadata:
                        existing_agents.add(metadata["name"])
                print(f"Found {len(existing_agents)} existing agent memories\n")
            except Exception as e:
                print(f"Warning: Could not check existing memories: {e}\n")
        
        created_count = 0
        skipped_count = 0
        failed_count = 0
        
        for agent_file in agent_files:
            agent_name = agent_file.stem  # filename without .md
            
            if args.skip_existing and agent_name in existing_agents:
                print(f"  ⊘ Skipped (exists): {agent_name}")
                skipped_count += 1
                continue
            
            if args.dry_run:
                skills = extract_agent_skills(agent_file)
                print(f"  [DRY RUN] Would create: {agent_name} ({len(skills)} skills)")
                created_count += 1
            else:
                result = create_agent_memory(client, agent_file, agent_name)
                if result:
                    created_count += 1
                else:
                    failed_count += 1
        
        print(f"\n=== Summary ===")
        print(f"Created: {created_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Failed: {failed_count}")
        print(f"Total: {len(agent_files)}")
        
        if args.dry_run:
            print("\nRun without --dry-run to create memories")
        else:
            print("\n✓ Agent memories creation complete!")
            print("Note: Agent-skill relationships will be created separately")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
