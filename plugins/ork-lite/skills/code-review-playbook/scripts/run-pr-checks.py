#!/usr/bin/env python3
"""
PR Code Quality Checker
Runs automated checks on PR changes and generates a review report
Usage: ./run-pr-checks.py <PR-number> [--json] [--fix]
"""

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class CheckResult:
    """Result of a single check."""

    name: str
    passed: bool
    severity: str  # error, warning, info
    message: str
    file: str | None = None
    line: int | None = None
    suggestion: str | None = None


@dataclass
class ReviewReport:
    """Complete review report."""

    pr_number: int
    checks: list[CheckResult] = field(default_factory=list)
    files_analyzed: int = 0
    issues_found: int = 0
    warnings: int = 0
    suggestions: int = 0

    def add_check(self, check: CheckResult) -> None:
        self.checks.append(check)
        if check.severity == "error":
            self.issues_found += 1
        elif check.severity == "warning":
            self.warnings += 1
        else:
            self.suggestions += 1

    @property
    def passed(self) -> bool:
        return self.issues_found == 0


def run_command(cmd: list[str], capture: bool = True) -> tuple[int, str, str]:
    """Run a command and return exit code, stdout, stderr."""
    try:
        result = subprocess.run(cmd, capture_output=capture, text=True, timeout=300)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except FileNotFoundError:
        return 1, "", f"Command not found: {cmd[0]}"


def get_pr_files(pr_number: int) -> list[str]:
    """Get list of changed files in PR."""
    code, stdout, _ = run_command(["gh", "pr", "diff", str(pr_number), "--name-only"])
    if code != 0:
        return []
    return [f for f in stdout.strip().split("\n") if f]


def get_pr_diff(pr_number: int) -> str:
    """Get the full diff of the PR."""
    code, stdout, _ = run_command(["gh", "pr", "diff", str(pr_number)])
    return stdout if code == 0 else ""


def check_security_patterns(files: list[str], diff: str, report: ReviewReport) -> None:
    """Check for common security issues."""

    # Patterns that indicate potential security issues
    security_patterns = [
        (r"password\s*=\s*['\"][^'\"]+['\"]", "Hardcoded password detected"),
        (r"api[_-]?key\s*=\s*['\"][^'\"]+['\"]", "Hardcoded API key detected"),
        (r"secret\s*=\s*['\"][^'\"]+['\"]", "Hardcoded secret detected"),
        (r"eval\s*\(", "Use of eval() - potential code injection"),
        (r"exec\s*\(", "Use of exec() - potential code injection"),
        (r"__import__\s*\(", "Dynamic import - review for security"),
        (r"subprocess\..*shell\s*=\s*True", "Shell=True in subprocess - command injection risk"),
        (r"\.format\(.*request\.", "String formatting with request data - potential injection"),
        (r"f['\"].*\{.*request\.", "f-string with request data - potential injection"),
        (r"SELECT.*\+.*request\.", "SQL string concatenation - SQL injection risk"),
        (r"innerHTML\s*=", "innerHTML assignment - XSS risk"),
        (r"dangerouslySetInnerHTML", "React dangerouslySetInnerHTML - XSS risk"),
    ]

    for pattern, message in security_patterns:
        matches = re.finditer(pattern, diff, re.IGNORECASE)
        for match in matches:
            # Find the line number in the diff
            line_num = diff[: match.start()].count("\n") + 1
            report.add_check(
                CheckResult(
                    name="security",
                    passed=False,
                    severity="error",
                    message=message,
                    line=line_num,
                    suggestion="Review and sanitize or remove sensitive data",
                )
            )


def check_code_quality(files: list[str], report: ReviewReport) -> None:
    """Run code quality checks on changed files."""

    python_files = [f for f in files if f.endswith(".py")]
    ts_files = [f for f in files if f.endswith((".ts", ".tsx"))]

    # Python: Run ruff if available
    if python_files:
        code, stdout, _ = run_command(["ruff", "check", "--output-format=json", *python_files])
        if code != 0 and stdout:
            try:
                issues = json.loads(stdout)
                for issue in issues[:20]:  # Limit to 20 issues
                    report.add_check(
                        CheckResult(
                            name="ruff",
                            passed=False,
                            severity="warning" if issue.get("code", "").startswith("W") else "error",
                            message=f"{issue.get('code', 'UNKNOWN')}: {issue.get('message', 'Unknown')}",
                            file=issue.get("filename"),
                            line=issue.get("location", {}).get("row"),
                        )
                    )
            except json.JSONDecodeError:
                pass

    # TypeScript: Run ESLint if available
    if ts_files:
        code, stdout, _ = run_command(["npx", "eslint", "--format=json", *ts_files])
        if stdout:
            try:
                results = json.loads(stdout)
                for file_result in results:
                    for msg in file_result.get("messages", [])[:10]:
                        report.add_check(
                            CheckResult(
                                name="eslint",
                                passed=False,
                                severity="error" if msg.get("severity") == 2 else "warning",
                                message=f"{msg.get('ruleId', 'unknown')}: {msg.get('message', '')}",
                                file=file_result.get("filePath"),
                                line=msg.get("line"),
                            )
                        )
            except json.JSONDecodeError:
                pass


def check_test_coverage(files: list[str], report: ReviewReport) -> None:
    """Check if tests exist for changed source files."""

    source_files = [f for f in files if not any(x in f for x in ["test", "spec", "__pycache__", "node_modules"])]

    for src_file in source_files:
        if src_file.endswith(".py"):
            # Look for corresponding test file
            test_patterns = [
                src_file.replace(".py", "_test.py"),
                src_file.replace(".py", "").replace("/", "/test_") + ".py",
                "tests/" + Path(src_file).name.replace(".py", "_test.py"),
            ]
            has_test = any(Path(p).exists() for p in test_patterns)

            if not has_test:
                report.add_check(
                    CheckResult(
                        name="test_coverage",
                        passed=False,
                        severity="warning",
                        message="No test file found for source file",
                        file=src_file,
                        suggestion=f"Consider adding tests: test_{Path(src_file).stem}.py",
                    )
                )


def check_documentation(files: list[str], diff: str, report: ReviewReport) -> None:
    """Check for documentation issues."""

    # Check for new functions without docstrings (Python)
    new_functions = re.findall(r"\+\s*def\s+(\w+)\([^)]*\):\s*\n(?!\s*['\"])", diff)
    for func_name in new_functions:
        if not func_name.startswith("_"):
            report.add_check(
                CheckResult(
                    name="documentation",
                    passed=False,
                    severity="info",
                    message=f"Function '{func_name}' missing docstring",
                    suggestion=f'Add docstring: def {func_name}(...):\n    """Description."""',
                )
            )

    # Check for TODO/FIXME in new code
    todo_matches = re.findall(r"\+.*(?:TODO|FIXME|XXX|HACK).*$", diff, re.MULTILINE)
    for match in todo_matches[:5]:
        report.add_check(
            CheckResult(
                name="documentation",
                passed=False,
                severity="info",
                message=f"TODO/FIXME found: {match[:80]}...",
                suggestion="Consider creating an issue to track this",
            )
        )


def check_best_practices(files: list[str], diff: str, report: ReviewReport) -> None:
    """Check for best practice violations."""

    # Large files
    for f in files:
        if Path(f).exists():
            lines = len(Path(f).read_text().split("\n"))
            if lines > 500:
                report.add_check(
                    CheckResult(
                        name="best_practices",
                        passed=False,
                        severity="warning",
                        message=f"Large file ({lines} lines) - consider splitting",
                        file=f,
                    )
                )

    # Print statements in Python
    if re.search(r"\+\s*print\s*\(", diff):
        report.add_check(
            CheckResult(
                name="best_practices",
                passed=False,
                severity="warning",
                message="print() statement found - use logging instead",
                suggestion="Replace with: import logging; logger.info(...)",
            )
        )

    # console.log in TypeScript/JavaScript
    if re.search(r"\+\s*console\.(log|debug|info)", diff):
        report.add_check(
            CheckResult(
                name="best_practices",
                passed=False,
                severity="warning",
                message="console.log found - consider using structured logging",
            )
        )

    # Commented out code
    commented_code = re.findall(r"\+\s*#\s*(def |class |import |from |if |for |while )", diff)
    if len(commented_code) > 3:
        report.add_check(
            CheckResult(
                name="best_practices",
                passed=False,
                severity="info",
                message="Multiple commented-out code blocks detected",
                suggestion="Remove dead code - use version control instead",
            )
        )


def generate_report(report: ReviewReport, output_format: str) -> str:
    """Generate the review report."""

    if output_format == "json":
        return json.dumps(
            {
                "pr_number": report.pr_number,
                "passed": report.passed,
                "summary": {
                    "files_analyzed": report.files_analyzed,
                    "errors": report.issues_found,
                    "warnings": report.warnings,
                    "suggestions": report.suggestions,
                },
                "checks": [
                    {
                        "name": c.name,
                        "passed": c.passed,
                        "severity": c.severity,
                        "message": c.message,
                        "file": c.file,
                        "line": c.line,
                        "suggestion": c.suggestion,
                    }
                    for c in report.checks
                ],
            },
            indent=2,
        )

    # Text format
    lines = [
        "=" * 60,
        f"        PR #{report.pr_number} AUTOMATED REVIEW REPORT",
        "=" * 60,
        "",
        "SUMMARY",
        "-" * 40,
        f"Files Analyzed:  {report.files_analyzed}",
        f"Errors:          {report.issues_found}",
        f"Warnings:        {report.warnings}",
        f"Suggestions:     {report.suggestions}",
        f"Status:          {'PASSED' if report.passed else 'NEEDS ATTENTION'}",
        "",
    ]

    # Group checks by category
    categories = {}
    for check in report.checks:
        if check.name not in categories:
            categories[check.name] = []
        categories[check.name].append(check)

    for category, checks in sorted(categories.items()):
        lines.append(f"{category.upper()}")
        lines.append("-" * 40)

        for check in checks:
            icon = "E" if check.severity == "error" else ("W" if check.severity == "warning" else "I")
            location = ""
            if check.file:
                location = f" [{check.file}"
                if check.line:
                    location += f":{check.line}"
                location += "]"

            lines.append(f"  [{icon}]{location} {check.message}")
            if check.suggestion:
                lines.append(f"      Suggestion: {check.suggestion}")

        lines.append("")

    lines.append("=" * 60)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Run automated PR checks")
    parser.add_argument("pr_number", type=int, help="PR number to check")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--fix", action="store_true", help="Attempt to auto-fix issues")
    args = parser.parse_args()

    # Check gh CLI is available
    code, _, _ = run_command(["gh", "--version"])
    if code != 0:
        print("Error: GitHub CLI (gh) not found", file=sys.stderr)
        sys.exit(1)

    report = ReviewReport(pr_number=args.pr_number)

    # Get PR files and diff
    files = get_pr_files(args.pr_number)
    if not files:
        print(f"Error: Could not get files for PR #{args.pr_number}", file=sys.stderr)
        sys.exit(1)

    diff = get_pr_diff(args.pr_number)
    report.files_analyzed = len(files)

    # Run all checks
    check_security_patterns(files, diff, report)
    check_code_quality(files, report)
    check_test_coverage(files, report)
    check_documentation(files, diff, report)
    check_best_practices(files, diff, report)

    # Generate and print report
    output_format = "json" if args.json else "text"
    print(generate_report(report, output_format))

    # Exit with appropriate code
    sys.exit(0 if report.passed else 1)


if __name__ == "__main__":
    main()
