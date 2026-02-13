"""
Agent Spawning Animation

Visualizes parallel agent spawning from the Task tool, showing:
- Central orchestrator with glow
- Agents radiating outward with spring animation
- Connection lines with data flow
- Spinner animation during execution
- Checkmark completion sequence

Output: 1920x400 strip, 30 FPS, 5-8 seconds
"""

from manim import *
import numpy as np
from .base import COLORS, AGENT_COLORS, OrchestKitScene


class AgentSpawning(OrchestKitScene):
    """Parallel agent spawning animation for OrchestKit demos."""

    def __init__(self, agents: list[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.agents = agents or [
            "code-reviewer",
            "security-auditor",
            "test-generator",
        ]

    def construct(self):
        """Build the agent spawning animation."""
        # Set up scene dimensions
        self.camera.frame_width = 16
        self.camera.frame_height = 3.5

        # Phase 1: Show orchestrator with pulse
        orchestrator = self.create_orchestrator("Task Tool")
        orchestrator.move_to(LEFT * 5)

        self.play(
            FadeIn(orchestrator, scale=0.8),
            run_time=0.5
        )

        # Pulse effect on orchestrator
        self.play(
            orchestrator[0].animate.scale(1.3).set_opacity(0.3),
            orchestrator[1].animate.scale(1.1),
            run_time=0.3
        )
        self.play(
            orchestrator[0].animate.scale(1/1.3).set_opacity(0.15),
            orchestrator[1].animate.scale(1/1.1),
            run_time=0.2
        )

        # Phase 2: Create agent boxes
        agent_boxes = []
        agent_positions = self._calculate_agent_positions(len(self.agents))

        for i, agent_name in enumerate(self.agents):
            color = AGENT_COLORS.get(agent_name, AGENT_COLORS["default"])
            box = self.create_agent_box(agent_name, color)
            box.move_to(agent_positions[i])
            agent_boxes.append(box)

        # Phase 3: Create connection lines
        connections = []
        for box in agent_boxes:
            line = Line(
                orchestrator.get_right() + RIGHT * 0.2,
                box.get_left() + LEFT * 0.1,
                color=COLORS["primary"],
                stroke_width=2,
            )
            connections.append(line)

        # Phase 4: Animate spawn sequence
        # First, show "PARALLEL" label
        parallel_label = Text(
            "PARALLEL",
            font_size=14,
            color=COLORS["warning"],
        )
        parallel_label.next_to(orchestrator, UP, buff=0.4)

        self.play(
            FadeIn(parallel_label, shift=UP * 0.2),
            run_time=0.3
        )

        # Spawn all agents simultaneously with staggered timing
        spawn_animations = []
        for i, (box, line) in enumerate(zip(agent_boxes, connections)):
            spawn_animations.append(
                Succession(
                    Wait(i * 0.1),  # Stagger
                    AnimationGroup(
                        Create(line, run_time=0.4),
                        FadeIn(box, shift=RIGHT * 0.5, run_time=0.4),
                    )
                )
            )

        self.play(*spawn_animations)

        # Phase 5: Processing animation (spinners)
        spinners = []
        for box in agent_boxes:
            spinner = self.create_spinner()
            spinner.next_to(box, LEFT, buff=0.15)
            spinners.append(spinner)

        # Show spinners
        self.play(*[FadeIn(s) for s in spinners], run_time=0.2)

        # Animate spinning
        for _ in range(3):
            self.play(
                *[Rotate(s, angle=PI/2) for s in spinners],
                run_time=0.15
            )

        # Phase 6: Completion sequence
        checkmarks = []
        for i, (box, spinner) in enumerate(zip(agent_boxes, spinners)):
            check = self.create_checkmark()
            check.next_to(box, LEFT, buff=0.15)
            checkmarks.append(check)

        # Staggered completion
        completion_anims = []
        for i, (spinner, check, line, box) in enumerate(zip(spinners, checkmarks, connections, agent_boxes)):
            completion_anims.append(
                Succession(
                    Wait(i * 0.2),
                    AnimationGroup(
                        FadeOut(spinner, run_time=0.1),
                        FadeIn(check, scale=1.5, run_time=0.2),
                        line.animate.set_color(COLORS["success"]),
                        box[0].animate.set_stroke(COLORS["success"]),  # Change box border
                    )
                )
            )

        self.play(*completion_anims)

        # Phase 7: Results merge back
        merge_arrows = []
        for box in agent_boxes:
            arrow = Arrow(
                box.get_left(),
                orchestrator.get_right() + RIGHT * 0.3,
                color=COLORS["success"],
                stroke_width=2,
                max_tip_length_to_length_ratio=0.1,
            )
            merge_arrows.append(arrow)

        self.play(
            *[GrowArrow(arrow) for arrow in merge_arrows],
            orchestrator[1].animate.set_stroke(COLORS["success"]),
            run_time=0.5
        )

        # Final success state
        success_label = Text(
            "COMPLETED",
            font_size=14,
            color=COLORS["success"],
        )
        success_label.next_to(orchestrator, DOWN, buff=0.3)

        self.play(
            Transform(parallel_label, success_label),
            run_time=0.3
        )

        self.wait(0.5)

    def _calculate_agent_positions(self, count: int) -> list[np.ndarray]:
        """Calculate evenly spaced positions for agents."""
        positions = []

        if count == 1:
            positions.append(np.array([2.5, 0, 0]))
        elif count <= 3:
            # Spread vertically
            y_positions = np.linspace(1.2, -1.2, count)
            for y in y_positions:
                positions.append(np.array([2.5, y, 0]))
        else:
            # Two columns for more agents
            y_positions = np.linspace(1.2, -1.2, (count + 1) // 2)
            for i, y in enumerate(y_positions):
                positions.append(np.array([2.0, y, 0]))
                if i * 2 + 1 < count:
                    positions.append(np.array([5.0, y, 0]))

        return positions[:count]


class AgentSpawningSixAgents(AgentSpawning):
    """Agent spawning with 6 agents for verify/review-pr demos."""

    def __init__(self, **kwargs):
        agents = [
            "code-reviewer",
            "security-auditor",
            "test-generator",
            "performance-engineer",
            "accessibility-specialist",
            "documentation-specialist",
        ]
        super().__init__(agents=agents, **kwargs)


# CLI entry point for standalone rendering
if __name__ == "__main__":
    import sys

    agents = ["code-reviewer", "security-auditor", "test-generator"]
    if len(sys.argv) > 1:
        agents = sys.argv[1].split(",")

    # Configure output
    config.pixel_height = 400
    config.pixel_width = 1920
    config.frame_rate = 30
    config.background_color = COLORS["background"]

    scene = AgentSpawning(agents=agents)
    scene.render()
