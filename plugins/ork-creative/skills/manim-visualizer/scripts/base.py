"""
OrchestKit Manim Base Module

Shared colors, styles, and utility functions for all visualizations.
"""

from manim import *
import numpy as np

# OrchestKit Color Palette
COLORS = {
    "primary": "#8b5cf6",      # Purple - main brand color
    "success": "#22c55e",       # Green - completion, success
    "warning": "#f59e0b",       # Amber - warnings, in-progress
    "info": "#06b6d4",          # Cyan - information
    "pink": "#ec4899",          # Pink - special highlights
    "orange": "#f97316",        # Orange - alerts
    "background": "#0a0a0f",    # Dark background
    "surface": "#1a1a2e",       # Slightly lighter surface
    "text": "#ffffff",          # White text
    "text_dim": "#6b7280",      # Dimmed text
    "glow": "#8b5cf680",        # Semi-transparent glow
}

# Agent color assignments
AGENT_COLORS = {
    "code-reviewer": "#8b5cf6",
    "security-auditor": "#ef4444",
    "test-generator": "#22c55e",
    "performance-engineer": "#f59e0b",
    "accessibility-specialist": "#06b6d4",
    "documentation-specialist": "#ec4899",
    "default": "#6366f1",
}

# Configure default Manim settings
def configure_scene():
    """Configure Manim for OrchestKit rendering."""
    config.pixel_height = 400
    config.pixel_width = 1920
    config.frame_rate = 30
    config.background_color = COLORS["background"]


class OrchestKitScene(Scene):
    """Base scene with OrchestKit styling."""

    def setup(self):
        """Set up the scene with dark background."""
        self.camera.background_color = COLORS["background"]

    def create_orchestrator(self, label: str = "Orchestrator") -> VGroup:
        """Create the central orchestrator node with glow effect."""
        # Outer glow
        glow = Circle(
            radius=0.8,
            fill_color=COLORS["primary"],
            fill_opacity=0.15,
            stroke_width=0,
        )

        # Main circle
        circle = Circle(
            radius=0.6,
            fill_color=COLORS["primary"],
            fill_opacity=0.3,
            stroke_color=COLORS["primary"],
            stroke_width=3,
        )

        # Inner icon (using unicode for robot)
        icon = Text("\u2699", font_size=36, color=COLORS["primary"])  # Gear icon

        # Label below
        text = Text(label, font_size=18, color=COLORS["text"])
        text.next_to(circle, DOWN, buff=0.2)

        return VGroup(glow, circle, icon, text)

    def create_agent_box(self, name: str, color: str = None) -> VGroup:
        """Create an agent box with consistent styling."""
        if color is None:
            color = AGENT_COLORS.get(name, AGENT_COLORS["default"])

        # Box
        box = RoundedRectangle(
            width=2.8,
            height=0.9,
            corner_radius=0.12,
            fill_color=color,
            fill_opacity=0.2,
            stroke_color=color,
            stroke_width=2,
        )

        # Status indicator (circle on left)
        status = Dot(
            radius=0.08,
            color=color,
            fill_opacity=1,
        )
        status.move_to(box.get_left() + RIGHT * 0.25)

        # Name label
        label = Text(name, font_size=14, color=COLORS["text"])
        label.move_to(box.get_center() + RIGHT * 0.15)

        return VGroup(box, status, label)

    def create_task_box(self, task_id: str, name: str, status: str = "pending") -> VGroup:
        """Create a task box for dependency visualization."""
        status_colors = {
            "pending": COLORS["text_dim"],
            "in_progress": COLORS["warning"],
            "completed": COLORS["success"],
            "blocked": "#ef4444",
        }
        color = status_colors.get(status, COLORS["text_dim"])

        # Box
        box = RoundedRectangle(
            width=3.2,
            height=1.0,
            corner_radius=0.15,
            fill_color=COLORS["surface"],
            fill_opacity=0.8,
            stroke_color=color,
            stroke_width=2,
        )

        # Task ID badge
        badge = Text(f"#{task_id}", font_size=12, color=COLORS["text_dim"])
        badge.move_to(box.get_corner(UL) + RIGHT * 0.4 + DOWN * 0.2)

        # Task name
        label = Text(name[:20], font_size=14, color=COLORS["text"])
        label.move_to(box.get_center())

        # Status indicator
        indicator = Dot(
            radius=0.1,
            color=color,
            fill_opacity=1,
        )
        indicator.move_to(box.get_corner(DR) + LEFT * 0.3 + UP * 0.25)

        return VGroup(box, badge, label, indicator)

    def create_spinner(self) -> Text:
        """Create a spinner text object."""
        return Text("\u25cf", font_size=20, color=COLORS["info"])  # Filled circle

    def create_checkmark(self) -> Text:
        """Create a completion checkmark."""
        return Text("\u2713", font_size=24, color=COLORS["success"])  # Check mark

    def create_glow_effect(self, mobject: Mobject, color: str = None, radius: float = 0.3) -> VGroup:
        """Add a glow effect around a mobject."""
        if color is None:
            color = COLORS["primary"]

        glow = mobject.copy()
        glow.set_fill(color, opacity=0.2)
        glow.set_stroke(color, width=0)
        glow.scale(1 + radius)

        return VGroup(glow, mobject)

    def animate_spinner(self, position: np.ndarray, duration: float = 1.5) -> Animation:
        """Create a spinner animation at position."""
        spinners = ["\u25cf", "\u25d0", "\u25d1", "\u25d2", "\u25d3"]
        spinner_objects = []

        for i, char in enumerate(spinners * 3):
            spinner = Text(char, font_size=16, color=COLORS["info"])
            spinner.move_to(position)
            spinner_objects.append(spinner)

        animations = []
        for i in range(len(spinner_objects) - 1):
            animations.append(
                Succession(
                    FadeIn(spinner_objects[i], run_time=0.1),
                    FadeOut(spinner_objects[i], run_time=0.1),
                )
            )

        return Succession(*animations)


def create_orchestrator(label: str = "Orchestrator") -> VGroup:
    """Standalone function to create orchestrator node."""
    scene = OrchestKitScene()
    return scene.create_orchestrator(label)


def create_agent_box(name: str, color: str = None) -> VGroup:
    """Standalone function to create agent box."""
    scene = OrchestKitScene()
    return scene.create_agent_box(name, color)


def create_glow_effect(mobject: Mobject, color: str = None, radius: float = 0.3) -> VGroup:
    """Standalone function to add glow effect."""
    scene = OrchestKitScene()
    return scene.create_glow_effect(mobject, color, radius)
