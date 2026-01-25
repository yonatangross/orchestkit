# Workflow Animation

## Basic Structure

```python
from manim import *

class SkillWorkflow(Scene):
    def construct(self):
        # Create phase boxes
        phases = VGroup()
        for i, phase in enumerate(skill_phases):
            box = self.create_phase_box(phase, i)
            phases.add(box)

        # Animate
        self.play(FadeIn(phases[0]))
        for i in range(1, len(phases)):
            arrow = Arrow(phases[i-1].get_right(), phases[i].get_left())
            self.play(
                Create(arrow),
                FadeIn(phases[i])
            )
```

## Phase Box Design

```python
def create_phase_box(self, phase: dict, index: int) -> VGroup:
    # Box
    rect = RoundedRectangle(
        width=3, height=1.5,
        corner_radius=0.2,
        fill_color=PURPLE,
        fill_opacity=0.3,
        stroke_color=PURPLE
    )

    # Title
    title = Text(f"Phase {index + 1}", font_size=24, color=WHITE)
    title.move_to(rect.get_top() + DOWN * 0.3)

    # Description
    desc = Text(phase['name'][:20], font_size=16, color=GRAY)
    desc.move_to(rect.get_center())

    # Tools
    tools = self.create_tool_icons(phase['tools'])
    tools.move_to(rect.get_bottom() + UP * 0.3)

    return VGroup(rect, title, desc, tools)
```

## Parallel Phases

```python
def animate_parallel_phases(self, phases: list):
    # Arrange vertically
    group = VGroup(*[self.create_phase_box(p, i) for i, p in enumerate(phases)])
    group.arrange(DOWN, buff=0.5)

    # Animate all at once
    self.play(*[FadeIn(box) for box in group])

    # Add "PARALLEL" label
    label = Text("PARALLEL", font_size=20, color=YELLOW)
    label.next_to(group, LEFT)
    self.play(Write(label))
```

## Color Palette

```python
ORCHESTKIT_PURPLE = "#8b5cf6"
ORCHESTKIT_GREEN = "#22c55e"
ORCHESTKIT_CYAN = "#06b6d4"
ORCHESTKIT_AMBER = "#f59e0b"
ORCHESTKIT_BG = "#0a0a0f"
```

## Output Settings

```python
config.pixel_height = 400
config.pixel_width = 1920
config.frame_rate = 30
config.background_color = "#0a0a0f"
```
