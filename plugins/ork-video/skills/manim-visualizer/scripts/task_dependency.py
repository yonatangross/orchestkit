"""
Task Dependency Graph Animation

Visualizes CC 2.1.16 Task Management dependencies:
- Task boxes with IDs and names
- blockedBy/addBlocks relationships as arrows
- Status transitions (pending -> in_progress -> completed)
- Unblocking cascade when dependencies complete

Output: 1920x600 strip, 30 FPS, 6-10 seconds
"""

from manim import *
import numpy as np
from .base import COLORS, OrchestKitScene


class TaskDependencyGraph(OrchestKitScene):
    """Task dependency graph animation for OrchestKit demos."""

    def __init__(self, tasks: list[dict] = None, **kwargs):
        super().__init__(**kwargs)
        self.tasks = tasks or [
            {"id": "1", "name": "Analyze code", "blockedBy": []},
            {"id": "2", "name": "Run security scan", "blockedBy": []},
            {"id": "3", "name": "Execute tests", "blockedBy": []},
            {"id": "4", "name": "Generate report", "blockedBy": ["1", "2", "3"]},
        ]

    def construct(self):
        """Build the task dependency animation."""
        # Set up scene dimensions
        self.camera.frame_width = 16
        self.camera.frame_height = 5

        # Create task boxes
        task_boxes = {}
        task_positions = self._calculate_task_positions()

        for task in self.tasks:
            box = self.create_task_box(
                task["id"],
                task["name"],
                status="blocked" if task.get("blockedBy") else "pending"
            )
            box.move_to(task_positions[task["id"]])
            task_boxes[task["id"]] = box

        # Phase 1: Show all tasks (faded for blocked ones)
        show_animations = []
        for task in self.tasks:
            box = task_boxes[task["id"]]
            if task.get("blockedBy"):
                box.set_opacity(0.5)
            show_animations.append(FadeIn(box, shift=UP * 0.3))

        self.play(*show_animations, run_time=0.6)

        # Phase 2: Show dependency arrows
        dependency_arrows = []
        for task in self.tasks:
            for blocked_by_id in task.get("blockedBy", []):
                if blocked_by_id in task_boxes:
                    arrow = Arrow(
                        task_boxes[blocked_by_id].get_right(),
                        task_boxes[task["id"]].get_left(),
                        color=COLORS["text_dim"],
                        stroke_width=2,
                        max_tip_length_to_length_ratio=0.08,
                    )
                    dependency_arrows.append((arrow, blocked_by_id, task["id"]))

        if dependency_arrows:
            self.play(
                *[Create(arrow) for arrow, _, _ in dependency_arrows],
                run_time=0.5
            )

        # Add "blockedBy" label
        if dependency_arrows:
            label = Text("blockedBy", font_size=12, color=COLORS["text_dim"])
            label.next_to(dependency_arrows[0][0], UP, buff=0.1)
            self.play(FadeIn(label, shift=UP * 0.1), run_time=0.2)
            self.wait(0.3)
            self.play(FadeOut(label), run_time=0.2)

        # Phase 3: Execute independent tasks (in parallel)
        independent_tasks = [t for t in self.tasks if not t.get("blockedBy")]
        dependent_tasks = [t for t in self.tasks if t.get("blockedBy")]

        # Show PARALLEL label
        if len(independent_tasks) > 1:
            parallel_label = Text("PARALLEL", font_size=14, color=COLORS["warning"])
            parallel_label.to_edge(UP, buff=0.3)
            self.play(FadeIn(parallel_label), run_time=0.2)

        # Transition to in_progress
        progress_animations = []
        spinners = {}
        for task in independent_tasks:
            box = task_boxes[task["id"]]
            spinner = Text("\u25cf", font_size=14, color=COLORS["warning"])
            spinner.move_to(box[3].get_center())  # Status indicator position
            spinners[task["id"]] = spinner

            progress_animations.append(
                AnimationGroup(
                    box[0].animate.set_stroke(COLORS["warning"]),
                    box[3].animate.set_color(COLORS["warning"]),
                    FadeIn(spinner),
                )
            )

        self.play(*progress_animations, run_time=0.3)

        # Simulate processing
        for _ in range(4):
            self.play(
                *[Rotate(spinners[t["id"]], angle=PI/2) for t in independent_tasks],
                run_time=0.15
            )

        # Phase 4: Complete independent tasks (staggered)
        completion_count = {task["id"]: 0 for task in dependent_tasks}

        for i, task in enumerate(independent_tasks):
            box = task_boxes[task["id"]]
            check = Text("\u2713", font_size=16, color=COLORS["success"])
            check.move_to(box[3].get_center())

            # Update dependency counters
            for dep_task in dependent_tasks:
                if task["id"] in dep_task.get("blockedBy", []):
                    completion_count[dep_task["id"]] += 1

            self.play(
                Succession(
                    Wait(i * 0.3),
                    AnimationGroup(
                        FadeOut(spinners[task["id"]], run_time=0.1),
                        FadeIn(check, scale=1.5, run_time=0.2),
                        box[0].animate.set_stroke(COLORS["success"]),
                        box[3].animate.set_color(COLORS["success"]),
                    )
                )
            )

            # Update arrows to green
            for arrow, from_id, to_id in dependency_arrows:
                if from_id == task["id"]:
                    self.play(
                        arrow.animate.set_color(COLORS["success"]),
                        run_time=0.2
                    )

        # Phase 5: Unblock dependent tasks
        for task in dependent_tasks:
            total_deps = len(task.get("blockedBy", []))
            if completion_count[task["id"]] >= total_deps:
                box = task_boxes[task["id"]]

                # Show unblocking animation
                unblock_label = Text(
                    f"Unblocked ({total_deps}/{total_deps})",
                    font_size=10,
                    color=COLORS["success"]
                )
                unblock_label.next_to(box, UP, buff=0.15)

                self.play(
                    box.animate.set_opacity(1),
                    FadeIn(unblock_label, shift=UP * 0.1),
                    run_time=0.3
                )

                self.play(FadeOut(unblock_label), run_time=0.2)

                # Start the dependent task
                spinner = Text("\u25cf", font_size=14, color=COLORS["warning"])
                spinner.move_to(box[3].get_center())
                spinners[task["id"]] = spinner

                self.play(
                    box[0].animate.set_stroke(COLORS["warning"]),
                    FadeIn(spinner),
                    run_time=0.2
                )

                # Process and complete
                for _ in range(3):
                    self.play(Rotate(spinner, angle=PI/2), run_time=0.15)

                check = Text("\u2713", font_size=16, color=COLORS["success"])
                check.move_to(box[3].get_center())

                self.play(
                    FadeOut(spinner, run_time=0.1),
                    FadeIn(check, scale=1.5, run_time=0.2),
                    box[0].animate.set_stroke(COLORS["success"]),
                    run_time=0.3
                )

        # Phase 6: Final success state
        if len(independent_tasks) > 1:
            success_label = Text("ALL COMPLETED", font_size=14, color=COLORS["success"])
            success_label.to_edge(UP, buff=0.3)
            self.play(Transform(parallel_label, success_label), run_time=0.3)

        self.wait(0.5)

    def _calculate_task_positions(self) -> dict[str, np.ndarray]:
        """Calculate positions based on dependency levels."""
        # Group tasks by dependency level
        levels = {}
        for task in self.tasks:
            if not task.get("blockedBy"):
                levels.setdefault(0, []).append(task)
            else:
                # Find max level of dependencies
                max_dep_level = max(
                    self._get_task_level(dep_id, levels)
                    for dep_id in task["blockedBy"]
                )
                levels.setdefault(max_dep_level + 1, []).append(task)

        # Calculate positions
        positions = {}
        x_start = -5
        x_spacing = 4

        for level, tasks_at_level in sorted(levels.items()):
            x = x_start + level * x_spacing
            y_positions = self._distribute_vertically(len(tasks_at_level))

            for task, y in zip(tasks_at_level, y_positions):
                positions[task["id"]] = np.array([x, y, 0])

        return positions

    def _get_task_level(self, task_id: str, levels: dict) -> int:
        """Get the level of a task by its ID."""
        for level, tasks in levels.items():
            if any(t["id"] == task_id for t in tasks):
                return level
        return 0

    def _distribute_vertically(self, count: int) -> list[float]:
        """Distribute items vertically around y=0."""
        if count == 1:
            return [0]
        return list(np.linspace(1.5, -1.5, count))


class TaskDependencyVerify(TaskDependencyGraph):
    """Task dependency graph for /verify skill."""

    def __init__(self, **kwargs):
        tasks = [
            {"id": "1", "name": "Code review", "blockedBy": []},
            {"id": "2", "name": "Security audit", "blockedBy": []},
            {"id": "3", "name": "Test execution", "blockedBy": []},
            {"id": "4", "name": "Performance check", "blockedBy": []},
            {"id": "5", "name": "A11y validation", "blockedBy": []},
            {"id": "6", "name": "Generate report", "blockedBy": ["1", "2", "3", "4", "5"]},
        ]
        super().__init__(tasks=tasks, **kwargs)


# CLI entry point for standalone rendering
if __name__ == "__main__":
    import sys
    import json

    # Default tasks
    tasks = None
    if len(sys.argv) > 1:
        try:
            tasks = json.loads(sys.argv[1])
        except json.JSONDecodeError:
            print("Invalid JSON for tasks, using defaults")

    # Configure output
    config.pixel_height = 600
    config.pixel_width = 1920
    config.frame_rate = 30
    config.background_color = COLORS["background"]

    scene = TaskDependencyGraph(tasks=tasks)
    scene.render()
