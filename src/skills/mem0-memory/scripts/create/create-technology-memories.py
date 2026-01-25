#!/usr/bin/env python3
"""
Create comprehensive technology memories for OrchestKit plugin.
Creates memories for all key technologies used in the plugin.
"""
import sys
from pathlib import Path

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent

sys.path.insert(0, str(SCRIPT_DIR.parent / "lib"))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

USER_ID = "orchestkit:all-agents"


# Technology definitions with descriptions
TECHNOLOGIES = [
    {
        "name": "FastAPI",
        "description": "Modern, fast web framework for building APIs with Python 3.11+. Used extensively in OrchestKit plugin patterns for async Python backends.",
        "version": "0.115.0+",
        "category": "Backend Framework"
    },
    {
        "name": "React 19",
        "description": "Frontend framework with Server Components, concurrent features, and React Compiler. Core technology for frontend skills in OrchestKit.",
        "version": "19.0.0+",
        "category": "Frontend Framework"
    },
    {
        "name": "LangGraph",
        "description": "Agent orchestration framework for building multi-agent workflows. Used in AI/LLM skills for agent patterns and state management.",
        "version": "1.0.0+",
        "category": "AI/ML Framework"
    },
    {
        "name": "PostgreSQL",
        "description": "Advanced open-source relational database. Used with pgvector extension for hybrid search in RAG applications.",
        "version": "18.0+",
        "category": "Database"
    },
    {
        "name": "pgvector",
        "description": "PostgreSQL extension for vector similarity search. Enables hybrid BM25 + vector search with HNSW indexing.",
        "version": "0.7.0+",
        "category": "Database Extension"
    },
    {
        "name": "TypeScript",
        "description": "Typed superset of JavaScript. Used throughout frontend skills for type safety and better developer experience.",
        "version": "5.7+",
        "category": "Language"
    },
    {
        "name": "Python",
        "description": "Python programming language. OrchestKit requires Python 3.11+ for modern async features and type hints.",
        "version": "3.11+",
        "category": "Language"
    },
    {
        "name": "Claude Code",
        "description": "Claude Code IDE and plugin system. OrchestKit requires CC 2.1.11+ for Setup hooks, native parallel execution, and agent features.",
        "version": "2.1.11+",
        "category": "IDE/Platform"
    },
    {
        "name": "TanStack Query",
        "description": "Powerful data synchronization library for React. Used in frontend skills for server state management, caching, and optimistic updates.",
        "version": "5.0+",
        "category": "Frontend Library"
    },
    {
        "name": "Zustand",
        "description": "Lightweight state management library for React. Used in frontend skills for client-side state with minimal boilerplate.",
        "version": "5.0+",
        "category": "Frontend Library"
    },
    {
        "name": "Zod",
        "description": "TypeScript-first schema validation library. Used for runtime type checking and validation in frontend and API patterns.",
        "version": "3.23.0+",
        "category": "Validation Library"
    },
    {
        "name": "Pydantic",
        "description": "Data validation library for Python using type annotations. Used in FastAPI for request/response validation.",
        "version": "2.9+",
        "category": "Validation Library"
    },
    {
        "name": "Playwright",
        "description": "End-to-end testing framework for web applications. Used in E2E testing skills for browser automation.",
        "version": "1.57+",
        "category": "Testing Framework"
    },
    {
        "name": "pytest",
        "description": "Testing framework for Python. Used in backend testing skills with async support and fixtures.",
        "version": "8.0+",
        "category": "Testing Framework"
    },
    {
        "name": "MSW",
        "description": "Mock Service Worker for API mocking in tests. Used in frontend testing skills for deterministic API responses.",
        "version": "2.0+",
        "category": "Testing Library"
    },
    {
        "name": "Redis",
        "description": "In-memory data structure store. Used for caching, session storage, and distributed locking patterns.",
        "version": "7.0+",
        "category": "Cache/Store"
    },
    {
        "name": "Celery",
        "description": "Distributed task queue for Python. Used in background job skills for async task processing.",
        "version": "5.4+",
        "category": "Task Queue"
    },
    {
        "name": "RabbitMQ",
        "description": "Message broker for message queue patterns. Used in event-driven architecture skills.",
        "version": "3.13+",
        "category": "Message Broker"
    },
    {
        "name": "Docker",
        "description": "Containerization platform. Used in DevOps skills for containerizing applications and services.",
        "version": "Latest",
        "category": "Containerization"
    },
    {
        "name": "GitHub Actions",
        "description": "CI/CD platform integrated with GitHub. Used in DevOps skills for automated workflows and deployments.",
        "version": "Latest",
        "category": "CI/CD"
    },
    {
        "name": "SQLAlchemy",
        "description": "Python SQL toolkit and ORM. OrchestKit uses SQLAlchemy 2.0+ with async support for database operations.",
        "version": "2.0+",
        "category": "ORM"
    },
    {
        "name": "Alembic",
        "description": "Database migration tool for SQLAlchemy. Used in database skills for schema versioning and migrations.",
        "version": "1.13+",
        "category": "Migration Tool"
    },
    {
        "name": "Vite",
        "description": "Next-generation frontend build tool. Used in frontend skills for fast development and optimized production builds.",
        "version": "7.0+",
        "category": "Build Tool"
    },
    {
        "name": "Biome",
        "description": "Fast formatter and linter for JavaScript/TypeScript. Used in frontend skills as unified replacement for ESLint/Prettier.",
        "version": "2.0+",
        "category": "Linting Tool"
    }
]


def create_technology_memory(client, tech: Dict[str, Any]) -> bool:
    """Create a memory for a technology."""
    name = tech["name"]
    description = tech["description"]
    version = tech.get("version", "")
    category = tech.get("category", "Technology")
    
    # Build memory text
    text = f"{name} technology: {description}"
    if version:
        text += f" Version {version}."
    text += f" {name} is a core technology used in OrchestKit plugin patterns."
    
    # Build metadata
    metadata = {
        "type": "technology",
        "entity_type": "Technology",
        "color_group": "technology",
        "category": "technologies",
        "plugin_component": True,
        "name": name,
        "version": version,
        "tech_category": category,
        "shared": True  # Technologies are shared knowledge across agents
    }
    
    try:
        result = client.add(
            messages=[{"role": "user", "content": text}],
            user_id=USER_ID,
            metadata=metadata,
            enable_graph=True
        )
        print(f"  ✓ Created: {name} ({version})")
        return True
    except Exception as e:
        print(f"  ✗ Failed: {name}: {e}", file=sys.stderr)
        return False


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Create Mem0 memories for technologies")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without making changes")
    parser.add_argument("--skip-existing", action="store_true", help="Skip technologies that already have memories")
    args = parser.parse_args()
    
    try:
        client = get_mem0_client()
        
        print(f"Creating memories for {len(TECHNOLOGIES)} technologies\n")
        
        if args.dry_run:
            print("DRY RUN MODE - No changes will be made\n")
        
        # Check existing memories if skip-existing
        existing_techs = set()
        if args.skip_existing:
            print("Checking for existing technology memories...")
            try:
                result = client.search(
                    query="technology core technology",
                    filters={"user_id": USER_ID, "metadata.entity_type": "Technology"},
                    limit=1000
                )
                for memory in result.get("results", []):
                    metadata = memory.get("metadata", {})
                    if "name" in metadata:
                        existing_techs.add(metadata["name"])
                print(f"Found {len(existing_techs)} existing technology memories\n")
            except Exception as e:
                print(f"Warning: Could not check existing memories: {e}\n")
        
        created_count = 0
        skipped_count = 0
        failed_count = 0
        
        for tech in TECHNOLOGIES:
            if args.skip_existing and tech["name"] in existing_techs:
                print(f"  ⊘ Skipped (exists): {tech['name']}")
                skipped_count += 1
                continue
            
            if args.dry_run:
                print(f"  [DRY RUN] Would create: {tech['name']} ({tech.get('version', 'N/A')})")
                created_count += 1
            else:
                if create_technology_memory(client, tech):
                    created_count += 1
                else:
                    failed_count += 1
        
        print(f"\n=== Summary ===")
        print(f"Created: {created_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Failed: {failed_count}")
        print(f"Total: {len(TECHNOLOGIES)}")
        
        if args.dry_run:
            print("\nRun without --dry-run to create memories")
        else:
            print("\n✓ Technology memories creation complete!")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
