"""
Manim Visualizer Scripts for OrchestKit Demo Videos

This package provides animated visualizations for:
- Agent spawning (parallel Task tool execution)
- Task dependencies (blockedBy/addBlocks relationships)
- Workflow pipelines (sequential phase execution)
- Hook triggers (PreToolUse/PostToolUse visualization)

Usage:
    python generate.py agent-spawning --agents "code-reviewer,security-auditor,test-generator"
    python generate.py task-dependency --tasks '[{"id":"1","name":"Analyze"},{"id":"2","name":"Test","blockedBy":["1"]}]'
"""

from .base import COLORS, create_orchestrator, create_agent_box, create_glow_effect
from .agent_spawning import AgentSpawning
from .task_dependency import TaskDependencyGraph

__all__ = [
    "COLORS",
    "create_orchestrator",
    "create_agent_box",
    "create_glow_effect",
    "AgentSpawning",
    "TaskDependencyGraph",
]
