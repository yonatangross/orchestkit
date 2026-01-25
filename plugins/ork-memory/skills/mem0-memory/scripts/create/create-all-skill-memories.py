#!/usr/bin/env python3
"""
Create memories for all skills in the OrchestKit plugin.
Scans skills/ directory and creates Mem0 memories with proper metadata.
"""
import json
import re
import sys
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
SKILLS_DIR = PROJECT_ROOT / "skills"

sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

USER_ID = "orchestkit:all-agents"


def extract_frontmatter(content: str) -> Dict[str, Any]:
    """Extract YAML frontmatter from markdown."""
    frontmatter = {}
    
    if not content.startswith("---"):
        return frontmatter
    
    try:
        # Find frontmatter boundaries
        end_idx = content.find("---", 3)
        if end_idx == -1:
            return frontmatter
        
        yaml_content = content[3:end_idx].strip()
        frontmatter = yaml.safe_load(yaml_content) or {}
    except Exception as e:
        print(f"Warning: Failed to parse frontmatter: {e}")
    
    return frontmatter


def determine_category(skill_name: str, tags: List[str], content: str) -> str:
    """Determine skill category from name, tags, and content."""
    name_lower = skill_name.lower()
    tags_lower = [t.lower() for t in tags]
    content_lower = content.lower()
    
    # Category mapping based on patterns
    if any(tag in ["backend", "api", "fastapi", "sqlalchemy", "database", "async"] for tag in tags_lower):
        return "backend-skills"
    if any(tag in ["frontend", "react", "typescript", "ui", "component"] for tag in tags_lower):
        return "frontend-skills"
    if any(tag in ["ai", "llm", "rag", "langgraph", "embedding", "agent"] for tag in tags_lower):
        return "ai-llm-skills"
    if any(tag in ["test", "testing", "mock", "coverage"] for tag in tags_lower):
        return "testing-skills"
    if any(tag in ["security", "auth", "owasp", "validation"] for tag in tags_lower):
        return "security-skills"
    if any(tag in ["devops", "ci", "cd", "deployment"] for tag in tags_lower):
        return "devops-skills"
    if any(tag in ["git", "github", "release"] for tag in tags_lower):
        return "git-github-skills"
    if any(tag in ["workflow", "coordination", "implementation"] for tag in tags_lower):
        return "workflow-skills"
    if any(tag in ["quality", "review", "golden"] for tag in tags_lower):
        return "quality-skills"
    if any(tag in ["context", "memory", "compression"] for tag in tags_lower):
        return "context-skills"
    if any(tag in ["event", "queue", "cqrs", "saga"] for tag in tags_lower):
        return "event-driven-skills"
    if any(tag in ["database", "migration", "schema"] for tag in tags_lower):
        return "database-skills"
    if any(tag in ["accessibility", "a11y", "wcag"] for tag in tags_lower):
        return "accessibility-skills"
    if any(tag in ["mcp", "model-context"] for tag in tags_lower):
        return "mcp-skills"
    
    # Fallback to name patterns
    if "backend" in name_lower or "api" in name_lower or "fastapi" in name_lower:
        return "backend-skills"
    if "frontend" in name_lower or "react" in name_lower or "ui" in name_lower:
        return "frontend-skills"
    if "ai" in name_lower or "llm" in name_lower or "rag" in name_lower or "langgraph" in name_lower:
        return "ai-llm-skills"
    if "test" in name_lower:
        return "testing-skills"
    if "security" in name_lower or "auth" in name_lower:
        return "security-skills"
    
    return "unknown"


def determine_technology(skill_name: str, tags: List[str], content: str) -> Optional[str]:
    """Determine which technology a skill implements."""
    name_lower = skill_name.lower()
    tags_lower = [t.lower() for t in tags]
    content_lower = content.lower()
    
    # Technology mapping
    tech_patterns = {
        "FastAPI": ["fastapi", "fast-api"],
        "React 19": ["react", "react19", "react-19"],
        "LangGraph": ["langgraph", "lang-graph"],
        "PostgreSQL": ["postgresql", "postgres", "pgvector"],
        "TypeScript": ["typescript", "ts"],
        "Python": ["python", "py"],
        "TanStack Query": ["tanstack", "tanstack-query", "react-query"],
        "Zustand": ["zustand"],
        "Zod": ["zod"],
        "Pydantic": ["pydantic"],
        "Playwright": ["playwright"],
        "pytest": ["pytest"],
        "MSW": ["msw", "mock-service-worker"],
        "Redis": ["redis"],
        "Celery": ["celery"],
        "RabbitMQ": ["rabbitmq", "rabbit-mq"],
        "Docker": ["docker"],
        "GitHub Actions": ["github-actions", "github actions"]
    }
    
    # Check tags first
    for tech, patterns in tech_patterns.items():
        if any(pattern in tag for tag in tags_lower for pattern in patterns):
            return tech
    
    # Check skill name
    for tech, patterns in tech_patterns.items():
        if any(pattern in name_lower for pattern in patterns):
            return tech
    
    # Check content
    for tech, patterns in tech_patterns.items():
        if any(pattern in content_lower for pattern in patterns):
            return tech
    
    return None


def create_skill_memory(client, skill_dir: Path, skill_name: str) -> Optional[Dict[str, Any]]:
    """Create a memory for a single skill."""
    skill_md = skill_dir / "SKILL.md"
    
    if not skill_md.exists():
        print(f"  ⚠ SKILL.md not found for {skill_name}")
        return None
    
    content = skill_md.read_text()
    frontmatter = extract_frontmatter(content)
    
    # Extract skill info
    name = frontmatter.get("name", skill_name)
    description = frontmatter.get("description", "")
    tags = frontmatter.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    
    # Determine category and technology
    category = determine_category(skill_name, tags, content)
    technology = determine_technology(skill_name, tags, content)
    
    # Build memory text
    text_parts = [
        f"{name} skill: {description}",
        f"The {name} skill provides patterns and best practices for {skill_name.replace('-', ' ')}."
    ]
    
    if tags:
        text_parts.append(f"Tags: {', '.join(tags[:5])}")  # Limit tags
    
    if technology:
        text_parts.append(f"The {name} skill implements {technology} technology.")
    
    text_parts.append(f"The {name} skill belongs to {category} category.")
    
    memory_text = ". ".join(text_parts) + "."
    
    # Build metadata
    metadata = {
        "type": "skill",
        "entity_type": "Skill",
        "color_group": "skill",
        "category": category,
        "plugin_component": True,
        "name": name,
        "skill_name": skill_name,
        "shared": True,  # Skills are shared knowledge across agents
        "tags": tags[:10]  # Limit tags in metadata
    }
    
    if technology:
        metadata["implements"] = technology
        metadata["technology"] = technology
    
    if description:
        metadata["description"] = description[:200]  # Truncate long descriptions
    
    try:
        result = client.add(
            messages=[{"role": "user", "content": memory_text}],
            user_id=USER_ID,
            metadata=metadata,
            enable_graph=True
        )
        print(f"  ✓ Created: {name} ({category})")
        if technology:
            print(f"    → implements {technology}")
        return result
    except Exception as e:
        print(f"  ✗ Failed: {name}: {e}", file=sys.stderr)
        return None


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Create Mem0 memories for all skills")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without making changes")
    parser.add_argument("--limit", type=int, help="Limit number of skills to process")
    parser.add_argument("--skip-existing", action="store_true", help="Skip skills that already have memories")
    args = parser.parse_args()
    
    try:
        client = get_mem0_client()
        
        # Get all skill directories
        skill_dirs = [d for d in SKILLS_DIR.iterdir() if d.is_dir() and (d / "SKILL.md").exists()]
        skill_dirs.sort()
        
        if args.limit:
            skill_dirs = skill_dirs[:args.limit]
        
        print(f"Found {len(skill_dirs)} skills to process\n")
        
        if args.dry_run:
            print("DRY RUN MODE - No changes will be made\n")
        
        created_count = 0
        skipped_count = 0
        failed_count = 0
        
        # Check existing memories if skip-existing
        existing_skills = set()
        if args.skip_existing:
            print("Checking for existing skill memories...")
            try:
                result = client.search(
                    query="skill provides patterns",
                    filters={"user_id": USER_ID, "metadata.entity_type": "Skill"},
                    limit=1000
                )
                for memory in result.get("results", []):
                    metadata = memory.get("metadata", {})
                    if "skill_name" in metadata:
                        existing_skills.add(metadata["skill_name"])
                print(f"Found {len(existing_skills)} existing skill memories\n")
            except Exception as e:
                print(f"Warning: Could not check existing memories: {e}\n")
        
        for skill_dir in skill_dirs:
            skill_name = skill_dir.name
            
            if args.skip_existing and skill_name in existing_skills:
                print(f"  ⊘ Skipped (exists): {skill_name}")
                skipped_count += 1
                continue
            
            if args.dry_run:
                print(f"  [DRY RUN] Would create: {skill_name}")
                created_count += 1
            else:
                result = create_skill_memory(client, skill_dir, skill_name)
                if result:
                    created_count += 1
                else:
                    failed_count += 1
        
        print(f"\n=== Summary ===")
        print(f"Created: {created_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Failed: {failed_count}")
        print(f"Total: {len(skill_dirs)}")
        
        if args.dry_run:
            print("\nRun without --dry-run to create memories")
        else:
            print("\n✓ Skill memories creation complete!")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
