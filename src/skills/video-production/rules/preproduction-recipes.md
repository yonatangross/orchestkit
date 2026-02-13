---
title: Content Type Recipes
impact: CRITICAL
impactDescription: "Without structured recipes, demo videos lack consistent quality and miss key engagement moments for each content type"
tags: recipes, demos, templates, timing, production, skill-demo, agent-demo
---

## Content Type Recipes

Step-by-step production recipes for creating demo videos across different content types.

### Recipe Overview

| Content Type | Duration | Use Case |
|--------------|----------|----------|
| Skill Demo | 15-25s | Single skill showcase |
| Agent Demo | 20-30s | Parallel execution, multi-agent |
| Plugin Install | 10-15s | Quick impact, marketplace |
| Tutorial | 60-120s | Educational, step-by-step |
| Comparison | 20-40s | Before/after transformations |
| Feature Highlight | 10-20s | Single feature focus |

### Recipe 1: Skill Demo (15-25 seconds)

```
[0:00-0:03] Hook - Problem statement
[0:03-0:08] Command - Type and execute
[0:08-0:18] Result - Show output with highlights
[0:18-0:22] Impact - Key benefit callout
[0:22-0:25] CTA - Next step or skill name
```

### Recipe 2: Agent Demo (20-30 seconds)

```
[0:00-0:04] Setup - Show the task
[0:04-0:10] Dispatch - Agent spawning visualization
[0:10-0:22] Parallel Work - Split screen showing agents
[0:22-0:27] Synthesis - Results combining
[0:27-0:30] Summary - Agent count and time saved
```

### Recipe 3: Plugin Install (10-15 seconds)

```
[0:00-0:02] Before State - Empty/manual
[0:02-0:06] Install Command - One line
[0:06-0:10] Transformation - Capabilities appear
[0:10-0:13] Available Now - Feature list flash
[0:13-0:15] Install CTA
```

### Recipe 4: Tutorial (60-120 seconds)

```
[0:00-0:10]   Intro - What you'll learn
[0:10-0:25]   Context - Why this matters
[0:25-0:45]   Step 1 - First action
[0:45-1:05]   Step 2 - Second action
[1:05-1:25]   Step 3 - Third action
[1:25-1:45]   Integration - Putting it together
[1:45-2:00]   Summary + Next steps
```

### Timing Constants

```typescript
const TIMING = {
  TYPING_SPEED: 50,      // ms per character
  COMMAND_PAUSE: 500,     // ms after command typed
  RESULT_DELAY: 200,      // ms before showing result
  READ_TIME: 3000,        // ms for text comprehension
  TRANSITION: 300,        // ms for smooth transitions
};
```

### Audio Cues Library

- **Key Press**: Subtle mechanical keyboard sound
- **Command Execute**: Soft whoosh or confirmation tone
- **Success**: Bright chime (C major)
- **Error**: Low tone (for contrast demos)
- **Transition**: Subtle swoosh

### Platform-Specific Adjustments

| Platform | Aspect | Duration | Notes |
|----------|--------|----------|-------|
| YouTube | 16:9 | Standard | Add end screen (last 20s) |
| Shorts | 9:16 | Max 60s | Larger text (1.5x), faster pacing |
| Twitter/X | 16:9/1:1 | Max 2:20 | Captions required, hook in 3s |
| LinkedIn | 16:9 | Any | Professional tone, slower pacing |
| GitHub README | GIF | Max 30s | No audio, optimize size (<10MB) |

**References:** `references/skill-demo-recipe.md`, `references/agent-demo-recipe.md`, `references/plugin-demo-recipe.md`, `references/tutorial-recipe.md`
