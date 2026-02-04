#!/usr/bin/env python3
"""
Setup custom Mem0 categories for OrchestKit plugin structure.
Defines project-level categories that Mem0 will use for auto-categorization.
"""
import json
import sys
from pathlib import Path

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
MEM0_LIB_DIR = SCRIPT_DIR.parent / "lib"
if str(MEM0_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(MEM0_LIB_DIR))

from mem0_client import get_mem0_client  # type: ignore  # noqa: E402


def setup_custom_categories():
    """Define and set custom categories for OrchestKit plugin structure."""
    
    custom_categories = [
        {
            "agents": "Specialized AI agent personas including backend-system-architect, frontend-ui-developer, database-engineer, llm-integrator, security-auditor, and 30 more. These agents use specific skills to accomplish their tasks."
        },
        {
            "backend-skills": "Backend development patterns including FastAPI, async Python, SQLAlchemy, API design, REST, GraphQL, microservices, database operations, connection pooling, and backend architecture patterns."
        },
        {
            "frontend-skills": "Frontend development patterns including React 19, TypeScript, UI components, TanStack Query, forms, performance optimization, accessibility, animations, lazy loading, and frontend architecture patterns."
        },
        {
            "ai-llm-skills": "AI and LLM patterns including RAG, embeddings, LangGraph, agent orchestration, LLM safety, prompt engineering, function calling, streaming, semantic caching, and AI/ML integration patterns."
        },
        {
            "testing-skills": "Testing patterns including unit tests, integration tests, E2E tests, property-based testing, test coverage, mocking, test data management, and testing best practices."
        },
        {
            "security-skills": "Security patterns including OWASP Top 10, authentication, authorization, input validation, defense-in-depth, LLM safety, MCP security, and security auditing patterns."
        },
        {
            "devops-skills": "DevOps patterns for CI/CD, observability, GitHub operations, deployment, monitoring, and infrastructure as code."
        },
        {
            "git-github-skills": "Git workflow, GitHub operations, releases, recovery patterns, stacked PRs, and version control best practices."
        },
        {
            "workflow-skills": "Workflow patterns for implementation, exploration, coordination, multi-agent workflows, and development processes."
        },
        {
            "quality-skills": "Quality gates, reviews, golden dataset management, code quality, and quality assurance patterns."
        },
        {
            "context-skills": "Context compression, engineering, brainstorming, planning, memory management, and context optimization patterns."
        },
        {
            "event-driven-skills": "Event sourcing, message queues, outbox patterns, CQRS, and event-driven architecture patterns."
        },
        {
            "database-skills": "Database migrations, versioning, zero-downtime patterns, schema design, and database optimization patterns."
        },
        {
            "accessibility-skills": "WCAG compliance, focus management, React ARIA patterns, and accessibility best practices."
        },
        {
            "mcp-skills": "MCP advanced patterns, server building, tool composition, and Model Context Protocol integration."
        },
        {
            "technologies": "Core technologies and frameworks including FastAPI, React 19, LangGraph, PostgreSQL, pgvector, TypeScript, Python 3.11+, and Claude Code 2.1.11."
        },
        {
            "architecture-decisions": "Key architectural decisions including Graph-First Memory Architecture, Progressive Loading Protocol, CC 2.1.7 Flat Skill Structure, Hook-Based Lifecycle Automation, and Multi-Worktree Coordination."
        },
        {
            "relationships": "Relationships between agents, skills, and technologies including agent-skill mappings, skill-technology implementations, multi-hop chains, and cross-entity connections."
        }
    ]
    
    try:
        client = get_mem0_client()
        
        # Check if project.update method exists
        if hasattr(client, 'project') and hasattr(client.project, 'update'):
            print("Setting up custom Mem0 categories...")
            print(f"Defining {len(custom_categories)} categories")
            
            result = client.project.update(custom_categories=custom_categories)
            
            print("\n✓ Custom categories set successfully!")
            print("\nCategories defined:")
            for cat in custom_categories:
                for name, desc in cat.items():
                    print(f"  - {name}: {desc[:60]}...")
            
            # Verify categories were set
            try:
                project_info = client.project.get(fields=["custom_categories"])
                if "custom_categories" in project_info:
                    print(f"\n✓ Verified: {len(project_info['custom_categories'])} categories active")
            except Exception as e:
                print(f"\n⚠ Could not verify categories: {e}")
                print("Categories should still be set - Mem0 will use them for future memories")
            
            return True
        else:
            print("Error: client.project.update() method not available")
            print("This may require a newer version of mem0ai or Pro/Enterprise plan")
            print("\nYou can still use metadata for categorization:")
            print("  - Add 'entity_type' and 'category' to metadata when creating memories")
            print("  - Use metadata filters for searching")
            return False
            
    except Exception as e:
        print(f"Error setting up categories: {e}", file=sys.stderr)
        print("\nNote: Custom categories may require Mem0 Pro/Enterprise plan")
        print("You can still use metadata fields for organization:")
        print("  - Add 'entity_type', 'category', 'color_group' to metadata")
        return False


if __name__ == "__main__":
    success = setup_custom_categories()
    if not success:
        print("\n⚠ Category setup incomplete, but metadata-based organization will still work")
    sys.exit(0 if success else 1)
