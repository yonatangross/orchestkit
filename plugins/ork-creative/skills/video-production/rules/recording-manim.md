---
title: Manim Animations
impact: HIGH
impactDescription: "Animated visualizations make abstract concepts tangible — static diagrams fail to convey workflow dynamics and parallel execution"
tags: manim, animation, visualization, diagram, workflow
---

## Manim Animations

Create animated visualizations using Manim (3Blue1Brown's animation engine) for workflow diagrams, agent spawning, and architecture overlays.

### Quick Start

```bash
pip install manim
python scripts/visualize.py explore --type=workflow
```

### Visualization Types

**1. Workflow Animation** — Skill execution phases as animated flowchart
- Phase boxes appearing sequentially
- Tool icons animating in
- Parallel phases shown side-by-side
- Completion checkmarks

**2. Agent Spawning** — Parallel agent spawning from Task tool
- Central orchestrator
- Agents spawning outward
- Parallel execution lines
- Results merging back

**3. Architecture Diagram** — Static-to-animated architecture
- Boxes for services/modules
- Arrows for data flow
- Highlights for focus areas

### Output Specs

| Type | Resolution | Duration | FPS |
|------|------------|----------|-----|
| workflow | 1920x400 | 5-10s | 30 |
| agents | 1920x600 | 3-5s | 30 |
| architecture | 1920x1080 | 5-8s | 30 |

### Remotion Integration

```tsx
<Sequence from={hookEnd} durationInFrames={150}>
  <OffthreadVideo src={staticFile("manim/workflow.mp4")} />
</Sequence>
```

### Color Palette

Matches OrchestKit branding:
- Primary: #8b5cf6 (purple)
- Success: #22c55e (green)
- Warning: #f59e0b (amber)
- Info: #06b6d4 (cyan)
- Background: #0a0a0f (dark)

**References:** `references/agent-spawning.md`, `references/workflow-animation.md`
**Scripts:** `scripts/base.py`, `scripts/generate.py`, `scripts/agent_spawning.py`, `scripts/task_dependency.py`
