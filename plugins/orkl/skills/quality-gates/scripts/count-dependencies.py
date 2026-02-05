#!/usr/bin/env python3
"""
Dependency Counter and Categorizer
Analyzes project dependencies from various package managers
Usage: ./count-dependencies.py [path] [--json] [--verbose]
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


def parse_requirements_txt(path: Path) -> list[dict[str, Any]]:
    """Parse Python requirements.txt file."""
    deps = []
    if not path.exists():
        return deps

    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue

            # Parse package name and version
            match = re.match(r"^([a-zA-Z0-9_-]+)([<>=!~]+.*)?$", line.split("[")[0])
            if match:
                name = match.group(1)
                version = match.group(2) or ""
                deps.append({
                    "name": name,
                    "version": version.strip(),
                    "source": "requirements.txt",
                    "type": categorize_python_dep(name),
                })

    return deps


def parse_pyproject_toml(path: Path) -> list[dict[str, Any]]:
    """Parse Python pyproject.toml file."""
    deps = []
    if not path.exists():
        return deps

    try:
        import tomllib
    except ImportError:
        try:
            import toml as tomllib  # type: ignore
        except ImportError:
            # Fallback to regex parsing
            return parse_pyproject_toml_regex(path)

    with path.open("rb") as f:
        data = tomllib.load(f)

    # Get dependencies from [project.dependencies]
    project_deps = data.get("project", {}).get("dependencies", [])
    for dep in project_deps:
        match = re.match(r"^([a-zA-Z0-9_-]+)", dep)
        if match:
            name = match.group(1)
            deps.append({
                "name": name,
                "version": dep.replace(name, "").strip(),
                "source": "pyproject.toml",
                "type": categorize_python_dep(name),
            })

    # Get optional dependencies
    optional = data.get("project", {}).get("optional-dependencies", {})
    for group, group_deps in optional.items():
        for dep in group_deps:
            match = re.match(r"^([a-zA-Z0-9_-]+)", dep)
            if match:
                name = match.group(1)
                deps.append({
                    "name": name,
                    "version": dep.replace(name, "").strip(),
                    "source": f"pyproject.toml[{group}]",
                    "type": categorize_python_dep(name),
                    "optional": True,
                })

    return deps


def parse_pyproject_toml_regex(path: Path) -> list[dict[str, Any]]:
    """Fallback regex parsing for pyproject.toml."""
    deps = []
    content = path.read_text()

    # Find dependencies section
    in_deps = False
    for line in content.split("\n"):
        if "dependencies" in line and "=" in line:
            in_deps = True
            continue
        if in_deps:
            if line.strip().startswith("]"):
                in_deps = False
                continue
            match = re.search(r'"([a-zA-Z0-9_-]+)', line)
            if match:
                name = match.group(1)
                deps.append({
                    "name": name,
                    "source": "pyproject.toml",
                    "type": categorize_python_dep(name),
                })

    return deps


def parse_package_json(path: Path) -> list[dict[str, Any]]:
    """Parse Node.js package.json file."""
    deps = []
    if not path.exists():
        return deps

    with path.open() as f:
        data = json.load(f)

    for dep_type in ["dependencies", "devDependencies", "peerDependencies"]:
        for name, version in data.get(dep_type, {}).items():
            deps.append({
                "name": name,
                "version": version,
                "source": f"package.json ({dep_type})",
                "type": categorize_node_dep(name),
                "dev": dep_type == "devDependencies",
            })

    return deps


def parse_go_mod(path: Path) -> list[dict[str, Any]]:
    """Parse Go go.mod file."""
    deps = []
    if not path.exists():
        return deps

    with path.open() as f:
        in_require = False
        for line in f:
            line = line.strip()
            if line.startswith("require ("):
                in_require = True
                continue
            if line == ")":
                in_require = False
                continue
            if in_require or line.startswith("require "):
                match = re.search(r"([^\s]+)\s+([^\s]+)", line)
                if match:
                    deps.append({
                        "name": match.group(1),
                        "version": match.group(2),
                        "source": "go.mod",
                        "type": "library",
                    })

    return deps


def categorize_python_dep(name: str) -> str:
    """Categorize Python dependency by type."""
    name_lower = name.lower()

    # Testing
    if any(x in name_lower for x in ["pytest", "test", "mock", "coverage", "hypothesis"]):
        return "testing"

    # Web frameworks
    if any(x in name_lower for x in ["fastapi", "django", "flask", "starlette", "uvicorn", "gunicorn"]):
        return "web-framework"

    # Database
    if any(x in name_lower for x in ["sqlalchemy", "psycopg", "asyncpg", "redis", "mongo", "alembic"]):
        return "database"

    # AI/ML
    if any(x in name_lower for x in ["langchain", "openai", "anthropic", "torch", "tensorflow", "transformers", "langfuse"]):
        return "ai-ml"

    # HTTP/API
    if any(x in name_lower for x in ["httpx", "requests", "aiohttp", "pydantic"]):
        return "http-api"

    # Development
    if any(x in name_lower for x in ["black", "ruff", "mypy", "isort", "pre-commit", "lint"]):
        return "development"

    return "library"


def categorize_node_dep(name: str) -> str:
    """Categorize Node.js dependency by type."""
    name_lower = name.lower()

    # Testing
    if any(x in name_lower for x in ["jest", "vitest", "mocha", "chai", "testing-library", "playwright", "cypress"]):
        return "testing"

    # React ecosystem
    if any(x in name_lower for x in ["react", "next", "redux", "zustand"]):
        return "react"

    # Vue ecosystem
    if any(x in name_lower for x in ["vue", "nuxt", "pinia"]):
        return "vue"

    # Build tools
    if any(x in name_lower for x in ["webpack", "vite", "rollup", "esbuild", "babel", "typescript"]):
        return "build-tool"

    # UI libraries
    if any(x in name_lower for x in ["tailwind", "shadcn", "radix", "mui", "chakra"]):
        return "ui-library"

    # Development
    if any(x in name_lower for x in ["eslint", "prettier", "lint"]):
        return "development"

    return "library"


def analyze_dependencies(project_path: Path) -> dict[str, Any]:
    """Analyze all dependencies in a project."""
    all_deps = []

    # Python
    all_deps.extend(parse_requirements_txt(project_path / "requirements.txt"))
    all_deps.extend(parse_pyproject_toml(project_path / "pyproject.toml"))

    # Node.js
    all_deps.extend(parse_package_json(project_path / "package.json"))

    # Go
    all_deps.extend(parse_go_mod(project_path / "go.mod"))

    # Categorize
    categories: dict[str, list[str]] = {}
    for dep in all_deps:
        dep_type = dep.get("type", "library")
        if dep_type not in categories:
            categories[dep_type] = []
        categories[dep_type].append(dep["name"])

    # Remove duplicates within categories
    for cat in categories:
        categories[cat] = sorted(set(categories[cat]))

    return {
        "total": len(all_deps),
        "unique": len(set(d["name"] for d in all_deps)),
        "by_source": {
            "python": len([d for d in all_deps if "pyproject" in d["source"] or "requirements" in d["source"]]),
            "node": len([d for d in all_deps if "package.json" in d["source"]]),
            "go": len([d for d in all_deps if "go.mod" in d["source"]]),
        },
        "by_category": {cat: len(deps) for cat, deps in categories.items()},
        "categories": categories,
        "dependencies": all_deps,
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze project dependencies")
    parser.add_argument("path", nargs="?", default=".", help="Project path to analyze")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all dependencies")
    args = parser.parse_args()

    project_path = Path(args.path).resolve()
    if not project_path.exists():
        print(f"Error: Path '{project_path}' does not exist", file=sys.stderr)
        sys.exit(1)

    result = analyze_dependencies(project_path)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("=" * 60)
        print("              DEPENDENCY ANALYSIS")
        print("=" * 60)
        print(f"\nProject: {project_path}\n")

        print("SUMMARY")
        print("-" * 40)
        print(f"Total Dependencies:     {result['total']}")
        print(f"Unique Packages:        {result['unique']}")
        print()

        print("BY SOURCE")
        print("-" * 40)
        for source, count in result["by_source"].items():
            if count > 0:
                print(f"  {source.capitalize():20} {count}")
        print()

        print("BY CATEGORY")
        print("-" * 40)
        for cat, count in sorted(result["by_category"].items(), key=lambda x: -x[1]):
            print(f"  {cat:20} {count}")
        print()

        if args.verbose:
            print("ALL DEPENDENCIES")
            print("-" * 40)
            for cat, deps in sorted(result["categories"].items()):
                print(f"\n[{cat}]")
                for dep in deps:
                    print(f"  - {dep}")

        # Risk assessment
        print("\nRISK ASSESSMENT")
        print("-" * 40)

        total = result["unique"]
        if total < 10:
            print("  LOW RISK: Few dependencies, easy to maintain")
        elif total < 30:
            print("  MODERATE RISK: Reasonable dependency count")
        elif total < 60:
            print("  ELEVATED RISK: Many dependencies to track")
        else:
            print("  HIGH RISK: Large dependency tree, consider audit")

        ai_deps = result["by_category"].get("ai-ml", 0)
        if ai_deps > 0:
            print(f"  NOTE: {ai_deps} AI/ML dependencies detected - check for API key security")

        dev_deps = result["by_category"].get("development", 0)
        if dev_deps > total * 0.3:
            print(f"  NOTE: {dev_deps} dev dependencies ({int(dev_deps/total*100)}%) - ensure proper separation")

        print()
        print("=" * 60)


if __name__ == "__main__":
    main()
