#!/usr/bin/env python3
"""
Shared mem0 client initialization for skill scripts.
Extracted from bin/mem0-migrate.py pattern.
"""
import os
from pathlib import Path
from mem0 import MemoryClient

# Try to load .env file if it exists (optional dependency)
try:
    from dotenv import load_dotenv
    # Load .env from project root (where .claude/ or plugin is)
    # Try multiple common locations
    env_paths = [
        Path.cwd() / ".env",
        Path(__file__).parent.parent.parent.parent / ".env",  # From scripts/lib/ to project root
        Path.home() / ".mem0.env",  # User-level config
    ]
    for env_path in env_paths:
        if env_path.exists():
            load_dotenv(env_path, override=True)  # override=True ensures .env values take precedence
            break
except ImportError:
    # python-dotenv not installed, skip .env loading
    pass


def get_mem0_client(api_key: str | None = None, org_id: str | None = None, project_id: str | None = None) -> MemoryClient:
    """
    Initialize mem0 client from environment variables or arguments.
    
    Args:
        api_key: Mem0 API key (or use MEM0_API_KEY env var)
        org_id: Organization ID (or use MEM0_ORG_ID env var)
        project_id: Project ID (or use MEM0_PROJECT_ID env var)
    
    Returns:
        MemoryClient instance
    
    Raises:
        ValueError: If API key is not provided
        ImportError: If mem0ai package is not installed
    """
    # Get API key from arg or env
    api_key = api_key or os.getenv("MEM0_API_KEY")
    if not api_key:
        raise ValueError("MEM0_API_KEY environment variable or --api-key argument required")
    
    # Get optional org/project IDs
    org_id = org_id or os.getenv("MEM0_ORG_ID")
    project_id = project_id or os.getenv("MEM0_PROJECT_ID")
    
    try:
        return MemoryClient(
            api_key=api_key,
            org_id=org_id,
            project_id=project_id
        )
    except ImportError:
        raise ImportError("mem0ai package not installed. Install with: pip install mem0ai")
