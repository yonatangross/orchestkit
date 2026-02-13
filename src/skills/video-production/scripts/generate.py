#!/usr/bin/env python3
"""
Manim Visualizer CLI

Generate animated visualizations for OrchestKit demo videos.

Usage:
    python generate.py agent-spawning --agents "code-reviewer,security-auditor,test-generator" --output ./out/agents.mp4
    python generate.py task-dependency --preset verify --output ./out/deps.mp4
    python generate.py workflow --phases "Analyze,Test,Deploy" --output ./out/workflow.mp4

Examples:
    # Generate 3-agent spawning animation
    python generate.py agent-spawning --agents "code-reviewer,security-auditor,test-generator"

    # Generate 6-agent spawning for verify demo
    python generate.py agent-spawning --preset verify

    # Generate task dependency graph
    python generate.py task-dependency --preset verify

    # Custom task dependencies
    python generate.py task-dependency --tasks '[{"id":"1","name":"Build"},{"id":"2","name":"Test","blockedBy":["1"]}]'
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add the scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from manim import config


def setup_manim_config(width: int = 1920, height: int = 400, fps: int = 30, output: str = None):
    """Configure Manim rendering settings."""
    config.pixel_width = width
    config.pixel_height = height
    config.frame_rate = fps
    config.background_color = "#0a0a0f"

    if output:
        output_path = Path(output)
        config.output_file = output_path.name
        config.media_dir = str(output_path.parent / "media")
        config.video_dir = str(output_path.parent)


def render_agent_spawning(args):
    """Render agent spawning animation."""
    from agent_spawning import AgentSpawning, AgentSpawningSixAgents

    # Determine agents
    if args.preset == "verify" or args.preset == "review-pr":
        scene_class = AgentSpawningSixAgents
        agents = None
    elif args.agents:
        scene_class = AgentSpawning
        agents = [a.strip() for a in args.agents.split(",")]
    else:
        scene_class = AgentSpawning
        agents = ["code-reviewer", "security-auditor", "test-generator"]

    # Configure output
    setup_manim_config(
        width=args.width or 1920,
        height=args.height or 400,
        fps=args.fps or 30,
        output=args.output
    )

    # Render
    print(f"Rendering agent spawning animation...")
    print(f"  Agents: {agents or '6 agents (preset)'}")
    print(f"  Output: {args.output or 'default'}")

    if agents:
        scene = AgentSpawning(agents=agents)
    else:
        scene = scene_class()

    scene.render()
    print("Done!")


def render_task_dependency(args):
    """Render task dependency graph animation."""
    from task_dependency import TaskDependencyGraph, TaskDependencyVerify

    # Determine tasks
    if args.preset == "verify":
        scene_class = TaskDependencyVerify
        tasks = None
    elif args.tasks:
        try:
            tasks = json.loads(args.tasks)
            scene_class = TaskDependencyGraph
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON for tasks: {args.tasks}")
            sys.exit(1)
    else:
        # Default tasks
        scene_class = TaskDependencyGraph
        tasks = None

    # Configure output
    setup_manim_config(
        width=args.width or 1920,
        height=args.height or 600,
        fps=args.fps or 30,
        output=args.output
    )

    # Render
    print(f"Rendering task dependency graph...")
    print(f"  Output: {args.output or 'default'}")

    if tasks:
        scene = TaskDependencyGraph(tasks=tasks)
    else:
        scene = scene_class()

    scene.render()
    print("Done!")


def render_workflow(args):
    """Render workflow pipeline animation."""
    # This would use a WorkflowPipeline scene
    print("Workflow animation not yet implemented")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate Manim visualizations for OrchestKit demos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest="command", help="Visualization type")

    # Agent spawning subcommand
    agent_parser = subparsers.add_parser(
        "agent-spawning",
        help="Generate parallel agent spawning animation"
    )
    agent_parser.add_argument(
        "--agents",
        help="Comma-separated list of agent names"
    )
    agent_parser.add_argument(
        "--preset",
        choices=["verify", "review-pr"],
        help="Use a preset agent configuration"
    )
    agent_parser.add_argument("--output", "-o", help="Output file path")
    agent_parser.add_argument("--width", type=int, help="Output width (default: 1920)")
    agent_parser.add_argument("--height", type=int, help="Output height (default: 400)")
    agent_parser.add_argument("--fps", type=int, help="Frame rate (default: 30)")

    # Task dependency subcommand
    task_parser = subparsers.add_parser(
        "task-dependency",
        help="Generate task dependency graph animation"
    )
    task_parser.add_argument(
        "--tasks",
        help='JSON array of tasks: [{"id":"1","name":"Task","blockedBy":[]}]'
    )
    task_parser.add_argument(
        "--preset",
        choices=["verify", "review-pr", "implement"],
        help="Use a preset task configuration"
    )
    task_parser.add_argument("--output", "-o", help="Output file path")
    task_parser.add_argument("--width", type=int, help="Output width (default: 1920)")
    task_parser.add_argument("--height", type=int, help="Output height (default: 600)")
    task_parser.add_argument("--fps", type=int, help="Frame rate (default: 30)")

    # Workflow subcommand
    workflow_parser = subparsers.add_parser(
        "workflow",
        help="Generate workflow pipeline animation"
    )
    workflow_parser.add_argument(
        "--phases",
        help="Comma-separated list of phase names"
    )
    workflow_parser.add_argument("--output", "-o", help="Output file path")
    workflow_parser.add_argument("--width", type=int, help="Output width (default: 1920)")
    workflow_parser.add_argument("--height", type=int, help="Output height (default: 400)")
    workflow_parser.add_argument("--fps", type=int, help="Frame rate (default: 30)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Route to appropriate renderer
    if args.command == "agent-spawning":
        render_agent_spawning(args)
    elif args.command == "task-dependency":
        render_task_dependency(args)
    elif args.command == "workflow":
        render_workflow(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
