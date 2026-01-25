#!/usr/bin/env python3
"""
ADR Listing and Discovery Tool
Lists and searches Architecture Decision Records in a project
Usage: ./list-adrs.py [path] [--status STATUS] [--search TERM] [--json]
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ADR:
    """Represents an Architecture Decision Record."""

    number: int
    title: str
    status: str
    date: str | None
    authors: list[str]
    file_path: str
    supersedes: list[int] = field(default_factory=list)
    superseded_by: list[int] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    summary: str = ""


def find_adr_directories(base_path: Path) -> list[Path]:
    """Find directories that contain ADRs."""
    candidates = [
        "docs/adr",
        "docs/adrs",
        "docs/architecture/decisions",
        "docs/architecture/adr",
        "adr",
        "adrs",
        "decisions",
        ".adr",
    ]

    found = []
    for candidate in candidates:
        path = base_path / candidate
        if path.exists() and path.is_dir():
            found.append(path)

    # Also check for ADR files in docs root
    docs_path = base_path / "docs"
    if docs_path.exists():
        adr_files = list(docs_path.glob("ADR-*.md")) + list(docs_path.glob("adr-*.md"))
        if adr_files and docs_path not in found:
            found.append(docs_path)

    return found


def parse_adr_file(file_path: Path) -> ADR | None:
    """Parse an ADR markdown file."""
    try:
        content = file_path.read_text()
    except (OSError, UnicodeDecodeError):
        return None

    # Extract ADR number from filename or content
    number = 0
    filename = file_path.stem.upper()
    number_match = re.search(r"ADR[_-]?(\d+)", filename, re.IGNORECASE)
    if number_match:
        number = int(number_match.group(1))
    else:
        # Try to find in content
        content_match = re.search(r"#\s*ADR[_-]?(\d+)", content, re.IGNORECASE)
        if content_match:
            number = int(content_match.group(1))

    # Extract title
    title = ""
    title_match = re.search(r"#\s*ADR[_-]?\d*:?\s*(.+?)(?:\n|$)", content, re.IGNORECASE)
    if title_match:
        title = title_match.group(1).strip()
    else:
        # Use filename as title
        title = file_path.stem.replace("-", " ").replace("_", " ")

    # Extract status
    status = "Unknown"
    status_match = re.search(r"\*\*Status\*\*:?\s*(\w+)", content, re.IGNORECASE)
    if status_match:
        status = status_match.group(1).capitalize()

    # Extract date
    date = None
    date_match = re.search(r"\*\*Date\*\*:?\s*(\d{4}-\d{2}-\d{2})", content)
    if date_match:
        date = date_match.group(1)

    # Extract authors
    authors = []
    authors_match = re.search(r"\*\*Authors?\*\*:?\s*(.+?)(?:\n|$)", content, re.IGNORECASE)
    if authors_match:
        author_text = authors_match.group(1)
        # Split by comma or "and"
        authors = [a.strip() for a in re.split(r",|\band\b", author_text) if a.strip()]

    # Extract supersedes
    supersedes = []
    supersedes_match = re.search(r"\*\*Supersedes\*\*:?\s*(.+?)(?:\n|$)", content, re.IGNORECASE)
    if supersedes_match:
        nums = re.findall(r"ADR[_-]?(\d+)", supersedes_match.group(1), re.IGNORECASE)
        supersedes = [int(n) for n in nums]

    # Extract superseded by
    superseded_by = []
    superseded_match = re.search(r"\*\*Superseded\s*by\*\*:?\s*(.+?)(?:\n|$)", content, re.IGNORECASE)
    if superseded_match:
        nums = re.findall(r"ADR[_-]?(\d+)", superseded_match.group(1), re.IGNORECASE)
        superseded_by = [int(n) for n in nums]

    # Extract summary (first paragraph of Context section)
    summary = ""
    context_match = re.search(r"##\s*Context\s*\n+(.+?)(?=\n\n|\n##|$)", content, re.DOTALL | re.IGNORECASE)
    if context_match:
        summary = context_match.group(1).strip()[:200]
        if len(context_match.group(1).strip()) > 200:
            summary += "..."

    return ADR(
        number=number,
        title=title,
        status=status,
        date=date,
        authors=authors,
        file_path=str(file_path),
        supersedes=supersedes,
        superseded_by=superseded_by,
        summary=summary,
    )


def find_all_adrs(base_path: Path) -> list[ADR]:
    """Find and parse all ADRs in the project."""
    adrs = []
    adr_dirs = find_adr_directories(base_path)

    if not adr_dirs:
        # Search for ADR files anywhere
        for md_file in base_path.rglob("*.md"):
            if "ADR" in md_file.stem.upper() or "adr" in md_file.stem.lower():
                adr = parse_adr_file(md_file)
                if adr and adr.number > 0:
                    adrs.append(adr)
    else:
        for adr_dir in adr_dirs:
            for md_file in adr_dir.glob("*.md"):
                adr = parse_adr_file(md_file)
                if adr:
                    adrs.append(adr)

    # Sort by number
    adrs.sort(key=lambda a: a.number)
    return adrs


def get_next_adr_number(adrs: list[ADR]) -> int:
    """Calculate the next ADR number."""
    if not adrs:
        return 1
    return max(a.number for a in adrs) + 1


def filter_adrs(adrs: list[ADR], status: str | None = None, search: str | None = None) -> list[ADR]:
    """Filter ADRs by status and/or search term."""
    result = adrs

    if status:
        status_lower = status.lower()
        result = [a for a in result if a.status.lower() == status_lower]

    if search:
        search_lower = search.lower()
        result = [
            a
            for a in result
            if search_lower in a.title.lower() or search_lower in a.summary.lower() or search_lower in " ".join(a.authors).lower()
        ]

    return result


def main():
    parser = argparse.ArgumentParser(description="List Architecture Decision Records")
    parser.add_argument("path", nargs="?", default=".", help="Project path to search")
    parser.add_argument("--status", "-s", help="Filter by status (Proposed, Accepted, Deprecated, etc.)")
    parser.add_argument("--search", "-q", help="Search in title and summary")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--next", action="store_true", help="Show next ADR number only")
    args = parser.parse_args()

    base_path = Path(args.path).resolve()
    if not base_path.exists():
        print(f"Error: Path '{base_path}' does not exist", file=sys.stderr)
        sys.exit(1)

    adrs = find_all_adrs(base_path)
    filtered_adrs = filter_adrs(adrs, args.status, args.search)
    next_number = get_next_adr_number(adrs)

    if args.next:
        print(f"{next_number:04d}")
        return 0

    if args.json:
        output = {
            "total": len(adrs),
            "filtered": len(filtered_adrs),
            "next_number": next_number,
            "next_number_formatted": f"{next_number:04d}",
            "adr_directories": [str(d) for d in find_adr_directories(base_path)],
            "by_status": {},
            "adrs": [
                {
                    "number": a.number,
                    "number_formatted": f"{a.number:04d}",
                    "title": a.title,
                    "status": a.status,
                    "date": a.date,
                    "authors": a.authors,
                    "file": a.file_path,
                    "supersedes": a.supersedes,
                    "superseded_by": a.superseded_by,
                    "summary": a.summary,
                }
                for a in filtered_adrs
            ],
        }

        # Count by status
        for adr in adrs:
            status = adr.status
            output["by_status"][status] = output["by_status"].get(status, 0) + 1

        print(json.dumps(output, indent=2))
    else:
        print("=" * 70)
        print("               ARCHITECTURE DECISION RECORDS")
        print("=" * 70)
        print()

        adr_dirs = find_adr_directories(base_path)
        if adr_dirs:
            print(f"ADR Directories: {', '.join(str(d) for d in adr_dirs)}")
        else:
            print("ADR Directory: Not found (searched common locations)")
        print()

        print("SUMMARY")
        print("-" * 50)
        print(f"Total ADRs:     {len(adrs)}")
        print(f"Next Number:    ADR-{next_number:04d}")
        print()

        # Status breakdown
        status_counts: dict[str, int] = {}
        for adr in adrs:
            status_counts[adr.status] = status_counts.get(adr.status, 0) + 1

        if status_counts:
            print("BY STATUS")
            print("-" * 50)
            for status, count in sorted(status_counts.items()):
                print(f"  {status:15} {count}")
            print()

        if filtered_adrs:
            print("ADR LIST")
            print("-" * 50)
            for adr in filtered_adrs:
                status_icon = {"Accepted": "[OK]", "Proposed": "[??]", "Deprecated": "[--]", "Superseded": "[SS]", "Rejected": "[X]"}.get(
                    adr.status, "[  ]"
                )

                print(f"\nADR-{adr.number:04d}: {adr.title}")
                print(f"  Status: {status_icon} {adr.status}")
                if adr.date:
                    print(f"  Date:   {adr.date}")
                if adr.authors:
                    print(f"  Author: {', '.join(adr.authors)}")
                if adr.supersedes:
                    print(f"  Supersedes: {', '.join(f'ADR-{n:04d}' for n in adr.supersedes)}")
                if adr.superseded_by:
                    print(f"  Superseded by: {', '.join(f'ADR-{n:04d}' for n in adr.superseded_by)}")
                print(f"  File:   {adr.file_path}")
                if adr.summary:
                    print(f"  Summary: {adr.summary[:100]}...")
        else:
            if args.status or args.search:
                print("No ADRs matching the filter criteria.")
            else:
                print("No ADRs found in this project.")
                print("\nTo create your first ADR:")
                print("  mkdir -p docs/adr")
                print("  # Use the adr-manager.py script to create ADRs")

        print()
        print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
