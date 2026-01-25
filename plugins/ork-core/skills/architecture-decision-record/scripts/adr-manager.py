#!/usr/bin/env python3
"""
ADR Manager
Comprehensive tool for managing Architecture Decision Records
Usage: ./adr-manager.py <command> [options]

Commands:
  init         Initialize ADR directory structure
  create       Create a new ADR
  supersede    Mark an ADR as superseded
  validate     Validate ADR format and links
  graph        Show ADR dependency graph
"""

import argparse
import json
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from textwrap import dedent


def get_git_author() -> str:
    """Get current git user name."""
    try:
        result = subprocess.run(
            ["git", "config", "user.name"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return "Unknown Author"


def find_adr_dir(base_path: Path) -> Path | None:
    """Find existing ADR directory."""
    candidates = [
        "docs/adr",
        "docs/adrs",
        "docs/architecture/decisions",
        "adr",
        "adrs",
        "decisions",
    ]

    for candidate in candidates:
        path = base_path / candidate
        if path.exists() and path.is_dir():
            return path

    return None


def get_existing_adrs(adr_dir: Path) -> list[tuple[int, str, Path]]:
    """Get list of existing ADRs as (number, title, path) tuples."""
    adrs = []

    for md_file in adr_dir.glob("*.md"):
        content = md_file.read_text()

        # Extract number
        number = 0
        num_match = re.search(r"ADR[_-]?(\d+)", md_file.stem, re.IGNORECASE)
        if num_match:
            number = int(num_match.group(1))

        # Extract title
        title = ""
        title_match = re.search(r"#\s*ADR[_-]?\d*:?\s*(.+?)(?:\n|$)", content, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()

        if number > 0:
            adrs.append((number, title, md_file))

    return sorted(adrs, key=lambda x: x[0])


def get_next_number(adrs: list[tuple[int, str, Path]]) -> int:
    """Get next ADR number."""
    if not adrs:
        return 1
    return max(num for num, _, _ in adrs) + 1


def cmd_init(args: argparse.Namespace) -> int:
    """Initialize ADR directory structure."""
    base_path = Path(args.path).resolve()
    adr_dir = base_path / args.dir

    if adr_dir.exists():
        print(f"ADR directory already exists: {adr_dir}")
        return 0

    adr_dir.mkdir(parents=True)

    # Create README
    readme_content = dedent("""
        # Architecture Decision Records

        This directory contains Architecture Decision Records (ADRs) for this project.

        ## What is an ADR?

        An ADR is a document that captures an important architectural decision
        along with its context and consequences.

        ## ADR Statuses

        - **Proposed**: Under discussion, not yet accepted
        - **Accepted**: Approved and in effect
        - **Deprecated**: No longer recommended but still valid
        - **Superseded**: Replaced by a newer ADR
        - **Rejected**: Considered but not adopted

        ## Creating a New ADR

        Use the ADR manager script:
        ```bash
        ./adr-manager.py create "Decision Title"
        ```

        ## ADR Index

        | Number | Title | Status | Date |
        |--------|-------|--------|------|
        | (ADRs will be listed here) |

        ## References

        - [ADR on GitHub](https://adr.github.io/)
        - [Michael Nygard's original article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
    """).strip()

    (adr_dir / "README.md").write_text(readme_content)

    # Create first ADR (record of adopting ADRs)
    first_adr = dedent(f"""
        # ADR-0001: Use Architecture Decision Records

        **Status**: Accepted

        **Date**: {datetime.now(UTC).strftime("%Y-%m-%d")}

        **Authors**: {get_git_author()}

        ---

        ## Context

        We need to record the architectural decisions made on this project to:
        - Provide context for future developers
        - Document the reasoning behind decisions
        - Track the evolution of the system architecture

        **Problem Statement:**
        Architectural knowledge is often lost over time as team members change
        and memories fade. We need a systematic way to capture and preserve
        this knowledge.

        ---

        ## Decision

        We will use Architecture Decision Records (ADRs) as described by
        Michael Nygard in his article "Documenting Architecture Decisions".

        **We will:**
        - Create a new ADR for each significant architectural decision
        - Store ADRs in the `{args.dir}` directory
        - Use a consistent format with numbered files

        ---

        ## Consequences

        ### Positive
        - Decisions are documented for future reference
        - New team members can understand past decisions
        - We have a clear audit trail of architectural evolution

        ### Negative
        - Additional documentation effort required
        - Need to maintain discipline in creating ADRs

        ---

        ## References

        - [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
        - [ADR GitHub Organization](https://adr.github.io/)
    """).strip()

    (adr_dir / "ADR-0001-use-architecture-decision-records.md").write_text(first_adr)

    print(f"Initialized ADR directory: {adr_dir}")
    print("Created:")
    print(f"  - {adr_dir}/README.md")
    print(f"  - {adr_dir}/ADR-0001-use-architecture-decision-records.md")

    return 0


def cmd_create(args: argparse.Namespace) -> int:
    """Create a new ADR."""
    base_path = Path(args.path).resolve()
    adr_dir = find_adr_dir(base_path)

    if not adr_dir:
        print("No ADR directory found. Run 'init' first or specify --dir", file=sys.stderr)
        return 1

    existing = get_existing_adrs(adr_dir)
    number = args.number if args.number else get_next_number(existing)
    title = args.title
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    filename = f"ADR-{number:04d}-{slug}.md"
    filepath = adr_dir / filename

    if filepath.exists():
        print(f"Error: {filepath} already exists", file=sys.stderr)
        return 1

    template = dedent(f"""
        # ADR-{number:04d}: {title}

        **Status**: Proposed

        **Date**: {datetime.now(UTC).strftime("%Y-%m-%d")}

        **Authors**: {get_git_author()}

        **Supersedes**: (if applicable)

        **Superseded by**: (if applicable)

        ---

        ## Context

        [Describe the problem or opportunity. What forces are at play?]

        **Problem Statement:**
        [Clear description of the issue]

        **Current Situation:**
        [What is the state of the system today?]

        **Requirements:**
        - [Requirement 1]
        - [Requirement 2]

        **Constraints:**
        - [Constraint 1]
        - [Constraint 2]

        ---

        ## Decision

        [Describe the decision clearly and specifically]

        **We will:** [Clear statement of the decision]

        **Technology/Approach:**
        - [Component 1]
        - [Component 2]

        ---

        ## Consequences

        ### Positive
        - [Benefit 1]
        - [Benefit 2]

        ### Negative
        - [Cost/risk 1]
        - [Cost/risk 2]

        ---

        ## Alternatives Considered

        ### Alternative 1: [Name]

        **Description:** [What is this alternative?]

        **Pros:**
        - [Advantage 1]

        **Cons:**
        - [Disadvantage 1]

        **Why not chosen:** [Explanation]

        ---

        ## References

        - [Link to discussion]
        - [Link to research]
    """).strip()

    filepath.write_text(template)

    if args.json:
        print(
            json.dumps(
                {
                    "created": True,
                    "number": number,
                    "number_formatted": f"{number:04d}",
                    "title": title,
                    "filename": filename,
                    "path": str(filepath),
                    "status": "Proposed",
                }
            )
        )
    else:
        print(f"Created ADR-{number:04d}: {title}")
        print(f"File: {filepath}")
        print("\nNext steps:")
        print("  1. Edit the ADR to fill in the details")
        print("  2. Change status to 'Accepted' when approved")
        print("  3. Commit the ADR to version control")

    return 0


def cmd_supersede(args: argparse.Namespace) -> int:
    """Mark an ADR as superseded by another."""
    base_path = Path(args.path).resolve()
    adr_dir = find_adr_dir(base_path)

    if not adr_dir:
        print("No ADR directory found", file=sys.stderr)
        return 1

    existing = get_existing_adrs(adr_dir)

    # Find old ADR
    old_adr = None
    for num, title, path in existing:
        if num == args.old:
            old_adr = (num, title, path)
            break

    if not old_adr:
        print(f"Error: ADR-{args.old:04d} not found", file=sys.stderr)
        return 1

    # Update old ADR
    old_content = old_adr[2].read_text()

    # Update status
    old_content = re.sub(r"\*\*Status\*\*:\s*\w+", "**Status**: Superseded", old_content)

    # Update or add superseded by
    if "**Superseded by**:" in old_content:
        old_content = re.sub(
            r"\*\*Superseded by\*\*:.*",
            f"**Superseded by**: ADR-{args.new:04d}",
            old_content,
        )
    else:
        old_content = old_content.replace(
            "**Status**: Superseded",
            f"**Status**: Superseded\n\n**Superseded by**: ADR-{args.new:04d}",
        )

    old_adr[2].write_text(old_content)

    # Find and update new ADR if it exists
    for num, _title, path in existing:
        if num == args.new:
            new_content = path.read_text()
            if "**Supersedes**:" in new_content:
                new_content = re.sub(
                    r"\*\*Supersedes\*\*:.*",
                    f"**Supersedes**: ADR-{args.old:04d}",
                    new_content,
                )
            path.write_text(new_content)
            break

    print(f"ADR-{args.old:04d} is now superseded by ADR-{args.new:04d}")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate ADR format and links."""
    base_path = Path(args.path).resolve()
    adr_dir = find_adr_dir(base_path)

    if not adr_dir:
        print("No ADR directory found", file=sys.stderr)
        return 1

    existing = get_existing_adrs(adr_dir)
    existing_numbers = {num for num, _, _ in existing}
    issues: list[str] = []
    warnings: list[str] = []

    for num, _title, path in existing:
        content = path.read_text()

        # Check for required sections
        required_sections = ["## Context", "## Decision", "## Consequences"]
        for section in required_sections:
            if section not in content:
                issues.append(f"ADR-{num:04d}: Missing '{section}' section")

        # Check status
        status_match = re.search(r"\*\*Status\*\*:\s*(\w+)", content)
        if not status_match:
            issues.append(f"ADR-{num:04d}: Missing Status field")
        else:
            status = status_match.group(1)
            if status not in ["Proposed", "Accepted", "Deprecated", "Superseded", "Rejected"]:
                warnings.append(f"ADR-{num:04d}: Non-standard status '{status}'")

        # Check date format
        date_match = re.search(r"\*\*Date\*\*:\s*(\S+)", content)
        if date_match:
            date_str = date_match.group(1)
            if not re.match(r"\d{4}-\d{2}-\d{2}", date_str):
                warnings.append(f"ADR-{num:04d}: Date format should be YYYY-MM-DD")

        # Check references to other ADRs exist
        refs = re.findall(r"ADR[_-](\d+)", content, re.IGNORECASE)
        for ref in refs:
            ref_num = int(ref)
            if ref_num != num and ref_num not in existing_numbers:
                issues.append(f"ADR-{num:04d}: References non-existent ADR-{ref_num:04d}")

        # Check superseded ADRs have a superseding reference
        if "Superseded" in content:
            superseded_match = re.search(r"\*\*Superseded by\*\*:\s*(.+)", content)
            if not superseded_match or "ADR" not in superseded_match.group(1):
                warnings.append(f"ADR-{num:04d}: Superseded but no 'Superseded by' reference")

    if args.json:
        print(
            json.dumps(
                {
                    "valid": len(issues) == 0,
                    "total_adrs": len(existing),
                    "issues": issues,
                    "warnings": warnings,
                }
            )
        )
    else:
        print("=" * 60)
        print("            ADR VALIDATION REPORT")
        print("=" * 60)
        print(f"\nTotal ADRs: {len(existing)}")
        print(f"Issues: {len(issues)}")
        print(f"Warnings: {len(warnings)}")

        if issues:
            print("\nISSUES (must fix):")
            for issue in issues:
                print(f"  [E] {issue}")

        if warnings:
            print("\nWARNINGS (should fix):")
            for warning in warnings:
                print(f"  [W] {warning}")

        if not issues and not warnings:
            print("\nAll ADRs are valid!")

        print("\n" + "=" * 60)

    return 1 if issues else 0


def cmd_graph(args: argparse.Namespace) -> int:
    """Show ADR dependency graph."""
    base_path = Path(args.path).resolve()
    adr_dir = find_adr_dir(base_path)

    if not adr_dir:
        print("No ADR directory found", file=sys.stderr)
        return 1

    existing = get_existing_adrs(adr_dir)
    relationships: list[tuple[int, int, str]] = []

    for num, _title, path in existing:
        content = path.read_text()

        # Find supersedes
        supersedes_match = re.search(r"\*\*Supersedes\*\*:\s*(.+)", content, re.IGNORECASE)
        if supersedes_match:
            refs = re.findall(r"ADR[_-]?(\d+)", supersedes_match.group(1), re.IGNORECASE)
            for ref in refs:
                relationships.append((num, int(ref), "supersedes"))

    if args.json:
        print(
            json.dumps(
                {
                    "adrs": [{"number": n, "title": t, "file": str(p)} for n, t, p in existing],
                    "relationships": [{"from": f, "to": t, "type": r} for f, t, r in relationships],
                }
            )
        )
    else:
        print("ADR Dependency Graph")
        print("=" * 40)

        if not relationships:
            print("\nNo superseding relationships found.")
            print("\nAll ADRs:")
            for num, title, _ in existing:
                print(f"  ADR-{num:04d}: {title}")
        else:
            print("\nRelationships:")
            for from_num, to_num, rel_type in relationships:
                print(f"  ADR-{from_num:04d} --{rel_type}--> ADR-{to_num:04d}")

            print("\nVisual (ASCII):")
            for from_num, to_num, _ in relationships:
                from_title = next((t for n, t, _ in existing if n == from_num), "")
                to_title = next((t for n, t, _ in existing if n == to_num), "")
                print(f"\n  [{from_num:04d}] {from_title[:30]}")
                print("      |")
                print("      v supersedes")
                print("      |")
                print(f"  [{to_num:04d}] {to_title[:30]}")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Manage Architecture Decision Records")
    parser.add_argument("--path", default=".", help="Project path")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    subparsers = parser.add_subparsers(dest="command", help="Command")

    # init
    init_parser = subparsers.add_parser("init", help="Initialize ADR directory")
    init_parser.add_argument("--dir", default="docs/adr", help="ADR directory path")

    # create
    create_parser = subparsers.add_parser("create", help="Create a new ADR")
    create_parser.add_argument("title", help="ADR title")
    create_parser.add_argument("--number", "-n", type=int, help="Specific ADR number")

    # supersede
    supersede_parser = subparsers.add_parser("supersede", help="Mark ADR as superseded")
    supersede_parser.add_argument("old", type=int, help="ADR number being superseded")
    supersede_parser.add_argument("new", type=int, help="New ADR number")

    # validate
    subparsers.add_parser("validate", help="Validate ADR format")

    # graph
    subparsers.add_parser("graph", help="Show ADR dependency graph")

    args = parser.parse_args()

    if args.command == "init":
        return cmd_init(args)
    elif args.command == "create":
        return cmd_create(args)
    elif args.command == "supersede":
        return cmd_supersede(args)
    elif args.command == "validate":
        return cmd_validate(args)
    elif args.command == "graph":
        return cmd_graph(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
