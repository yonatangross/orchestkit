---
description: Create polished demo videos for anything - skills, plugins, coding tutorials, CLI tools, or any custom content. Interactive workflow with format selection.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/demo-producer/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Demo Producer

Universal demo video creation for any content type.

## Quick Start

```bash
/demo-producer                    # Interactive mode - asks what to create
/demo-producer skill explore      # Create demo for a skill
/demo-producer plugin ork-rag     # Create demo for a plugin
/demo-producer tutorial "Building a REST API"  # Custom tutorial
```

## Supported Content Types

| Type | Source | Example |
|------|--------|---------|
| `skill` | skills/{name}/SKILL.md | `/demo-producer skill commit` |
| `agent` | agents/{name}.md | `/demo-producer agent debug-investigator` |
| `plugin` | plugins/{name}/plugin.json | `/demo-producer plugin ork-core` |
| `marketplace` | Marketplace install flow | `/demo-producer marketplace ork-rag` |
| `tutorial` | Custom description | `/demo-producer tutorial "Git workflow"` |
| `cli` | Any CLI tool | `/demo-producer cli "npm create vite"` |
| `code` | Code walkthrough | `/demo-producer code src/api/auth.ts` |

## Interactive Flow

When invoked without arguments, asks:

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
```

### Question 4: Audio
```
Audio preferences?

○ Music Only - Subtle ambient background
○ Music + SFX - Background + success sounds
○ Silent - No audio
```

## Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Demo Producer Pipeline                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐  │
│  │   Content   │───▶│   Content    │───▶│   Script Generator  │  │
│  │   Detector  │    │   Analyzer   │    │   (per type)        │  │
│  └─────────────┘    └──────────────┘    └──────────┬──────────┘  │
│                                                     │             │
│                                                     ▼             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐  │
│  │  Remotion   │◀───│    VHS       │◀───│   Terminal Script   │  │
│  │  Composer   │    │   Recorder   │    │   (.sh + .tape)     │  │
│  └──────┬──────┘    └──────────────┘    └─────────────────────┘  │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Final Outputs                             │ │
│  │  • horizontal/{Name}Demo.mp4                                 │ │
│  │  • vertical/{Name}Demo-Vertical.mp4                          │ │
│  │  • square/{Name}Demo-Square.mp4 (optional)                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Content Type Templates

### Skill Template
Shows: Skill activation → Task creation → Phase execution → Results

### Agent Template
Shows: Agent spawning → Tool usage → Parallel execution → Synthesis

### Plugin Template
Shows: /plugin install → Configuration → Features showcase

### Tutorial Template
Shows: Problem statement → Code writing → Execution → Result

### CLI Template
Shows: Command entry → Execution → Output explanation

### Code Walkthrough Template
Shows: File overview → Key sections → Pattern explanation

## Generation Commands

```bash
# After interactive selection, generates:

# 1. Terminal script
./skills/demo-producer/scripts/generate-script.sh \
  --type=skill \
  --name=explore \
  --style=standard \
  --output=orchestkit-demos/scripts/

# 2. VHS tape files
./skills/demo-producer/scripts/generate-tape.sh \
  --script=demo-explore.sh \
  --format=horizontal,vertical \
  --output=orchestkit-demos/tapes/

# 3. Record VHS
cd orchestkit-demos/tapes && vhs sim-explore.tape

# 4. Add Remotion composition
./skills/demo-producer/scripts/add-composition.sh \
  --name=explore \
  --type=skill \
  --formats=horizontal,vertical

# 5. Render final videos
cd orchestkit-demos && npx remotion render ExploreDemo --output=out/horizontal/ExploreDemo.mp4
npx remotion render ExploreDemo-Vertical --output=out/vertical/ExploreDemo-Vertical.mp4
```

## Output Structure

```
orchestkit-demos/out/
├── horizontal/
│   └── {Name}Demo.mp4          # 1920x1080 16:9
├── vertical/
│   └── {Name}Demo-Vertical.mp4  # 1080x1920 9:16
└── square/
    └── {Name}Demo-Square.mp4    # 1080x1080 1:1 (optional)
```

## Customization Options

### Hook Styles
- **Question**: "Tired of [pain point]?"
- **Statistic**: "[X]% of developers miss this"
- **Contrarian**: "Stop [common practice]"
- **Transformation**: "From [bad] to [good] in [time]"

### Visual Themes
- **Dark mode** (default): Dark backgrounds, neon accents
- **Light mode**: Clean whites, subtle shadows
- **Terminal**: Pure terminal aesthetic
- **Cinematic**: High contrast, dramatic lighting

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

## Related Skills

- `terminal-demo-generator`: VHS tape recording
- `remotion-composer`: Video composition and effects
- `hook-formulas`: Attention-grabbing openings
- `video-pacing`: Timing and rhythm patterns
- `music-sfx-selection`: Audio selection and mixing
- `thumbnail-first-frame`: CTR optimization

## References

- `references/content-types.md` - Detailed content type specs
- `references/format-selection.md` - Platform requirements
- `references/script-generation.md` - Script templates
