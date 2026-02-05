#!/usr/bin/env python3
"""
Golden Dataset Diversity Checker

Analyzes the composition of a golden dataset and provides recommendations
for maintaining balance across domains and difficulty levels.

Usage:
    python diversity-checker.py [--fixtures-path PATH]
"""

import json
import argparse
from pathlib import Path
from collections import Counter
from typing import TypedDict


class Document(TypedDict, total=False):
    id: str
    domain: str
    difficulty: str
    url: str


# Target distributions (percentages)
DOMAIN_TARGETS = {
    "AI/ML": 25,
    "Backend": 20,
    "Frontend": 20,
    "DevOps": 15,
    "Security": 10,
    "Other": 10,
}

DIFFICULTY_TARGETS = {
    "trivial": 10,
    "easy": 25,
    "medium": 35,
    "hard": 20,
    "adversarial": 10,
}


def load_documents(fixtures_path: Path) -> list[Document]:
    """Load documents from golden dataset fixtures."""
    documents: list[Document] = []

    if not fixtures_path.exists():
        print(f"Warning: Fixtures path {fixtures_path} not found")
        return documents

    for file in fixtures_path.glob("*.json"):
        try:
            with open(file) as f:
                data = json.load(f)
                if isinstance(data, list):
                    documents.extend(data)
                elif isinstance(data, dict) and "documents" in data:
                    documents.extend(data["documents"])
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load {file}: {e}")

    return documents


def calculate_distribution(
    documents: list[Document], key: str
) -> dict[str, dict[str, int | float]]:
    """Calculate actual distribution for a given key."""
    counts = Counter(doc.get(key, "Other") for doc in documents)
    total = len(documents) if documents else 1

    return {
        category: {"count": count, "percentage": round(count / total * 100, 1)}
        for category, count in counts.items()
    }


def get_status(actual: float, target: float, threshold: float = 5.0) -> str:
    """Determine status based on deviation from target."""
    diff = actual - target
    if abs(diff) <= threshold:
        return "OK"
    return "HIGH" if diff > 0 else "LOW"


def print_bar(percentage: float, width: int = 20) -> str:
    """Generate ASCII bar chart."""
    filled = int(percentage / 100 * width)
    return "[" + "#" * filled + "-" * (width - filled) + "]"


def analyze_diversity(documents: list[Document]) -> dict:
    """Analyze dataset diversity and generate recommendations."""
    domain_dist = calculate_distribution(documents, "domain")
    difficulty_dist = calculate_distribution(documents, "difficulty")

    recommendations = {"underrepresented": [], "overrepresented": []}

    # Check domains
    for domain, target in DOMAIN_TARGETS.items():
        actual = domain_dist.get(domain, {"percentage": 0})["percentage"]
        status = get_status(actual, target)
        if status == "LOW":
            recommendations["underrepresented"].append(f"Domain: {domain}")
        elif status == "HIGH":
            recommendations["overrepresented"].append(f"Domain: {domain}")

    # Check difficulties
    for difficulty, target in DIFFICULTY_TARGETS.items():
        actual = difficulty_dist.get(difficulty, {"percentage": 0})["percentage"]
        status = get_status(actual, target)
        if status == "LOW":
            recommendations["underrepresented"].append(f"Difficulty: {difficulty}")
        elif status == "HIGH":
            recommendations["overrepresented"].append(f"Difficulty: {difficulty}")

    return {
        "total_documents": len(documents),
        "domain_distribution": domain_dist,
        "difficulty_distribution": difficulty_dist,
        "recommendations": recommendations,
    }


def print_report(analysis: dict) -> None:
    """Print diversity report to stdout."""
    print("\n" + "=" * 50)
    print("GOLDEN DATASET DIVERSITY REPORT")
    print("=" * 50)
    print(f"\nTotal Documents: {analysis['total_documents']}\n")

    # Domain distribution
    print("DOMAIN DISTRIBUTION")
    print("-" * 50)
    for domain, target in DOMAIN_TARGETS.items():
        data = analysis["domain_distribution"].get(domain, {"count": 0, "percentage": 0})
        status = get_status(data["percentage"], target)
        bar = print_bar(data["percentage"])
        print(f"{domain:12} {bar} {data['percentage']:5.1f}% (target: {target}%) [{status}]")

    # Difficulty distribution
    print("\nDIFFICULTY DISTRIBUTION")
    print("-" * 50)
    for difficulty, target in DIFFICULTY_TARGETS.items():
        data = analysis["difficulty_distribution"].get(
            difficulty, {"count": 0, "percentage": 0}
        )
        status = get_status(data["percentage"], target)
        bar = print_bar(data["percentage"])
        print(f"{difficulty:12} {bar} {data['percentage']:5.1f}% (target: {target}%) [{status}]")

    # Recommendations
    print("\nRECOMMENDATIONS")
    print("-" * 50)
    recs = analysis["recommendations"]
    if recs["underrepresented"]:
        print("Priority Add (underrepresented):")
        for item in recs["underrepresented"]:
            print(f"  - {item}")
    if recs["overrepresented"]:
        print("Avoid Adding (overrepresented):")
        for item in recs["overrepresented"]:
            print(f"  - {item}")
    if not recs["underrepresented"] and not recs["overrepresented"]:
        print("Dataset is well-balanced!")


def main():
    parser = argparse.ArgumentParser(description="Analyze golden dataset diversity")
    parser.add_argument(
        "--fixtures-path",
        type=Path,
        default=Path("tests/fixtures/golden"),
        help="Path to golden dataset fixtures",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON instead of formatted report",
    )
    args = parser.parse_args()

    documents = load_documents(args.fixtures_path)
    analysis = analyze_diversity(documents)

    if args.json:
        print(json.dumps(analysis, indent=2))
    else:
        print_report(analysis)


if __name__ == "__main__":
    main()
