---
name: manim-visualizer
description: Create Manim animations for demo videos. Use when visualizing agent workflows, skill pipelines, or architecture diagrams as animated MP4 overlays
context: fork
version: 1.0.0
author: OrchestKit
tags: [manim, animation, visualization, diagram, video]
user-invocable: false
complexity: low
---

# Manim Visualizer

Creates animated visualizations using Manim (3Blue1Brown's animation engine).

## Quick Start

```bash
# Install manim
pip install manim

# Generate visualization
python scripts/visualize.py explore --type=workflow
```

## Visualization Types

### 1. Workflow Animation
Shows skill execution phases as animated flowchart.

```python
# Input: SkillMetadata with phases
# Output: workflow-{skill}.mp4

Phases flow left-to-right with:
- Phase boxes appearing sequentially
- Tool icons animating in
- Parallel phases shown side-by-side
- Completion checkmarks
```

### 2. Agent Spawning
Visualizes parallel agent spawning from Task tool.

```python
# Shows:
# - Central orchestrator
# - Agents spawning outward
# - Parallel execution lines
# - Results merging back
```

### 3. Architecture Diagram
Static-to-animated architecture visualization.

```python
# Components:
# - Boxes for services/modules
# - Arrows for data flow
# - Highlights for focus areas
```

## Output Specs

| Type | Resolution | Duration | FPS |
|------|------------|----------|-----|
| workflow | 1920x400 | 5-10s | 30 |
| agents | 1920x600 | 3-5s | 30 |
| architecture | 1920x1080 | 5-8s | 30 |

## Integration with Remotion

Manim outputs are imported as overlays:

```tsx
<Sequence from={hookEnd} durationInFrames={150}>
  <OffthreadVideo src={staticFile("manim/workflow.mp4")} />
</Sequence>
```

## Color Palette

Matches OrchestKit branding:
- Primary: #8b5cf6 (purple)
- Success: #22c55e (green)
- Warning: #f59e0b (amber)
- Info: #06b6d4 (cyan)
- Background: #0a0a0f (dark)

## Related Skills

- `remotion-composer`: Combines Manim MP4 outputs with terminal recordings
- `demo-producer`: Full demo pipeline orchestration
- `terminal-demo-generator`: Terminal recordings that pair with Manim animations
- `video-storyboarding`: Scene planning before animation creation
