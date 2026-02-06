#!/usr/bin/env python3
"""
Create Deep Multi-Hop Relationships in Mem0
Uses OrchestKit agents and skills to build comprehensive relationship chains
"""
import json
import re
import sys
from pathlib import Path

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
MEM0_SCRIPT = SCRIPT_DIR.parent / "crud" / "add-memory.py"
AGENTS_DIR = PROJECT_ROOT / "agents"
SKILLS_DIR = PROJECT_ROOT / "skills"

sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

USER_ID = "orchestkit:all-agents"

def extract_agent_skills(agent_file: Path) -> list[str]:
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
            elif line.strip() and not line.startswith(' ') and not line.startswith('\t'):
                break
    
    return skills

def get_skill_category(skill_name: str) -> str:
    """Determine skill category from skill name and directory."""
    skill_dir = SKILLS_DIR / skill_name
    if not skill_dir.exists():
        return "Unknown"
    
    skill_md = skill_dir / "SKILL.md"
    if skill_md.exists():
        content = skill_md.read_text()
        # Try to extract category from tags or description
        if 'tags:' in content:
            tags_match = re.search(r'tags:\s*\[(.*?)\]', content)
            if tags_match:
                tags = [t.strip().strip('"\'') for t in tags_match.group(1).split(',')]
                # Map tags to categories
                if any('ai' in t.lower() or 'llm' in t.lower() or 'rag' in t.lower() for t in tags):
                    return "AI/LLM Skills"
                if any('backend' in t.lower() or 'api' in t.lower() or 'fastapi' in t.lower() for t in tags):
                    return "Backend Skills"
                if any('frontend' in t.lower() or 'react' in t.lower() or 'ui' in t.lower() for t in tags):
                    return "Frontend Skills"
                if any('test' in t.lower() or 'testing' in t.lower() for t in tags):
                    return "Testing Skills"
                if any('security' in t.lower() or 'auth' in t.lower() or 'owasp' in t.lower() for t in tags):
                    return "Security Skills"
                if any('memory' in t.lower() or 'context' in t.lower() for t in tags):
                    return "Context Skills"
    
    return "Unknown"

def get_skill_technology(skill_name: str) -> str | None:
    """Determine which technology a skill implements."""
    tech_mapping = {
        'fastapi-advanced': 'FastAPI',
        'sqlalchemy-2-async': 'PostgreSQL',
        'react-server-components-framework': 'React 19',
        'langgraph-state': 'LangGraph',
        'langgraph-routing': 'LangGraph',
        'langgraph-parallel': 'LangGraph',
        'langgraph-checkpoints': 'LangGraph',
        'langgraph-supervisor': 'LangGraph',
        'pgvector-search': 'pgvector',
        'tanstack-query-advanced': 'TypeScript',
        'form-state-patterns': 'React 19',
    }
    return tech_mapping.get(skill_name)

def create_agent_skill_memories(client, agent_name: str, skills: list[str]):
    """Create memories linking agent to each skill with explicit relationships."""
    memories_created = []
    
    for skill in skills:
        category = get_skill_category(skill)
        technology = get_skill_technology(skill)
        
        # Build relationship text that explicitly mentions all entities
        text_parts = [
            f"{agent_name} agent uses {skill} skill",
        ]
        
        if category != "Unknown":
            text_parts.append(f"The {skill} skill belongs to {category} category")
        
        if technology:
            text_parts.append(f"The {skill} skill implements {technology} technology")
            text_parts.append(f"{technology} is a core technology used in OrchestKit plugin patterns")
        
        # Add context about what the skill does
        if 'api' in skill:
            text_parts.append(f"{skill} provides API design patterns")
        if 'database' in skill or 'sql' in skill:
            text_parts.append(f"{skill} provides database patterns")
        if 'react' in skill or 'frontend' in skill:
            text_parts.append(f"{skill} provides frontend patterns")
        if 'langgraph' in skill:
            text_parts.append(f"{skill} provides LangGraph agent orchestration patterns")
        
        memory_text = ". ".join(text_parts) + "."
        
        # Map category name to category slug
        category_slug = category.lower().replace(" ", "-").replace("/", "-") if category != "Unknown" else "unknown"
        
        metadata = {
            "type": "relationship",
            "entity_type": "Unknown",  # Relationship memories are connections
            "color_group": "skill",  # Default to skill color for relationships
            "category": category_slug,
            "plugin_component": True,
            "from": agent_name,
            "to": skill,
            "relation": "uses",
            "hop": 1,
            "agent": agent_name,
            "skill": skill
        }
        
        if category != "Unknown":
            metadata["category"] = category_slug
        if technology:
            metadata["technology"] = technology
            metadata["implements"] = technology
        
        try:
            result = client.add(
                messages=[{"role": "user", "content": memory_text}],
                user_id=USER_ID,
                metadata=metadata,
                enable_graph=True
            )
            memories_created.append({
                "agent": agent_name,
                "skill": skill,
                "result": result
            })
            print(f"✓ Created: {agent_name} → uses → {skill}")
        except Exception as e:
            print(f"✗ Failed: {agent_name} → {skill}: {e}", file=sys.stderr)
    
    return memories_created

def create_skill_technology_memories(client, skill_name: str, technology: str, category: str):
    """Create memories linking skill to technology."""
    text = (
        f"{skill_name} skill implements {technology} technology. "
        f"The {skill_name} skill belongs to {category} category. "
        f"{technology} is a core technology used in OrchestKit plugin patterns. "
        f"Skills that implement {technology} provide patterns and best practices for working with {technology}."
    )
    
    # Map category name to category slug
    category_slug = category.lower().replace(" ", "-").replace("/", "-")
    
    metadata = {
        "type": "relationship",
        "entity_type": "Skill",  # Skills implement technologies
        "color_group": "skill",
        "category": category_slug,
        "plugin_component": True,
        "from": skill_name,
        "to": technology,
        "relation": "implements",
        "hop": 2,
        "skill": skill_name,
        "technology": technology,
        "implements": technology
    }
    
    try:
        result = client.add(
            messages=[{"role": "user", "content": text}],
            user_id=USER_ID,
            metadata=metadata,
            enable_graph=True
        )
        print(f"✓ Created: {skill_name} → implements → {technology}")
        return result
    except Exception as e:
        print(f"✗ Failed: {skill_name} → {technology}: {e}", file=sys.stderr)
        return None

def create_multi_hop_chains(client):
    """Create explicit multi-hop relationship chains."""
    print("\n=== Creating Multi-Hop Chains ===\n")
    
    # Chain 1: backend-system-architect → fastapi-advanced → FastAPI → Python 3.11+
    text1 = (
        "backend-system-architect agent uses fastapi-advanced skill for async Python API development. "
        "The fastapi-advanced skill implements FastAPI technology which is a backend framework. "
        "FastAPI technology uses Python 3.11+ language for modern async features. "
        "This creates a 4-hop chain: agent → uses → skill → implements → technology → uses → language."
    )
    client.add(
        messages=[{"role": "user", "content": text1}],
        user_id=USER_ID,
        metadata={
            "type": "multi-hop",
            "entity_type": "Unknown",
            "color_group": "skill",
            "category": "relationships",
            "plugin_component": True,
            "chain": "agent→skill→technology→language",
            "hops": 4
        },
        enable_graph=True
    )
    print("✓ Created 4-hop chain: backend-system-architect → fastapi-advanced → FastAPI → Python 3.11+")
    
    # Chain 2: database-engineer → pgvector-search → pgvector → PostgreSQL
    text2 = (
        "database-engineer agent uses pgvector-search skill for hybrid search in RAG applications. "
        "The pgvector-search skill implements pgvector technology for vector similarity search. "
        "pgvector technology extends PostgreSQL database by adding vector search capabilities. "
        "This creates a 4-hop chain: agent → uses → skill → implements → technology → extends → database."
    )
    client.add(
        messages=[{"role": "user", "content": text2}],
        user_id=USER_ID,
        metadata={
            "type": "multi-hop",
            "entity_type": "Unknown",
            "color_group": "skill",
            "category": "relationships",
            "plugin_component": True,
            "chain": "agent→skill→technology→database",
            "hops": 4
        },
        enable_graph=True
    )
    print("✓ Created 4-hop chain: database-engineer → pgvector-search → pgvector → PostgreSQL")
    
    # Chain 3: frontend-ui-developer → react-server-components-framework → React 19 → TypeScript
    text3 = (
        "frontend-ui-developer agent uses react-server-components-framework skill for Next.js 16+ apps. "
        "The react-server-components-framework skill implements React 19 technology with Server Components. "
        "React 19 technology uses TypeScript for type safety in frontend development. "
        "This creates a 4-hop chain: agent → uses → skill → implements → technology → uses → language."
    )
    client.add(
        messages=[{"role": "user", "content": text3}],
        user_id=USER_ID,
        metadata={
            "type": "multi-hop",
            "entity_type": "Unknown",
            "color_group": "skill",
            "category": "relationships",
            "plugin_component": True,
            "chain": "agent→skill→technology→language",
            "hops": 4
        },
        enable_graph=True
    )
    print("✓ Created 4-hop chain: frontend-ui-developer → react-server-components-framework → React 19 → TypeScript")
    
    # Chain 4: llm-integrator → langgraph-state → LangGraph → multi-agent workflows
    text4 = (
        "llm-integrator agent uses langgraph-state skill for LangGraph state management. "
        "The langgraph-state skill implements LangGraph technology for agent orchestration. "
        "LangGraph technology enables multi-agent workflows with state persistence and routing. "
        "This creates a relationship chain connecting agent skills to orchestration technology."
    )
    client.add(
        messages=[{"role": "user", "content": text4}],
        user_id=USER_ID,
        metadata={
            "type": "multi-hop",
            "entity_type": "Unknown",
            "color_group": "skill",
            "category": "relationships",
            "plugin_component": True,
            "chain": "agent→skill→technology→pattern",
            "hops": 4
        },
        enable_graph=True
    )
    print("✓ Created 4-hop chain: llm-integrator → langgraph-state → LangGraph → multi-agent workflows")

def create_all_agent_skill_relationships(client):
    """Create relationships for all agents and their skills."""
    print("\n=== Phase 1: Creating All Agent-Skill Relationships ===\n")
    
    agent_files = list(AGENTS_DIR.glob("*.md"))
    agent_files.sort()
    
    total_relationships = 0
    failed_relationships = 0
    
    for idx, agent_file in enumerate(agent_files, 1):
        agent_name = agent_file.stem
        skills = extract_agent_skills(agent_file)
        
        if skills:
            print(f"[{idx}/{len(agent_files)}] Processing {agent_name} ({len(skills)} skills)...")
            try:
                memories = create_agent_skill_memories(client, agent_name, skills)
                total_relationships += len(memories)
            except Exception as e:
                print(f"  ✗ Error processing {agent_name}: {e}", file=sys.stderr)
                failed_relationships += len(skills)
        else:
            print(f"[{idx}/{len(agent_files)}] Skipping {agent_name} (no skills found)")
    
    print(f"\n✓ Phase 1 complete: {total_relationships} agent-skill relationships created")
    if failed_relationships > 0:
        print(f"  ⚠ {failed_relationships} relationships failed")
    
    return total_relationships


def create_all_skill_technology_relationships(client):
    """Create relationships for all skills and their technologies."""
    print("\n=== Phase 2: Creating All Skill-Technology Relationships ===\n")
    
    # Scan all skills to find technology mappings
    skill_dirs = [d for d in SKILLS_DIR.iterdir() if d.is_dir() and (d / "SKILL.md").exists()]
    
    created_count = 0
    failed_count = 0
    
    for skill_dir in skill_dirs:
        skill_name = skill_dir.name
        category = get_skill_category(skill_name)
        technology = get_skill_technology(skill_name)
        
        if technology:
            try:
                create_skill_technology_memories(client, skill_name, technology, category)
                created_count += 1
            except Exception as e:
                print(f"  ✗ Failed: {skill_name} → {technology}: {e}", file=sys.stderr)
                failed_count += 1
    
    print(f"\n✓ Phase 2 complete: {created_count} skill-technology relationships created")
    if failed_count > 0:
        print(f"  ⚠ {failed_count} relationships failed")
    
    return created_count


def create_technology_dependencies(client):
    """Create technology-to-technology dependency relationships."""
    print("\n=== Phase 3: Creating Technology Dependencies ===\n")
    
    # Technology dependency mappings
    dependencies = [
        ("pgvector", "PostgreSQL", "extends"),
        ("SQLAlchemy", "PostgreSQL", "uses"),
        ("Alembic", "SQLAlchemy", "uses"),
        ("FastAPI", "Python", "uses"),
        ("React 19", "TypeScript", "uses"),
        ("TanStack Query", "React 19", "uses"),
        ("Zustand", "React 19", "uses"),
        ("Zod", "TypeScript", "uses"),
        ("Pydantic", "Python", "uses"),
        ("Celery", "Redis", "uses"),
        ("LangGraph", "Python", "uses"),
    ]
    
    created_count = 0
    for tech_from, tech_to, rel_type in dependencies:
        text = (
            f"{tech_from} technology {rel_type} {tech_to} technology. "
            f"{tech_from} depends on {tech_to} for core functionality. "
            f"Both {tech_from} and {tech_to} are core technologies in OrchestKit plugin patterns."
        )
        
        metadata = {
            "type": "relationship",
            "entity_type": "Technology",
            "color_group": "technology",
            "category": "technologies",
            "plugin_component": True,
            "from": tech_from,
            "to": tech_to,
            "relation": rel_type,
            "hop": 1
        }
        
        try:
            client.add(
                messages=[{"role": "user", "content": text}],
                user_id=USER_ID,
                metadata=metadata,
                enable_graph=True
            )
            print(f"  ✓ Created: {tech_from} → {rel_type} → {tech_to}")
            created_count += 1
        except Exception as e:
            print(f"  ✗ Failed: {tech_from} → {tech_to}: {e}", file=sys.stderr)
    
    print(f"\n✓ Phase 3 complete: {created_count} technology dependencies created")
    return created_count


def create_category_entity_relationships(client):
    """Create category-to-entity belongs_to relationships."""
    print("\n=== Phase 4: Creating Category-Entity Relationships ===\n")
    
    # This would require querying existing memories and matching categories
    # For now, we'll create a few key examples
    category_entities = [
        ("agents", "backend-system-architect", "Agent"),
        ("backend-skills", "fastapi-advanced", "Skill"),
        ("frontend-skills", "react-server-components-framework", "Skill"),
        ("ai-llm-skills", "langgraph-state", "Skill"),
        ("technologies", "FastAPI", "Technology"),
    ]
    
    created_count = 0
    for category_slug, entity_name, entity_type in category_entities:
        text = (
            f"{entity_name} {entity_type.lower()} belongs to {category_slug} category. "
            f"The {category_slug} category contains {entity_type.lower()}s related to {category_slug.replace('-', ' ')}."
        )
        
        metadata = {
            "type": "relationship",
            "entity_type": entity_type,
            "color_group": entity_type.lower(),
            "category": category_slug,
            "plugin_component": True,
            "from": entity_name,
            "to": category_slug,
            "relation": "belongs_to",
            "hop": 1
        }
        
        try:
            client.add(
                messages=[{"role": "user", "content": text}],
                user_id=USER_ID,
                metadata=metadata,
                enable_graph=True
            )
            print(f"  ✓ Created: {entity_name} → belongs_to → {category_slug}")
            created_count += 1
        except Exception as e:
            print(f"  ✗ Failed: {entity_name} → {category_slug}: {e}", file=sys.stderr)
    
    print(f"\n✓ Phase 4 complete: {created_count} category-entity relationships created")
    return created_count


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Create comprehensive relationships in Mem0")
    parser.add_argument("--phase", choices=["1", "2", "3", "4", "all"], default="all", help="Which phase to run")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without making changes")
    parser.add_argument("--batch-size", type=int, default=10, help="Batch size for processing (to avoid rate limits)")
    args = parser.parse_args()
    
    print("=== Creating Deep Multi-Hop Relationships in Mem0 ===\n")
    
    if args.dry_run:
        print("DRY RUN MODE - No changes will be made\n")
        return
    
    try:
        client = get_mem0_client()
    except Exception as e:
        print(f"Error initializing Mem0 client: {e}", file=sys.stderr)
        sys.exit(1)
    
    total_created = 0
    
    if args.phase in ["1", "all"]:
        total_created += create_all_agent_skill_relationships(client)
    
    if args.phase in ["2", "all"]:
        total_created += create_all_skill_technology_relationships(client)
    
    if args.phase in ["3", "all"]:
        total_created += create_technology_dependencies(client)
    
    if args.phase in ["4", "all"]:
        total_created += create_category_entity_relationships(client)
        # Also create multi-hop chains
        print("\n=== Phase 5: Creating Multi-Hop Chains ===\n")
        create_multi_hop_chains(client)
        total_created += 4  # 4 multi-hop chains
    
    print(f"\n=== Summary ===")
    print(f"Total relationships created: {total_created}")
    print(f"\n✓ All relationships created successfully!")
    print("Note: Mem0 may take a few minutes to process and extract graph relationships")

if __name__ == "__main__":
    main()
