---
name: demo-producer
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Creates polished demo videos for skills, tutorials, and CLI demonstrations. Use when producing video showcases, marketing content, or terminal recordings."
argument-hint: "[topic-or-feature]"
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate]
context: fork
version: 1.0.0
author: OrchestKit
tags: [demo, video, marketing, vhs, remotion, terminal, showcase, tutorial]
complexity: low
metadata:
  category: document-asset-creation
---

# Demo Producer

Universal demo video creation for any content type.

## Quick Start

```bash
/ork:demo-producer                    # Interactive mode - asks what to create
/ork:demo-producer skill explore      # Create demo for a skill
/ork:demo-producer plugin ork     # Create demo for a plugin
/ork:demo-producer tutorial "Building a REST API"  # Custom tutorial
```

## Supported Content Types

| Type | Source | Example |
|------|--------|---------|
| `skill` | skills/{name}/SKILL.md | `/ork:demo-producer skill commit` |
| `agent` | agents/{name}.md | `/ork:demo-producer agent debug-investigator` |
| `plugin` | plugins/{name}/plugin.json | `/ork:demo-producer plugin ork` |
| `marketplace` | Marketplace install flow | `/ork:demo-producer marketplace ork` |
| `tutorial` | Custom description | `/ork:demo-producer tutorial "Git workflow"` |
| `cli` | Any CLI tool | `/ork:demo-producer cli "npm create vite"` |
| `code` | Code walkthrough | `/ork:demo-producer code src/api/auth.ts` |

## Interactive Flow

When invoked without arguments, asks 4 questions:

### Question 1: Content Type
```
What type of demo do you want to create?

○ Skill - OrchestKit skill showcase
○ Agent - AI agent demonstration
○ Plugin - Plugin installation/features
○ Tutorial - Custom coding tutorial
○ CLI Tool - Command-line tool demo
○ Code Walkthrough - Explain existing code
```

### Question 2: Format
```
What format(s) do you need?

☑ Horizontal (16:9) - YouTube, Twitter
☑ Vertical (9:16) - TikTok, Reels, Shorts
☐ Square (1:1) - Instagram, LinkedIn
```

### Question 3: Style
```
What style fits your content?

○ Quick Demo (6-10s) - Fast showcase, single feature
○ Standard Demo (15-25s) - Full workflow, multiple steps
○ Tutorial (30-60s) - Detailed explanation, code examples
○ Cinematic (60s+) - Story-driven, high polish
○ Scrapbook (15-35s) - Warm paper, fast cuts, social proof collage (Anthropic style)
```

### Question 4: Audio
```
Audio preferences?

○ Music Only - Subtle ambient background
○ Music + SFX - Background + success sounds
○ Silent - No audio
```

## Pipeline Architecture

> See [references/demo-pipeline.md](references/demo-pipeline.md) for the full pipeline diagram, generation commands, and output structure.

Content Detector -> Content Analyzer -> Script Generator -> Terminal Script -> VHS Recorder -> Remotion Composer -> Final Outputs (horizontal/vertical/square).

## Template System

Four template architectures for different demo styles. See [references/template-system.md](references/template-system.md) for detailed configuration and the SkillDemoConfig interface.

| Template | Use Case | Duration | Key Feature |
|----------|----------|----------|-------------|
| **TriTerminalRace** | Complexity comparisons | 15-20s | 3-panel split, color-coded difficulty |
| **ProgressiveZoom** | Tutorials, walkthroughs | 20-30s | Zoom transitions, layered reveals |
| **SplitThenMerge** | Before/after, transformations | 15-25s | Split screen -> unified merge |
| **ScrapbookDemo** | Product launches, social proof | 15-35s | Warm paper aesthetic, fast cuts |

Content type templates (skill, agent, plugin, tutorial, cli, code) are mapped in [references/skill-category-mapping.md](references/skill-category-mapping.md).

## Remotion Composition

> See [references/remotion-composition.md](references/remotion-composition.md) for folder structure, adding new compositions, and format variant prefixes.

Compositions organized under `Production/` by format (Landscape, Vertical, Square) and skill category.

## Customization Options

### Visual Themes
- **Dark mode** (default): Dark backgrounds, neon accents
- **Light mode**: Clean whites, subtle shadows
- **Terminal**: Pure terminal aesthetic
- **Cinematic**: High contrast, dramatic lighting
- **Scrapbook**: Warm paper (#F0F0E8), serif typography, fast cuts, mixed media collage

### Audio Presets
- **Ambient**: Subtle background, no SFX
- **Tech**: Electronic beats, UI sounds
- **Corporate**: Professional, clean
- **Energetic**: Upbeat, fast-paced

## Best Practices

1. **Keep it focused** - One feature/concept per video
2. **Show, don't tell** - Demonstrate actual usage
3. **Use real data** - Show actual command outputs
4. **Include context** - Brief setup before the demo
5. **End with CTA** - Always include install command

## Terminal Simulation Patterns

> See [references/terminal-simulation.md](references/terminal-simulation.md) for TypeScript patterns: pinned header + scrolling content, agent color palette, and task spinner animation.

## Slop Avoidance

> See [rules/slop-avoidance.md](rules/slop-avoidance.md) for text density rules, timing compression, common slop patterns, and hook styles.

Core rule: If content doesn't earn its screen time, cut it.

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [analyzer-patterns](rules/analyzer-patterns.md) | MEDIUM | Frontmatter parsing, phase detection, example extraction |
| [production-pipeline](rules/production-pipeline.md) | HIGH | Pre-production, storyboarding, recording, VHS, manim |
| [production-composition](rules/production-composition.md) | HIGH | Remotion composition, audio mixing, thumbnails, captions |
| [slop-avoidance](rules/slop-avoidance.md) | HIGH | Text density, timing compression, hook styles |

## Related Skills

- `video-production`: Full video production pipeline (recording, composition, audio, pacing)

## References

- `references/template-system.md` - Template architecture and SkillDemoConfig interface
- `references/content-types.md` - Detailed content type specs
- `references/format-selection.md` - Platform requirements and multi-format support
- `references/script-generation.md` - Script templates and generation patterns
- `references/demo-pipeline.md` - Pipeline architecture, generation commands, output structure
- `references/remotion-composition.md` - Remotion folder structure and composition guide
- `references/skill-category-mapping.md` - Skill category mapping and content type templates
