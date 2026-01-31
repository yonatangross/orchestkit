---
name: content-type-recipes
description: Step-by-step recipes for demo videos. Use when creating skill demos, agent showcases, plugin installs, or tutorial walkthroughs with precise timing
tags: [video, recipes, demos, templates, timing, production]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
---

# Content Type Recipes

Complete production recipes for creating demo videos across different OrchestKit content types. Each recipe provides exact timing, shot breakdowns, audio cues, text overlays, and transitions.

## Recipe Overview

| Content Type | Duration | Use Case |
|--------------|----------|----------|
| Skill Demo | 15-25s | Single skill showcase |
| Agent Demo | 20-30s | Parallel execution, multi-agent |
| Plugin Install | 10-15s | Quick impact, marketplace |
| Tutorial | 60-120s | Educational, step-by-step |
| Comparison | 20-40s | Before/after transformations |
| Feature Highlight | 10-20s | Single feature focus |

## Quick Reference

### Frame Rate & Resolution
- **Frame Rate**: 30fps (standard), 60fps (smooth typing)
- **Resolution**: 1920x1080 (YouTube), 1080x1920 (shorts)
- **Aspect Ratios**: 16:9 (horizontal), 9:16 (vertical), 1:1 (social)

### Timing Constants

```typescript
const TIMING = {
  TYPING_SPEED: 50,      // ms per character
  COMMAND_PAUSE: 500,    // ms after command typed
  RESULT_DELAY: 200,     // ms before showing result
  READ_TIME: 3000,       // ms for text comprehension
  TRANSITION: 300,       // ms for smooth transitions
};
```

### Audio Cues Library
- **Key Press**: Subtle mechanical keyboard sound
- **Command Execute**: Soft whoosh or confirmation tone
- **Success**: Bright chime (C major)
- **Error**: Low tone (for contrast demos)
- **Transition**: Subtle swoosh

## Recipe 1: Skill Demo (15-25 seconds)

**Purpose**: Showcase a single skill's capability in minimal time.

### Structure

```
[0:00-0:03] Hook - Problem statement
[0:03-0:08] Command - Type and execute
[0:08-0:18] Result - Show output with highlights
[0:18-0:22] Impact - Key benefit callout
[0:22-0:25] CTA - Next step or skill name
```

### Shot List

| Shot | Duration | Camera | Subject | Notes |
|------|----------|--------|---------|-------|
| 1 | 3s | Static | Terminal | Problem text overlay |
| 2 | 5s | Static | Terminal | Typing animation |
| 3 | 10s | Slow zoom | Output | Highlight key areas |
| 4 | 4s | Pull back | Full screen | Impact + CTA |
| 5 | 3s | Static | Skill badge | End card |

See `references/skill-demo-recipe.md` for detailed breakdown.

## Recipe 2: Agent Demo (20-30 seconds)

**Purpose**: Demonstrate multi-agent coordination and parallel execution.

### Structure

```
[0:00-0:04] Setup - Show the task
[0:04-0:10] Dispatch - Agent spawning visualization
[0:10-0:22] Parallel Work - Split screen showing agents
[0:22-0:27] Synthesis - Results combining
[0:27-0:30] Summary - Agent count and time saved
```

See `references/agent-demo-recipe.md` for detailed breakdown.

## Recipe 3: Plugin Install Demo (10-15 seconds)

**Purpose**: Quick impact showcase for marketplace listings.

### Structure

```
[0:00-0:02] Before State - Empty/manual
[0:02-0:06] Install Command - One line
[0:06-0:10] Transformation - Capabilities appear
[0:10-0:13] Available Now - Feature list flash
[0:13-0:15] Install CTA
```

See `references/plugin-demo-recipe.md` for detailed breakdown.

## Recipe 4: Tutorial/Walkthrough (60-120 seconds)

**Purpose**: Educational content with step-by-step instruction.

### Structure

```
[0:00-0:10]   Intro - What you'll learn
[0:10-0:25]   Context - Why this matters
[0:25-0:45]   Step 1 - First action
[0:45-1:05]   Step 2 - Second action
[1:05-1:25]   Step 3 - Third action
[1:25-1:45]   Integration - Putting it together
[1:45-2:00]   Summary + Next steps
```

### Educational Pacing Guidelines

| Content Type | Display Time | Notes |
|--------------|--------------|-------|
| Command | 3-5s | Allow reading |
| Output | 5-8s | Highlight key parts |
| Explanation | 10-15s | Voiceover with visual |
| Transition | 1-2s | Quick but smooth |

See `references/tutorial-recipe.md` for detailed breakdown.

## Recipe 5: Comparison Demo (20-40 seconds)

**Purpose**: Before/after transformation showcase.

### Structure

```
[0:00-0:05]   "Before" Title
[0:05-0:15]   Manual/Old Approach
[0:15-0:20]   Transition - "Now with OrchestKit"
[0:20-0:30]   Automated/New Approach
[0:30-0:40]   Side-by-side Stats
```

### Split Screen Specs

```typescript
const SPLIT_SCREEN = {
  leftWidth: '50%',
  rightWidth: '50%',
  dividerWidth: 2,
  labels: {
    before: { color: '#ff6b6b', position: 'top-left' },
    after: { color: '#4ecdc4', position: 'top-right' },
  },
};
```

## Recipe 6: Feature Highlight (10-20 seconds)

**Purpose**: Single feature focus for social media or announcements.

### Structure

```
[0:00-0:03]   Feature Name - Bold intro
[0:03-0:10]   Demo - Quick execution
[0:10-0:15]   Benefit - One-liner impact
[0:15-0:20]   Try It - Command/CTA
```

## Production Checklist

### Pre-Production
- [ ] Script finalized and timed
- [ ] All commands tested (no typos)
- [ ] Terminal environment clean
- [ ] Recording resolution set
- [ ] Audio levels checked

### Production
- [ ] Multiple takes for best flow
- [ ] Clean typing (no errors unless intentional)
- [ ] Consistent pacing
- [ ] All overlays prepared

### Post-Production
- [ ] Timing matches recipe
- [ ] Audio synced correctly
- [ ] Text readable at all sizes
- [ ] Transitions smooth
- [ ] End card included

### Quality Checks
- [ ] Works without audio (captions)
- [ ] Readable on mobile
- [ ] Brand colors correct
- [ ] Links/CTAs accurate
- [ ] File size optimized

## Text Overlay Quick Reference

### Fonts
- **Primary**: JetBrains Mono (code)
- **Secondary**: Inter (UI text)
- **Accent**: Space Grotesk (headlines)

### Sizes (1080p)
- Headlines: 72px
- Subheads: 48px
- Body: 36px
- Code: 24px

### Colors
- Primary Text: #FFFFFF
- Secondary: #A0A0A0
- Accent: #4ECDC4
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444

## Platform-Specific Adjustments

| Platform | Aspect | Duration | Notes |
|----------|--------|----------|-------|
| YouTube | 16:9 | Standard | Add end screen (last 20s) |
| Shorts | 9:16 | Max 60s | Larger text (1.5x), faster pacing |
| Twitter/X | 16:9/1:1 | Max 2:20 | Captions required, hook in 3s |
| LinkedIn | 16:9 | Any | Professional tone, slower pacing |
| GitHub README | GIF | Max 30s | No audio, optimize size (<10MB) |

## Related Skills

- `video-storyboarding`: AIDA framework and scene planning
- `video-pacing`: Rhythm and timing rules
- `elevenlabs-narration`: TTS integration
- `remotion-composer`: Programmatic video generation

## References

- [Skill Demo Recipe](./references/skill-demo-recipe.md) - Complete skill demo implementation
- [Agent Demo Recipe](./references/agent-demo-recipe.md) - Multi-agent demo details
- [Plugin Demo Recipe](./references/plugin-demo-recipe.md) - Plugin install showcase
- [Tutorial Recipe](./references/tutorial-recipe.md) - Educational content template
