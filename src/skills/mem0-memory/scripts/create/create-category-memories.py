#!/usr/bin/env python3
"""
Create memories for all custom categories in OrchestKit plugin.
Creates category entity memories that group related skills, agents, and technologies.
"""
import sys
from pathlib import Path

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent

sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

USER_ID = "orchestkit:all-agents"


# Category definitions (matching setup-categories.py)
CATEGORIES = [
    {
        "slug": "agents",
        "name": "Agents",
        "description": "Specialized AI agent personas including backend-system-architect, frontend-ui-developer, database-engineer, llm-integrator, security-auditor, and 30 more. These agents use specific skills to accomplish their tasks."
    },
    {
        "slug": "backend-skills",
        "name": "Backend Skills",
        "description": "Backend development patterns including FastAPI, async Python, SQLAlchemy, API design, REST, GraphQL, microservices, database operations, connection pooling, and backend architecture patterns."
    },
    {
        "slug": "frontend-skills",
        "name": "Frontend Skills",
        "description": "Frontend development patterns including React 19, TypeScript, UI components, TanStack Query, forms, performance optimization, accessibility, animations, lazy loading, and frontend architecture patterns."
    },
    {
        "slug": "ai-llm-skills",
        "name": "AI/LLM Skills",
        "description": "AI and LLM patterns including RAG, embeddings, LangGraph, agent orchestration, LLM safety, prompt engineering, function calling, streaming, semantic caching, and AI/ML integration patterns."
    },
    {
        "slug": "testing-skills",
        "name": "Testing Skills",
        "description": "Testing patterns including unit tests, integration tests, E2E tests, property-based testing, test coverage, mocking, test data management, and testing best practices."
    },
    {
        "slug": "security-skills",
        "name": "Security Skills",
        "description": "Security patterns including OWASP Top 10, authentication, authorization, input validation, defense-in-depth, LLM safety, MCP security, and security auditing patterns."
    },
    {
        "slug": "devops-skills",
        "name": "DevOps Skills",
        "description": "DevOps patterns for CI/CD, observability, GitHub operations, deployment, monitoring, and infrastructure as code."
    },
    {
        "slug": "git-github-skills",
        "name": "Git/GitHub Skills",
        "description": "Git workflow, GitHub operations, releases, recovery patterns, stacked PRs, and version control best practices."
    },
    {
        "slug": "workflow-skills",
        "name": "Workflow Skills",
        "description": "Workflow patterns for implementation, exploration, coordination, multi-agent workflows, and development processes."
    },
    {
        "slug": "quality-skills",
        "name": "Quality Skills",
        "description": "Quality gates, reviews, golden dataset management, code quality, and quality assurance patterns."
    },
    {
        "slug": "context-skills",
        "name": "Context Skills",
        "description": "Context compression, engineering, brainstorming, planning, memory management, and context optimization patterns."
    },
    {
        "slug": "event-driven-skills",
        "name": "Event-Driven Skills",
        "description": "Event sourcing, message queues, outbox patterns, CQRS, and event-driven architecture patterns."
    },
    {
        "slug": "database-skills",
        "name": "Database Skills",
        "description": "Database migrations, versioning, zero-downtime patterns, schema design, and database optimization patterns."
    },
    {
        "slug": "accessibility-skills",
        "name": "Accessibility Skills",
        "description": "WCAG compliance, focus management, React ARIA patterns, and accessibility best practices."
    },
    {
        "slug": "mcp-skills",
        "name": "MCP Skills",
        "description": "MCP advanced patterns, server building, tool composition, and Model Context Protocol integration."
    },
    {
        "slug": "technologies",
        "name": "Technologies",
        "description": "Core technologies and frameworks including FastAPI, React 19, LangGraph, PostgreSQL, pgvector, TypeScript, Python 3.11+, and Claude Code 2.1.11."
    },
    {
        "slug": "architecture-decisions",
        "name": "Architecture Decisions",
        "description": "Key architectural decisions including Graph-First Memory Architecture, Progressive Loading Protocol, CC 2.1.7 Flat Skill Structure, Hook-Based Lifecycle Automation, and Multi-Worktree Coordination."
    },
    {
        "slug": "relationships",
        "name": "Relationships",
        "description": "Relationships between agents, skills, and technologies including agent-skill mappings, skill-technology implementations, multi-hop chains, and cross-entity connections."
    }
]


def create_category_memory(client, category: Dict[str, Any]) -> bool:
    """Create a memory for a category."""
    slug = category["slug"]
    name = category["name"]
    description = category["description"]
    
    # Build memory text
    text = f"{name} category: {description} The {name} category groups related entities in the OrchestKit plugin structure."
    
    # Build metadata
    metadata = {
        "type": "category",
        "entity_type": "Category",
        "color_group": "category",
        "category": slug,
        "plugin_component": True,
        "name": name,
        "category_slug": slug,
        "shared": True  # Categories are shared knowledge across agents
    }
    
    try:
        result = client.add(
            messages=[{"role": "user", "content": text}],
            user_id=USER_ID,
            metadata=metadata,
            enable_graph=True
        )
        print(f"  ✓ Created: {name} ({slug})")
        return True
    except Exception as e:
        print(f"  ✗ Failed: {name}: {e}", file=sys.stderr)
        return False


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Create Mem0 memories for categories")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without making changes")
    parser.add_argument("--skip-existing", action="store_true", help="Skip categories that already have memories")
    args = parser.parse_args()
    
    try:
        client = get_mem0_client()
        
        print(f"Creating memories for {len(CATEGORIES)} categories\n")
        
        if args.dry_run:
            print("DRY RUN MODE - No changes will be made\n")
        
        # Check existing memories if skip-existing
        existing_categories = set()
        if args.skip_existing:
            print("Checking for existing category memories...")
            try:
                result = client.search(
                    query="category groups related",
                    filters={"user_id": USER_ID, "metadata.entity_type": "Category"},
                    limit=1000
                )
                for memory in result.get("results", []):
                    metadata = memory.get("metadata", {})
                    if "category_slug" in metadata:
                        existing_categories.add(metadata["category_slug"])
                    elif "category" in metadata:
                        existing_categories.add(metadata["category"])
                print(f"Found {len(existing_categories)} existing category memories\n")
            except Exception as e:
                print(f"Warning: Could not check existing memories: {e}\n")
        
        created_count = 0
        skipped_count = 0
        failed_count = 0
        
        for category in CATEGORIES:
            if args.skip_existing and category["slug"] in existing_categories:
                print(f"  ⊘ Skipped (exists): {category['name']}")
                skipped_count += 1
                continue
            
            if args.dry_run:
                print(f"  [DRY RUN] Would create: {category['name']} ({category['slug']})")
                created_count += 1
            else:
                if create_category_memory(client, category):
                    created_count += 1
                else:
                    failed_count += 1
        
        print(f"\n=== Summary ===")
        print(f"Created: {created_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Failed: {failed_count}")
        print(f"Total: {len(CATEGORIES)}")
        
        if args.dry_run:
            print("\nRun without --dry-run to create memories")
        else:
            print("\n✓ Category memories creation complete!")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
