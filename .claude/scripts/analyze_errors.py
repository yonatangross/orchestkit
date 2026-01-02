#!/usr/bin/env python3
"""
Error Pattern Analyzer - Batch job for detecting bad coding practices.

Runs nightly (cron) to analyze errors.jsonl and generate:
1. Error clusters (similar errors grouped)
2. Pattern rules (regex for prevention)
3. Fix suggestions (optional LLM call for new patterns)

Cost: ~$0 (local Ollama for embeddings) or ~$0.01 per new pattern (Haiku)

Usage:
    python analyze_errors.py                    # Analyze last 24h
    python analyze_errors.py --days 7           # Analyze last 7 days
    python analyze_errors.py --generate-rules   # Generate new rules (uses LLM)

Cron setup:
    0 2 * * * cd /path/to/SkillForge && poetry run python .claude/scripts/analyze_errors.py
"""

import json
import hashlib
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

# Paths
CLAUDE_DIR = Path(__file__).parent.parent
ERRORS_LOG = CLAUDE_DIR / "logs" / "errors.jsonl"
RULES_FILE = CLAUDE_DIR / "rules" / "error_rules.json"
CLUSTERS_FILE = CLAUDE_DIR / "logs" / "error_clusters.json"
REPORT_FILE = CLAUDE_DIR / "logs" / "daily_error_report.md"


def load_errors(days: int = 1) -> list[dict]:
    """Load errors from the last N days."""
    if not ERRORS_LOG.exists():
        return []

    cutoff = datetime.now() - timedelta(days=days)
    errors = []

    with open(ERRORS_LOG) as f:
        for line in f:
            try:
                error = json.loads(line.strip())
                ts = datetime.fromisoformat(error.get("timestamp", "").replace("Z", "+00:00"))
                if ts.replace(tzinfo=None) > cutoff:
                    errors.append(error)
            except (json.JSONDecodeError, ValueError):
                continue

    return errors


def extract_error_signature(error: dict) -> str:
    """Extract a normalizable signature from an error."""
    msg = error.get("error_message", "")

    # Normalize common patterns
    # Replace specific values with placeholders
    normalized = msg
    normalized = re.sub(r"role \"[^\"]+\"", 'role "X"', normalized)
    normalized = re.sub(r"relation \"[^\"]+\"", 'relation "X"', normalized)
    normalized = re.sub(r"database \"[^\"]+\"", 'database "X"', normalized)
    normalized = re.sub(r"table \"[^\"]+\"", 'table "X"', normalized)
    normalized = re.sub(r"file \"[^\"]+\"", 'file "X"', normalized)
    normalized = re.sub(r"path \"[^\"]+\"", 'path "X"', normalized)
    normalized = re.sub(r"port \d+", "port N", normalized)
    normalized = re.sub(r"line \d+", "line N", normalized)
    normalized = re.sub(r"/[^\s]+", "/PATH", normalized)  # File paths
    normalized = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", "DATE", normalized)  # Dates
    normalized = re.sub(r"\b\d+\b", "N", normalized)  # Numbers

    return normalized.strip()


def cluster_errors(errors: list[dict]) -> dict[str, list[dict]]:
    """Group errors by their normalized signature."""
    clusters = defaultdict(list)

    for error in errors:
        signature = extract_error_signature(error)
        cluster_key = hashlib.md5(signature.encode()).hexdigest()[:8]
        clusters[cluster_key].append({
            "error": error,
            "signature": signature,
        })

    return dict(clusters)


def generate_pattern_rules(clusters: dict[str, list[dict]]) -> list[dict]:
    """Generate regex-based prevention rules from clusters."""
    rules = []

    for cluster_id, items in clusters.items():
        if len(items) < 2:
            continue  # Only generate rules for repeated errors

        signature = items[0]["signature"]
        sample_error = items[0]["error"]

        # Generate regex pattern from signature
        pattern = re.escape(signature)
        pattern = pattern.replace(r'"X"', r'"[^"]+"')
        pattern = pattern.replace("N", r"\d+")
        pattern = pattern.replace(r"/PATH", r"/[^\s]+")

        rule = {
            "id": cluster_id,
            "pattern": pattern,
            "signature": signature,
            "tool": sample_error.get("tool"),
            "occurrence_count": len(items),
            "first_seen": min(i["error"].get("timestamp", "") for i in items),
            "last_seen": max(i["error"].get("timestamp", "") for i in items),
            "sample_input": sample_error.get("tool_input"),
            "fix_suggestion": None,  # To be filled by LLM if --generate-rules
        }

        rules.append(rule)

    return sorted(rules, key=lambda r: r["occurrence_count"], reverse=True)


def load_existing_rules() -> list[dict]:
    """Load existing rules from file."""
    if not RULES_FILE.exists():
        return []
    try:
        with open(RULES_FILE) as f:
            return json.load(f).get("rules", [])
    except (json.JSONDecodeError, KeyError):
        return []


def save_rules(rules: list[dict]) -> None:
    """Save rules to file."""
    RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RULES_FILE, "w") as f:
        json.dump({
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "rules": rules,
        }, f, indent=2)


def generate_report(errors: list[dict], clusters: dict, rules: list[dict]) -> str:
    """Generate a human-readable markdown report."""
    report = f"""# Error Analysis Report

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Period:** Last 24 hours
**Total Errors:** {len(errors)}
**Unique Patterns:** {len(clusters)}
**Rules Generated:** {len(rules)}

## Top Error Patterns

| Pattern | Count | Tool | Sample Message |
|---------|-------|------|----------------|
"""

    for rule in rules[:10]:
        msg_preview = rule["signature"][:50] + "..." if len(rule["signature"]) > 50 else rule["signature"]
        report += f"| {rule['id']} | {rule['occurrence_count']} | {rule['tool']} | {msg_preview} |\n"

    report += "\n## Error Distribution by Tool\n\n"
    tool_counts = Counter(e.get("tool") for e in errors)
    for tool, count in tool_counts.most_common():
        report += f"- **{tool}**: {count} errors\n"

    report += "\n## Recommendations\n\n"
    for rule in rules[:5]:
        if rule["occurrence_count"] >= 3:
            report += f"- **{rule['id']}** ({rule['occurrence_count']}x): Pattern `{rule['signature'][:60]}...`\n"
            report += f"  - Tool: {rule['tool']}\n"
            if rule.get("fix_suggestion"):
                report += f"  - Fix: {rule['fix_suggestion']}\n"

    return report


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Analyze error patterns from Claude Code sessions")
    parser.add_argument("--days", type=int, default=1, help="Number of days to analyze")
    parser.add_argument("--generate-rules", action="store_true", help="Generate rules (may use LLM)")
    parser.add_argument("--report", action="store_true", help="Generate markdown report")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of text")
    args = parser.parse_args()

    # Load and analyze errors
    errors = load_errors(days=args.days)
    if not errors:
        print("No errors found in the specified period.")
        return

    print(f"Found {len(errors)} errors from last {args.days} day(s)")

    # Cluster errors
    clusters = cluster_errors(errors)
    print(f"Grouped into {len(clusters)} unique patterns")

    # Save clusters
    CLUSTERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CLUSTERS_FILE, "w") as f:
        json.dump({
            "analyzed_at": datetime.now().isoformat(),
            "error_count": len(errors),
            "cluster_count": len(clusters),
            "clusters": {k: len(v) for k, v in clusters.items()},
        }, f, indent=2)

    # Generate rules
    rules = generate_pattern_rules(clusters)
    existing_rules = load_existing_rules()
    existing_ids = {r["id"] for r in existing_rules}

    new_rules = [r for r in rules if r["id"] not in existing_ids]
    if new_rules:
        print(f"Found {len(new_rules)} new error patterns")

        if args.generate_rules:
            # TODO: Call Haiku API for fix suggestions
            print("Rule generation with LLM not yet implemented")
            print("New patterns will be saved without fix suggestions")

        # Merge and save rules
        all_rules = existing_rules + new_rules
        save_rules(all_rules)
        print(f"Saved {len(all_rules)} total rules to {RULES_FILE}")

    # Generate report
    if args.report:
        report = generate_report(errors, clusters, rules)
        REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(REPORT_FILE, "w") as f:
            f.write(report)
        print(f"Report saved to {REPORT_FILE}")

    # Output
    if args.json:
        print(json.dumps({
            "errors": len(errors),
            "clusters": len(clusters),
            "new_patterns": len(new_rules),
            "top_patterns": [
                {"id": r["id"], "count": r["occurrence_count"], "tool": r["tool"]}
                for r in rules[:5]
            ],
        }, indent=2))
    else:
        print("\nTop error patterns:")
        for rule in rules[:5]:
            print(f"  [{rule['id']}] {rule['tool']}: {rule['signature'][:60]}... ({rule['occurrence_count']}x)")


if __name__ == "__main__":
    main()
