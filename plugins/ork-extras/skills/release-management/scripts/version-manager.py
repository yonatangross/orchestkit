#!/usr/bin/env python3
"""
Version Manager
Manages semantic versioning and changelog generation for releases
Usage: ./version-manager.py [command] [options]

Commands:
  current      Show current version
  bump         Bump version (major|minor|patch)
  changelog    Generate changelog from commits
  validate     Validate version string
"""

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


@dataclass
class Commit:
    """Represents a parsed commit."""

    hash: str
    type: str
    scope: str | None
    description: str
    body: str
    breaking: bool = False


@dataclass
class Version:
    """Semantic version representation."""

    major: int
    minor: int
    patch: int
    prerelease: str | None = None
    build: str | None = None

    @classmethod
    def parse(cls, version_str: str) -> "Version":
        """Parse a version string like '1.2.3' or 'v1.2.3-beta.1+build.123'."""
        version_str = version_str.lstrip("v")

        # Handle prerelease and build metadata
        prerelease = None
        build = None

        if "+" in version_str:
            version_str, build = version_str.split("+", 1)

        if "-" in version_str:
            version_str, prerelease = version_str.split("-", 1)

        parts = version_str.split(".")
        if len(parts) < 3:
            parts.extend(["0"] * (3 - len(parts)))

        return cls(
            major=int(parts[0]),
            minor=int(parts[1]),
            patch=int(parts[2]),
            prerelease=prerelease,
            build=build,
        )

    def __str__(self) -> str:
        version = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            version += f"-{self.prerelease}"
        if self.build:
            version += f"+{self.build}"
        return version

    def bump_major(self) -> "Version":
        return Version(self.major + 1, 0, 0)

    def bump_minor(self) -> "Version":
        return Version(self.major, self.minor + 1, 0)

    def bump_patch(self) -> "Version":
        return Version(self.major, self.minor, self.patch + 1)


def run_git(args: list[str], cwd: Path | None = None) -> tuple[int, str]:
    """Run a git command and return exit code and output."""
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=30,
        )
        return result.returncode, result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return 1, ""


def get_current_version(cwd: Path | None = None) -> Version | None:
    """Get current version from git tags."""
    code, output = run_git(["describe", "--tags", "--abbrev=0"], cwd)
    if code == 0 and output:
        return Version.parse(output)
    return Version(0, 0, 0)


def get_commits_since_tag(tag: str | None, cwd: Path | None = None) -> list[Commit]:
    """Get commits since the specified tag."""
    if tag:
        code, output = run_git(["log", f"{tag}..HEAD", "--format=%H|%s|%b%n---COMMIT---"], cwd)
    else:
        code, output = run_git(["log", "--format=%H|%s|%b%n---COMMIT---"], cwd)

    if code != 0:
        return []

    commits = []
    for commit_text in output.split("---COMMIT---"):
        commit_text = commit_text.strip()
        if not commit_text:
            continue

        lines = commit_text.split("\n")
        if not lines:
            continue

        first_line = lines[0]
        parts = first_line.split("|", 2)
        if len(parts) < 2:
            continue

        commit_hash = parts[0]
        subject = parts[1]
        body = parts[2] if len(parts) > 2 else ""

        # Parse conventional commit format: type(scope): description
        match = re.match(r"^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$", subject)
        if match:
            commit_type = match.group(1).lower()
            scope = match.group(2)
            breaking = match.group(3) == "!" or "BREAKING" in body.upper()
            description = match.group(4)
        else:
            commit_type = "other"
            scope = None
            breaking = "BREAKING" in body.upper()
            description = subject

        commits.append(
            Commit(
                hash=commit_hash[:7],
                type=commit_type,
                scope=scope,
                description=description,
                body=body,
                breaking=breaking,
            )
        )

    return commits


def suggest_bump(commits: list[Commit]) -> str:
    """Suggest version bump type based on commits."""
    has_breaking = any(c.breaking for c in commits)
    has_features = any(c.type == "feat" for c in commits)

    if has_breaking:
        return "major"
    elif has_features:
        return "minor"
    return "patch"


def generate_changelog(commits: list[Commit], version: Version) -> str:
    """Generate changelog from commits."""
    categories = {
        "Breaking Changes": [],
        "Features": [],
        "Bug Fixes": [],
        "Performance": [],
        "Documentation": [],
        "Other": [],
    }

    type_mapping = {
        "feat": "Features",
        "fix": "Bug Fixes",
        "perf": "Performance",
        "docs": "Documentation",
        "refactor": "Other",
        "style": "Other",
        "test": "Other",
        "chore": "Other",
        "ci": "Other",
    }

    for commit in commits:
        if commit.breaking:
            categories["Breaking Changes"].append(commit)
        else:
            category = type_mapping.get(commit.type, "Other")
            categories[category].append(commit)

    lines = [
        f"## [{version}] - {datetime.now(UTC).strftime('%Y-%m-%d')}",
        "",
    ]

    for category, category_commits in categories.items():
        if not category_commits:
            continue

        lines.append(f"### {category}")
        lines.append("")

        for commit in category_commits:
            scope_str = f"**{commit.scope}:** " if commit.scope else ""
            lines.append(f"- {scope_str}{commit.description} ({commit.hash})")

        lines.append("")

    return "\n".join(lines)


def update_version_file(path: Path, version: Version) -> bool:
    """Update version in a file."""
    if not path.exists():
        return False

    content = path.read_text()
    version_str = str(version)

    # Try different patterns
    patterns = [
        (r'"version":\s*"[^"]*"', f'"version": "{version_str}"'),
        (r"^version\s*=\s*['\"].*['\"]", f'version = "{version_str}"', re.MULTILINE),
        (r"__version__\s*=\s*['\"].*['\"]", f'__version__ = "{version_str}"'),
    ]

    updated = False
    for pattern in patterns:
        flags = pattern[2] if len(pattern) > 2 else 0
        if re.search(pattern[0], content, flags):
            content = re.sub(pattern[0], pattern[1], content, flags=flags)
            updated = True

    if updated:
        path.write_text(content)

    return updated


def find_version_files(cwd: Path) -> list[Path]:
    """Find files that typically contain version numbers."""
    candidates = [
        "package.json",
        "pyproject.toml",
        "Cargo.toml",
        "setup.py",
        "version.py",
        "__version__.py",
    ]

    found = []
    for candidate in candidates:
        path = cwd / candidate
        if path.exists():
            found.append(path)

    return found


def cmd_current(args: argparse.Namespace) -> int:
    """Show current version."""
    cwd = Path(args.path).resolve()
    version = get_current_version(cwd)

    if args.json:
        print(
            json.dumps(
                {
                    "version": str(version) if version else None,
                    "major": version.major if version else 0,
                    "minor": version.minor if version else 0,
                    "patch": version.patch if version else 0,
                }
            )
        )
    else:
        print(f"v{version}" if version else "No version found")

    return 0


def cmd_bump(args: argparse.Namespace) -> int:
    """Bump version."""
    cwd = Path(args.path).resolve()
    current = get_current_version(cwd) or Version(0, 0, 0)

    # Get commits to analyze
    current_tag = f"v{current}" if current.major > 0 or current.minor > 0 or current.patch > 0 else None
    commits = get_commits_since_tag(current_tag, cwd)

    bump_type = args.type
    if bump_type == "auto":
        bump_type = suggest_bump(commits)

    if bump_type == "major":
        new_version = current.bump_major()
    elif bump_type == "minor":
        new_version = current.bump_minor()
    else:
        new_version = current.bump_patch()

    if args.json:
        print(
            json.dumps(
                {
                    "current": str(current),
                    "new": str(new_version),
                    "bump_type": bump_type,
                    "commits_analyzed": len(commits),
                    "has_breaking": any(c.breaking for c in commits),
                    "has_features": any(c.type == "feat" for c in commits),
                }
            )
        )
    else:
        print(f"Current version: v{current}")
        print(f"Bump type: {bump_type}")
        print(f"New version: v{new_version}")
        print(f"\nCommits analyzed: {len(commits)}")

        if not args.dry_run:
            # Update version files
            version_files = find_version_files(cwd)
            for vf in version_files:
                if update_version_file(vf, new_version):
                    print(f"Updated: {vf}")

            print("\nTo create the release:")
            print("  git add .")
            print(f'  git commit -m "chore: Bump version to {new_version}"')
            print(f'  git tag -a "v{new_version}" -m "Release v{new_version}"')
            print(f'  git push origin "v{new_version}"')

    return 0


def cmd_changelog(args: argparse.Namespace) -> int:
    """Generate changelog."""
    cwd = Path(args.path).resolve()
    current = get_current_version(cwd) or Version(0, 0, 0)

    version = Version.parse(args.version) if args.version else current.bump_patch()

    current_tag = f"v{current}" if current.major > 0 or current.minor > 0 or current.patch > 0 else None
    commits = get_commits_since_tag(current_tag, cwd)

    if not commits:
        print("No commits found since last release", file=sys.stderr)
        return 1

    changelog = generate_changelog(commits, version)

    if args.json:
        print(
            json.dumps(
                {
                    "version": str(version),
                    "commits": len(commits),
                    "changelog": changelog,
                }
            )
        )
    else:
        print(changelog)

    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate version string."""
    try:
        version = Version.parse(args.version)
        if args.json:
            print(
                json.dumps(
                    {
                        "valid": True,
                        "version": str(version),
                        "major": version.major,
                        "minor": version.minor,
                        "patch": version.patch,
                        "prerelease": version.prerelease,
                        "build": version.build,
                    }
                )
            )
        else:
            print(f"Valid: {version}")
        return 0
    except (ValueError, IndexError) as e:
        if args.json:
            print(json.dumps({"valid": False, "error": str(e)}))
        else:
            print(f"Invalid: {e}", file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser(description="Manage semantic versions and changelogs")
    parser.add_argument("--path", default=".", help="Project path")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    subparsers = parser.add_subparsers(dest="command", help="Command")

    # current
    subparsers.add_parser("current", help="Show current version")

    # bump
    bump_parser = subparsers.add_parser("bump", help="Bump version")
    bump_parser.add_argument("type", choices=["major", "minor", "patch", "auto"], default="auto", nargs="?")
    bump_parser.add_argument("--dry-run", action="store_true", help="Don't update files")

    # changelog
    changelog_parser = subparsers.add_parser("changelog", help="Generate changelog")
    changelog_parser.add_argument("--version", help="Target version for changelog")

    # validate
    validate_parser = subparsers.add_parser("validate", help="Validate version string")
    validate_parser.add_argument("version", help="Version string to validate")

    args = parser.parse_args()

    if args.command == "current":
        return cmd_current(args)
    elif args.command == "bump":
        return cmd_bump(args)
    elif args.command == "changelog":
        return cmd_changelog(args)
    elif args.command == "validate":
        return cmd_validate(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
