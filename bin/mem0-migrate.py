#!/usr/bin/env python3
"""
Mem0 Migration Utility for OrchestKit

Migrates existing Claude context data to Mem0 memory service.
This is optional - users run it manually per-project.

Features:
- Detects if project has .claude/context/ structure
- Migrates decisions from knowledge/decisions/active.json
- Migrates patterns from knowledge/patterns/established.json
- Migrates identity from identity.json
- Uses project name for Mem0 user_id scoping
- Marks migrated items with metadata
- Idempotent - can be run multiple times safely

Requirements:
- MEM0_API_KEY environment variable
- mem0ai package: pip install mem0ai

Usage:
    # Preview what would be migrated
    python bin/mem0-migrate.py --dry-run

    # Migrate from current directory
    python bin/mem0-migrate.py

    # Migrate from specific project
    python bin/mem0-migrate.py /path/to/project

    # Verbose output
    python bin/mem0-migrate.py -v
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path


# ANSI colors for terminal output
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"


def log_info(msg: str) -> None:
    print(f"{Colors.BLUE}[INFO]{Colors.RESET} {msg}")


def log_success(msg: str) -> None:
    print(f"{Colors.GREEN}[OK]{Colors.RESET} {msg}")


def log_warning(msg: str) -> None:
    print(f"{Colors.YELLOW}[WARN]{Colors.RESET} {msg}")


def log_error(msg: str) -> None:
    print(f"{Colors.RED}[ERROR]{Colors.RESET} {msg}", file=sys.stderr)


def log_dry_run(msg: str) -> None:
    print(f"{Colors.CYAN}[DRY-RUN]{Colors.RESET} {msg}")


def compute_content_hash(content: str) -> str:
    """Compute SHA256 hash of content for idempotency checks."""
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def load_json_file(file_path: Path) -> dict | None:
    """Load JSON file, return None if not found or invalid."""
    if not file_path.exists():
        return None
    try:
        with file_path.open(encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        log_warning(f"Invalid JSON in {file_path}: {e}")
        return None
    except Exception as e:
        log_warning(f"Failed to read {file_path}: {e}")
        return None


def get_project_name(project_dir: Path) -> str:
    """Extract project name from identity.json or directory name."""
    identity_file = project_dir / ".claude" / "context" / "identity.json"
    identity = load_json_file(identity_file)

    if identity and "project" in identity:
        return identity["project"].get("name", project_dir.name)

    return project_dir.name


def format_decision_memory(decision: dict) -> str:
    """Format a decision for Mem0 memory storage."""
    parts = [
        f"Decision: {decision.get('summary', 'No summary')}",
        f"Date: {decision.get('date', 'Unknown')}",
        f"Status: {decision.get('status', 'Unknown')}",
    ]

    if "rationale" in decision:
        parts.append(f"Rationale: {decision['rationale']}")

    if "impact" in decision:
        parts.append(f"Impact: {decision['impact']}")

    return "\n".join(parts)


def format_pattern_memory(category: str, pattern: dict) -> str:
    """Format a pattern for Mem0 memory storage."""
    parts = [
        f"Pattern: {pattern.get('name', 'Unknown')}",
        f"Category: {category}",
        f"Description: {pattern.get('description', 'No description')}",
    ]

    if "example" in pattern:
        parts.append(f"Example: {pattern['example']}")

    if "enforcement" in pattern:
        parts.append(f"Enforcement: {pattern['enforcement']}")

    return "\n".join(parts)


def format_identity_memory(identity: dict) -> str:
    """Format identity for Mem0 memory storage."""
    project = identity.get("project", {})
    tech_stack = identity.get("tech_stack", {})
    constraints = identity.get("constraints", [])

    parts = [
        f"Project: {project.get('name', 'Unknown')}",
        f"Type: {project.get('type', 'Unknown')}",
        f"Version: {project.get('version', 'Unknown')}",
    ]

    if tech_stack:
        tech_parts = []
        for category, details in tech_stack.items():
            if isinstance(details, dict):
                tech_parts.append(f"  {category}: {details.get('framework', details.get('primary', 'N/A'))}")
        if tech_parts:
            parts.append("Tech Stack:")
            parts.extend(tech_parts)

    if constraints:
        parts.append("Constraints:")
        for c in constraints[:5]:  # Limit to first 5 constraints
            parts.append(f"  - {c}")

    return "\n".join(parts)


class Mem0Migrator:
    """Handles migration of OrchestKit context to Mem0."""

    def __init__(
        self,
        project_dir: Path,
        dry_run: bool = False,
        verbose: bool = False,
    ):
        self.project_dir = project_dir
        self.dry_run = dry_run
        self.verbose = verbose
        self.context_dir = project_dir / ".claude" / "context"
        self.project_name = get_project_name(project_dir)
        self.user_id = f"orchestkit-{self.project_name.lower().replace(' ', '-')}"
        self.client = None
        self.migrated_count = 0
        self.skipped_count = 0
        self.existing_memories: set[str] = set()

    def initialize_client(self) -> bool:
        """Initialize Mem0 client. Returns True if successful."""
        api_key = os.environ.get("MEM0_API_KEY")
        if not api_key:
            log_error("MEM0_API_KEY environment variable not set")
            log_info("Get your API key from: https://app.mem0.ai/dashboard/api-keys")
            return False

        try:
            from mem0 import MemoryClient

            self.client = MemoryClient(api_key=api_key)
            return True
        except ImportError:
            log_error("mem0ai package not installed")
            log_info("Install with: pip install mem0ai")
            return False
        except Exception as e:
            log_error(f"Failed to initialize Mem0 client: {e}")
            return False

    def load_existing_memories(self) -> None:
        """Load existing memories to check for duplicates."""
        if self.dry_run or not self.client:
            return

        try:
            memories = self.client.get_all(user_id=self.user_id)
            for memory in memories:
                # Extract content hash from metadata if present
                metadata = memory.get("metadata", {})
                if "content_hash" in metadata:
                    self.existing_memories.add(metadata["content_hash"])
        except Exception as e:
            if self.verbose:
                log_warning(f"Could not load existing memories: {e}")

    def add_memory(
        self,
        content: str,
        category: str,
        source_file: str,
        item_id: str | None = None,
    ) -> bool:
        """Add a memory to Mem0. Returns True if added, False if skipped."""
        content_hash = compute_content_hash(content)

        # Check for duplicate
        if content_hash in self.existing_memories:
            if self.verbose:
                log_info(f"Skipping duplicate: {content[:50]}...")
            self.skipped_count += 1
            return False

        metadata = {
            "source": "orchestkit-migration",
            "category": category,
            "source_file": source_file,
            "migrated": True,
            "migrated_at": datetime.now(UTC).isoformat(),
            "content_hash": content_hash,
        }

        if item_id:
            metadata["item_id"] = item_id

        if self.dry_run:
            log_dry_run(f"Would add memory [{category}]: {content[:60]}...")
            self.migrated_count += 1
            return True

        try:
            if self.client is not None:
                self.client.add(
                    content,
                    user_id=self.user_id,
                    metadata=metadata,
                )
            self.existing_memories.add(content_hash)
            self.migrated_count += 1
            if self.verbose:
                log_success(f"Added memory [{category}]: {content[:50]}...")
            return True
        except Exception as e:
            log_error(f"Failed to add memory: {e}")
            return False

    def migrate_identity(self) -> int:
        """Migrate identity.json. Returns count of memories added."""
        identity_file = self.context_dir / "identity.json"
        identity = load_json_file(identity_file)

        if not identity:
            if self.verbose:
                log_info("No identity.json found, skipping")
            return 0

        log_info("Migrating identity...")

        content = format_identity_memory(identity)
        if self.add_memory(
            content=content,
            category="identity",
            source_file="identity.json",
            item_id="project-identity",
        ):
            return 1
        return 0

    def migrate_decisions(self) -> int:
        """Migrate decisions from active.json. Returns count of memories added."""
        decisions_file = self.context_dir / "knowledge" / "decisions" / "active.json"
        data = load_json_file(decisions_file)

        if not data or "decisions" not in data:
            if self.verbose:
                log_info("No decisions found, skipping")
            return 0

        decisions = data["decisions"]
        log_info(f"Migrating {len(decisions)} decisions...")

        count = 0
        for decision in decisions:
            decision_id = decision.get("id", "unknown")
            content = format_decision_memory(decision)

            if self.add_memory(
                content=content,
                category="decision",
                source_file="knowledge/decisions/active.json",
                item_id=decision_id,
            ):
                count += 1

        return count

    def migrate_patterns(self) -> int:
        """Migrate patterns from established.json. Returns count of memories added."""
        patterns_file = self.context_dir / "knowledge" / "patterns" / "established.json"
        data = load_json_file(patterns_file)

        if not data or "patterns" not in data:
            if self.verbose:
                log_info("No patterns found, skipping")
            return 0

        patterns_dict = data["patterns"]
        total_patterns = sum(len(patterns) for patterns in patterns_dict.values())
        log_info(f"Migrating {total_patterns} patterns...")

        count = 0
        for category, patterns in patterns_dict.items():
            for pattern in patterns:
                pattern_name = pattern.get("name", "unknown")
                content = format_pattern_memory(category, pattern)

                if self.add_memory(
                    content=content,
                    category="pattern",
                    source_file="knowledge/patterns/established.json",
                    item_id=f"{category}-{pattern_name}".lower().replace(" ", "-"),
                ):
                    count += 1

        return count

    def run(self) -> int:
        """Run the migration. Returns exit code (0 = success)."""
        print(f"\n{Colors.BOLD}OrchestKit -> Mem0 Migration{Colors.RESET}")
        print(f"{'=' * 40}")
        print(f"Project: {self.project_name}")
        print(f"User ID: {self.user_id}")
        print(f"Context dir: {self.context_dir}")

        if self.dry_run:
            print(f"{Colors.CYAN}Mode: DRY RUN (no changes will be made){Colors.RESET}")
        print()

        # Check context directory exists
        if not self.context_dir.exists():
            log_error(f"Context directory not found: {self.context_dir}")
            log_info("This project does not have a .claude/context/ structure")
            return 1

        # Initialize client (skip in dry-run)
        if not self.dry_run:
            if not self.initialize_client():
                return 1
            log_success("Mem0 client initialized")

            # Load existing memories for deduplication
            self.load_existing_memories()
            if self.verbose and self.existing_memories:
                log_info(f"Found {len(self.existing_memories)} existing memories")

        # Run migrations
        identity_count = self.migrate_identity()
        decisions_count = self.migrate_decisions()
        patterns_count = self.migrate_patterns()

        # Summary
        print()
        print(f"{Colors.BOLD}Migration Summary{Colors.RESET}")
        print(f"{'-' * 40}")
        print(f"Identity:  {identity_count} memory")
        print(f"Decisions: {decisions_count} memories")
        print(f"Patterns:  {patterns_count} memories")
        print(f"{'-' * 40}")
        print(f"Total migrated: {self.migrated_count}")
        print(f"Skipped (duplicates): {self.skipped_count}")

        if self.dry_run:
            print(f"\n{Colors.CYAN}This was a dry run. Run without --dry-run to perform migration.{Colors.RESET}")

        return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate OrchestKit context data to Mem0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview what would be migrated
  %(prog)s --dry-run

  # Migrate from current directory
  %(prog)s

  # Migrate from specific project
  %(prog)s /path/to/project

Environment Variables:
  MEM0_API_KEY  Required. Your Mem0 API key from https://app.mem0.ai/dashboard/api-keys
        """,
    )

    parser.add_argument(
        "project_dir",
        nargs="?",
        default=".",
        help="Project directory to migrate (default: current directory)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview migration without making changes",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )

    args = parser.parse_args()

    project_dir = Path(args.project_dir).resolve()

    if not project_dir.exists():
        log_error(f"Project directory not found: {project_dir}")
        return 1

    migrator = Mem0Migrator(
        project_dir=project_dir,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )

    return migrator.run()


if __name__ == "__main__":
    sys.exit(main())
