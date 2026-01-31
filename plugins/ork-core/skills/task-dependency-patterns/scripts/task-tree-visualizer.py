#!/usr/bin/env python3
"""
Task Tree Visualizer

Generates ASCII dependency tree from task list JSON.

Usage:
    echo '<task_list_json>' | python task-tree-visualizer.py
    python task-tree-visualizer.py --sample  # Show sample output

Input format (TaskList output):
{
  "tasks": [
    {"id": "1", "subject": "Task A", "status": "completed", "blockedBy": []},
    {"id": "2", "subject": "Task B", "status": "in_progress", "blockedBy": ["1"]},
    {"id": "3", "subject": "Task C", "status": "pending", "blockedBy": ["1"]},
    {"id": "4", "subject": "Task D", "status": "pending", "blockedBy": ["2", "3"]}
  ]
}

Output:
┌─ Task Dependency Tree ─────────────────────────────┐
│                                                    │
│  #1 [completed] Task A                             │
│   ├─→ #2 [in_progress] Task B                      │
│   │    └─→ #4 [pending] Task D                     │
│   └─→ #3 [pending] Task C                          │
│        └─→ #4 [pending] Task D                     │
│                                                    │
└────────────────────────────────────────────────────┘
"""

import json
import sys
from typing import Any


def status_icon(status: str) -> str:
    """Return status indicator."""
    icons = {
        "completed": "[done]",
        "in_progress": "[>>>]",
        "pending": "[...]",
    }
    return icons.get(status, "[???]")


def build_tree(tasks: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Build adjacency list: task_id -> list of tasks it unblocks."""
    tree: dict[str, list[str]] = {t["id"]: [] for t in tasks}
    tree["ROOT"] = []

    for task in tasks:
        if not task.get("blockedBy"):
            tree["ROOT"].append(task["id"])
        else:
            for blocker in task["blockedBy"]:
                if blocker in tree:
                    tree[blocker].append(task["id"])

    return tree


def render_tree(
    tasks: list[dict[str, Any]],
    tree: dict[str, list[str]],
    node: str = "ROOT",
    prefix: str = "",
    visited: set[str] | None = None,
) -> list[str]:
    """Render tree as ASCII lines."""
    if visited is None:
        visited = set()

    lines: list[str] = []
    children = tree.get(node, [])

    for i, child_id in enumerate(children):
        is_last = i == len(children) - 1
        task = next((t for t in tasks if t["id"] == child_id), None)

        if task is None:
            continue

        # Prevent infinite loops from circular dependencies
        if child_id in visited:
            connector = "└─" if is_last else "├─"
            lines.append(f"{prefix}{connector}→ #{child_id} (circular ref)")
            continue

        visited.add(child_id)

        connector = "└─" if is_last else "├─"
        status = status_icon(task.get("status", "pending"))
        subject = task.get("subject", "Untitled")[:40]

        lines.append(f"{prefix}{connector}→ #{child_id} {status} {subject}")

        # Recurse to children
        child_prefix = prefix + ("   " if is_last else "│  ")
        lines.extend(
            render_tree(tasks, tree, child_id, child_prefix, visited.copy())
        )

    return lines


def visualize(task_json: str) -> str:
    """Generate ASCII visualization from JSON."""
    try:
        data = json.loads(task_json)
        tasks = data.get("tasks", data) if isinstance(data, dict) else data
    except json.JSONDecodeError as e:
        return f"Error parsing JSON: {e}"

    if not tasks:
        return "No tasks to visualize"

    tree = build_tree(tasks)
    lines = render_tree(tasks, tree)

    # Build output box
    max_width = max(len(line) for line in lines) if lines else 40
    box_width = max(max_width + 4, 50)

    output = [
        "+" + "-" * (box_width - 2) + "+",
        "|" + " Task Dependency Tree".center(box_width - 2) + "|",
        "|" + " " * (box_width - 2) + "|",
    ]

    for line in lines:
        output.append("|  " + line.ljust(box_width - 4) + "|")

    output.extend(
        [
            "|" + " " * (box_width - 2) + "|",
            "+" + "-" * (box_width - 2) + "+",
        ]
    )

    return "\n".join(output)


def sample_output() -> str:
    """Generate sample visualization."""
    sample = {
        "tasks": [
            {"id": "1", "subject": "Create User model", "status": "completed", "blockedBy": []},
            {"id": "2", "subject": "Add auth endpoints", "status": "in_progress", "blockedBy": ["1"]},
            {"id": "3", "subject": "Implement JWT tokens", "status": "pending", "blockedBy": ["2"]},
            {"id": "4", "subject": "Add auth middleware", "status": "pending", "blockedBy": ["3"]},
            {"id": "5", "subject": "Write integration tests", "status": "pending", "blockedBy": ["4"]},
        ]
    }
    return visualize(json.dumps(sample))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--sample":
        print(sample_output())
    elif not sys.stdin.isatty():
        input_json = sys.stdin.read()
        print(visualize(input_json))
    else:
        print("Usage: echo '<json>' | python task-tree-visualizer.py")
        print("       python task-tree-visualizer.py --sample")
        sys.exit(1)
