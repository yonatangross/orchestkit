---
name: demo-producer
description: "Creates polished demo videos for skills, tutorials, and CLI demonstrations. Use when producing video showcases, marketing content, or terminal recordings."
user-invocable: true
context: fork
version: 1.0.0
author: OrchestKit
tags: [demo, video, marketing, vhs, remotion, terminal, showcase, tutorial]
complexity: low
---

# Demo Producer

Universal demo video creation for any content type.

## Quick Start

```bash
/demo-producer                    # Interactive mode - asks what to create
/demo-producer skill explore      # Create demo for a skill
/demo-producer plugin ork     # Create demo for a plugin
/demo-producer tutorial "Building a REST API"  # Custom tutorial
```

## Supported Content Types

| Type | Source | Example |
|------|--------|---------|
| `skill` | skills/{name}/SKILL.md | `/demo-producer skill commit` |
| `agent` | agents/{name}.md | `/demo-producer agent debug-investigator` |
| `plugin` | plugins/{name}/plugin.json | `/demo-producer plugin ork` |
| `marketplace` | Marketplace install flow | `/demo-producer marketplace ork` |
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

## Template System

The demo-producer skill offers three distinct template architectures for different demo styles:

### 1. TriTerminalRace (3-Panel Racing)

Perfect for showcasing complexity levels in parallel:

- **Use case**: Feature comparisons, skill showcases, progressive tutorials
- **Format**: 3 split terminals (Simple → Medium → Advanced)
- **Duration**: 15-20 seconds
- **Components**: LiveFolderTree, LevelBadge, SkillReferences, CodePreview, ProgressPhases
- **Example**: `/demo-producer skill explore --template tri-terminal-race`

**Key Features:**
- Color-coded difficulty indicators (Green/Amber/Purple)
- Real-time project structure animation
- Parallel progress tracking
- Comparative metrics display
- Side-by-side summary cards

### 2. ProgressiveZoom (Tutorial Style)

Ideal for step-by-step explanations:

- **Use case**: Tutorials, code walkthroughs, feature deep-dives
- **Format**: Zooming transitions, layered reveals
- **Duration**: 20-30 seconds
- **Components**: CodePreview, Highlights, Annotations, TimelineBar
- **Example**: `/demo-producer tutorial "Building REST API" --template progressive-zoom`

**Key Features:**
- Smooth zoom effects on code sections
- Progressive annotation reveals
- Contextual highlighting
- Timeline markers for phases
- Caption overlays

### 3. SplitThenMerge (Dramatic Style)

Great for before/after and transformation stories:

- **Use case**: Problem → Solution demos, transformations, workflow changes
- **Format**: Split screen that merges to unified view
- **Duration**: 15-25 seconds
- **Components**: SplitScreen, MergeTransition, ContrastHighlight, ImpactMetrics
- **Example**: `/demo-producer cli "npm run build" --template split-then-merge`

**Key Features:**
- Split screen comparisons
- Dramatic merge transitions
- Side-by-side metrics
- Impact indicators (faster, better, safer)
- Before/after snapshots

### 4. ScrapbookDemo (Anthropic-Style Collage)

Warm paper aesthetic inspired by Anthropic's Claude Opus 4.6 announcement:

- **Use case**: Product launches, social proof, brand showcases
- **Format**: Sequence of title stamp, social cards, terminal captures, stats reveal, CTA
- **Duration**: 15-35 seconds
- **Components**: PaperTexture, KineticText, SocialCard, CollageFrame, StatsCounter
- **Example**: `/demo-producer plugin ork --template scrapbook`

**Key Features:**
- Warm cream background (#F0F0E8), NOT dark
- Serif typography with spring "stamp" pop-in
- Social proof cards sliding in from different directions
- Tilted collage frames for screenshots
- Animated stat counters with accent underlines
- Fast cuts (100-200ms transitions)

See `references/template-system.md` for detailed configuration guide and SkillDemoConfig interface.

## Original Content Type Templates (Supported)

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

## Remotion Folder Structure

Compositions are organized in `orchestkit-demos/src/Root.tsx` using this hierarchy:

```
Production/                    # Ready-to-render videos
├── Landscape-16x9/           # YouTube, Website (1920x1080)
│   ├── Core-Skills/          # implement, verify, commit, explore
│   ├── Memory-Skills/        # remember, memory
│   ├── Review-Skills/        # review-pr, create-pr, fix-issue
│   ├── DevOps-Skills/        # doctor, configure, run-tests, feedback
│   ├── AI-Skills/            # brainstorming, assess, assess-complexity
│   ├── Advanced-Skills/      # worktree-coordination, skill-evolution, demo-producer, add-golden
│   └── Styles/               # Alternative visualizations (ProgressiveZoom, SplitMerge, etc.)
├── Vertical-9x16/            # TikTok, Reels, Shorts (1080x1920)
├── Square-1x1/               # Instagram, LinkedIn (1080x1080)
└── Marketing/                # Brand & intro videos
Templates/                    # Reference examples for each component style
Experiments/                  # Work in progress, testing new ideas
```

### Skill Category Mapping

| Category | Skills |
|----------|--------|
| Core-Skills | implement, verify, commit, explore |
| Memory-Skills | remember, memory |
| Review-Skills | review-pr, create-pr, fix-issue |
| DevOps-Skills | doctor, configure, run-tests, feedback |
| AI-Skills | brainstorming, assess, assess-complexity |
| Advanced-Skills | worktree-coordination, skill-evolution, demo-producer, add-golden |

### Adding New Compositions

1. **Determine skill category** from mapping above
2. **Add to correct folder** in Root.tsx:
   ```tsx
   <Folder name="Production">
     <Folder name="Landscape-16x9">
       <Folder name="{Category}-Skills">
         <Composition id="{SkillName}" ... />
       </Folder>
     </Folder>
   </Folder>
   ```
3. **Use unique composition IDs** - IDs must be globally unique across all folders
4. **Add vertical/square variants** in their respective format folders with prefixes (e.g., `V-TTR-`, `SQ-TTR-`)

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

### Pinned Header + Scrolling Content

```typescript
const Terminal: React.FC<Props> = ({ frame, fps }) => {
  const LINE_HEIGHT = 22;
  const MAX_VISIBLE = 10;

  // Header stays pinned (command + task created message)
  const visibleHeader = HEADER_LINES.filter(line => frame >= line.frame);

  // Content scrolls to keep latest visible
  const visibleContent = CONTENT_LINES.filter(line => frame >= line.frame);
  const contentHeight = visibleContent.length * LINE_HEIGHT;
  const scrollOffset = Math.max(0, contentHeight - MAX_VISIBLE * LINE_HEIGHT);

  return (
    <div style={{ height: 420 }}>
      {/* Pinned header */}
      <div style={{ borderBottom: "1px solid #21262d" }}>
        {visibleHeader.map((line, i) => <TerminalLine key={i} {...line} />)}
      </div>

      {/* Scrolling content */}
      <div style={{ overflow: "hidden", height: 280 }}>
        <div style={{ transform: `translateY(-${scrollOffset}px)` }}>
          {visibleContent.map((line, i) => <TerminalLine key={i} {...line} />)}
        </div>
      </div>
    </div>
  );
};
```

### Agent Colors (Official Palette)

```typescript
const AGENT_COLORS = {
  workflow:     "#8b5cf6",  // Purple - workflow-architect
  backend:      "#06b6d4",  // Cyan - backend-system-architect
  security:     "#ef4444",  // Red - security-auditor
  performance:  "#22c55e",  // Green - performance-engineer
  frontend:     "#f59e0b",  // Amber - frontend-ui-developer
  data:         "#ec4899",  // Pink - data-pipeline-engineer
  llm:          "#6366f1",  // Indigo - llm-integrator
  docs:         "#14b8a6",  // Teal - documentation-specialist
};
```

### Task Spinner Animation

```typescript
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const TaskSpinner: React.FC<{ frame: number; text: string; color: string }> = ({ frame, text, color }) => {
  const spinnerIdx = Math.floor(frame / 3) % SPINNER.length;
  return (
    <div style={{ color }}>
      <span style={{ marginRight: 8 }}>{SPINNER[spinnerIdx]}</span>
      {text}
    </div>
  );
};
```

## Slop Avoidance Patterns

### Common Slop to Eliminate

| Slop Pattern | Example | Fix |
|-------------|---------|-----|
| Verbose phase names | "Divergent Exploration" | "Ideas" or "Generating 12 ideas" |
| Redundant sub-descriptions | Phase title + description | Combine into single line |
| Repetitive completions | "✓ Task #2 completed: patterns analyzed" | "✓ #2 patterns" |
| Generic transitions | "Now let's see..." | Cut directly |
| Empty lines for spacing | Multiple blank lines | CSS padding instead |

### Text Density Rules

```
TERMINAL TEXT DENSITY
=====================
✓ "Analyzing topic → 3 patterns found"     (action → result)
✗ "Phase 1: Topic Analysis"                (title only)
✗ "   └─ Keywords: real-time, notifications" (sub-detail)

✓ "✓ #2 patterns"                          (compact completion)
✗ "✓ Task #2 completed: patterns analyzed" (verbose completion)
```

### Timing Compression

```
15-SECOND VIDEO BREAKDOWN
=========================
0-7s:   Terminal demo (action-packed)
7-11s:  Result visualization (payoff)
11-15s: CTA (install command + stats)

Rule: If content doesn't earn its screen time, cut it.
```

## Related Skills

- `terminal-demo-generator`: VHS tape recording
- `remotion-composer`: Video composition and effects
- `hook-formulas`: Attention-grabbing openings
- `video-pacing`: Timing and rhythm patterns
- `music-sfx-selection`: Audio selection and mixing
- `thumbnail-first-frame`: CTR optimization

## References

- `references/template-system.md` - Template architecture and SkillDemoConfig interface
- `references/content-types.md` - Detailed content type specs
- `references/format-selection.md` - Platform requirements and multi-format support
- `references/script-generation.md` - Script templates and generation patterns
