---
name: content-type-recipes
description: Step-by-step recipes for creating demo videos for different content types - skills, agents, plugins, tutorials with exact timing and shot breakdowns
tags: [video, recipes, demos, templates, timing, production]
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

### Detailed Breakdown

#### Seconds 0-3: Hook
- **Visual**: Dark terminal, cursor blinking
- **Text Overlay**: Problem statement (e.g., "Need to review a PR?")
- **Audio**: Silence or subtle ambient
- **Animation**: Fade in from black

#### Seconds 3-8: Command Entry
- **Visual**: Terminal with prompt visible
- **Action**: Type `/ork:review-pr 123`
- **Typing Speed**: 50ms per character (natural pace)
- **Audio**: Key press sounds
- **Highlight**: Command text glows briefly on Enter

#### Seconds 8-18: Result Display
- **Visual**: Output streams in
- **Animation**: Text appears with slight delay (realistic)
- **Highlights**:
  - Green boxes around key findings
  - Yellow highlights on important sections
- **Audio**: Soft confirmation tone when complete

#### Seconds 18-22: Impact Statement
- **Visual**: Zoom to key result area
- **Text Overlay**: "6 issues found in 8 seconds"
- **Animation**: Number animates in
- **Audio**: Success chime

#### Seconds 22-25: Call to Action
- **Visual**: Skill name badge appears
- **Text**: "Try /ork:review-pr"
- **Animation**: Slide in from right
- **Audio**: Fade out

### Shot List

| Shot | Duration | Camera | Subject | Notes |
|------|----------|--------|---------|-------|
| 1 | 3s | Static | Terminal | Problem text overlay |
| 2 | 5s | Static | Terminal | Typing animation |
| 3 | 10s | Slow zoom | Output | Highlight key areas |
| 4 | 4s | Pull back | Full screen | Impact + CTA |
| 5 | 3s | Static | Skill badge | End card |

See `references/skill-demo-recipe.md` for complete implementation.

---

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

### Detailed Breakdown

#### Seconds 0-4: Setup
- **Visual**: Single terminal, complex task description
- **Text Overlay**: "Reviewing 500+ line PR..."
- **Audio**: Anticipation build

#### Seconds 4-10: Agent Dispatch
- **Visual**: Terminal splits into panels
- **Animation**: Panels slide in with agent names
- **Agents Shown**:
  - "Security Agent" (red accent)
  - "Performance Agent" (blue accent)
  - "Style Agent" (green accent)
- **Audio**: Dispatch sound for each agent

#### Seconds 10-22: Parallel Execution
- **Visual**: Split screen (2-4 panels)
- **Animation**: Each panel shows activity
  - Scrolling analysis
  - Checkmarks appearing
  - Progress indicators
- **Timing**: Stagger completion for visual interest
- **Audio**: Subtle typing/processing sounds

#### Seconds 22-27: Synthesis
- **Visual**: Panels collapse to center
- **Animation**: Results merge into unified report
- **Highlights**: Key findings from each agent
- **Audio**: Synthesis whoosh

#### Seconds 27-30: Summary
- **Visual**: Stats display
- **Text**: "4 agents • 12 seconds • 47 issues found"
- **Animation**: Numbers count up
- **Audio**: Success flourish

See `references/agent-demo-recipe.md` for complete implementation.

---

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

### Detailed Breakdown

#### Seconds 0-2: Before State
- **Visual**: Plain Claude Code terminal
- **Text Overlay**: "Standard Claude Code"
- **Animation**: Quick fade in

#### Seconds 2-6: Install Command
- **Visual**: Type install command
- **Command**: `claude plugin add orchestkit/ork`
- **Audio**: Key presses
- **Animation**: Progress indicator

#### Seconds 6-10: Transformation
- **Visual**: Terminal "transforms"
- **Animation**:
  - Skill badges fly in from edges
  - Agent icons appear
  - Hook indicators light up
- **Audio**: Power-up sound

#### Seconds 10-13: Feature List
- **Visual**: Quick flash of capabilities
- **Text**:
  - "163 Skills"
  - "34 Agents"
  - "144 Hooks"
- **Animation**: Each stat pops in
- **Audio**: Rapid confirmation tones

#### Seconds 13-15: CTA
- **Visual**: Install badge
- **Text**: "Install Now"
- **Animation**: Pulse effect
- **Audio**: Ending flourish

See `references/plugin-demo-recipe.md` for complete implementation.

---

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

### Detailed Breakdown

#### Seconds 0-10: Introduction
- **Visual**: Title card with topic
- **Voiceover**: "In this tutorial, you'll learn..."
- **Text Overlay**: Learning objectives (3 bullet points)
- **Animation**: Objectives fade in sequentially

#### Seconds 10-25: Context Setting
- **Visual**: Problem scenario
- **Show**: Manual approach (briefly)
- **Voiceover**: Explain the pain point
- **Transition**: "There's a better way..."

#### Seconds 25-45: Step 1
- **Visual**: Full screen terminal
- **Action**:
  1. Show command being typed
  2. Execute
  3. Highlight result
- **Text Overlay**: "Step 1: [Action name]"
- **Voiceover**: Explain what's happening
- **Pause**: 2-3 seconds on result for comprehension

#### Seconds 45-65: Step 2
- **Same structure as Step 1**
- **Connection**: Show how Step 1 output feeds Step 2
- **Visual Continuity**: Keep terminal state visible

#### Seconds 65-85: Step 3
- **Same structure**
- **Complexity**: Can show more advanced options
- **Highlight**: Key configuration or customization

#### Seconds 85-105: Integration
- **Visual**: Show all steps together
- **Voiceover**: "Now let's see the full workflow..."
- **Animation**: Quick replay at 2x speed
- **Highlight**: Time savings

#### Seconds 105-120: Summary
- **Visual**: Summary card
- **Text**:
  - What you learned
  - Key commands
  - Next tutorial link
- **Voiceover**: "You've now learned..."
- **CTA**: Subscribe/follow for more

### Educational Pacing Guidelines

| Content Type | Display Time | Notes |
|--------------|--------------|-------|
| Command | 3-5s | Allow reading |
| Output | 5-8s | Highlight key parts |
| Explanation | 10-15s | Voiceover with visual |
| Transition | 1-2s | Quick but smooth |

See `references/tutorial-recipe.md` for complete implementation.

---

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

### Detailed Breakdown

#### Before Section (0:00-0:15)
- **Visual**: Split screen ready (left side active)
- **Label**: "BEFORE" badge (top left)
- **Show**:
  - Manual typing
  - Multiple commands
  - Error/retry
  - Time indicator running
- **Mood**: Slightly frustrated, tedious

#### Transition (0:15-0:20)
- **Visual**: Screen wipe or split activation
- **Text**: "With OrchestKit..."
- **Audio**: Transformation sound
- **Animation**: Right panel activates

#### After Section (0:20-0:30)
- **Visual**: Right side of split screen
- **Label**: "AFTER" badge (top right)
- **Show**:
  - Single command
  - Instant results
  - Success indicators
- **Mood**: Efficient, satisfying

#### Stats Comparison (0:30-0:40)
- **Visual**: Stats overlay on split screen
- **Metrics**:
  - Time: "45 min → 8 sec"
  - Commands: "12 → 1"
  - Errors: "3 → 0"
- **Animation**: Numbers animate
- **Audio**: Impact sound on final stat

### Split Screen Technical Specs

```typescript
const SPLIT_SCREEN = {
  leftWidth: '50%',
  rightWidth: '50%',
  dividerWidth: 2,
  dividerColor: '#333',
  labels: {
    before: { color: '#ff6b6b', position: 'top-left' },
    after: { color: '#4ecdc4', position: 'top-right' },
  },
};
```

---

## Recipe 6: Feature Highlight (10-20 seconds)

**Purpose**: Single feature focus for social media or feature announcements.

### Structure

```
[0:00-0:03]   Feature Name - Bold intro
[0:03-0:10]   Demo - Quick execution
[0:10-0:15]   Benefit - One-liner impact
[0:15-0:20]   Try It - Command/CTA
```

### Detailed Breakdown

#### Feature Name (0:00-0:03)
- **Visual**: Feature name large, centered
- **Animation**: Scale in with slight bounce
- **Audio**: Impact sound
- **Background**: Gradient or branded

#### Quick Demo (0:03-0:10)
- **Visual**: Terminal appears
- **Action**: Fast typing (40ms per char)
- **Result**: Immediate output
- **Highlight**: The specific feature in action
- **Audio**: Quick key sounds, success tone

#### Benefit Statement (0:10-0:15)
- **Visual**: Benefit text overlays terminal
- **Text**: Single powerful statement
- **Examples**:
  - "Save 2 hours per PR"
  - "Zero-config security scanning"
  - "One command, full analysis"
- **Animation**: Fade in, hold, fade out

#### CTA (0:15-0:20)
- **Visual**: Command or action
- **Text**: `/ork:feature-name` or "Available now"
- **Animation**: Highlight effect
- **Audio**: Closing flourish

---

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

---

## Audio Specifications

### Background Music
- **Type**: Lo-fi, tech ambient
- **Level**: -20dB (under voice)
- **Fade**: 2s in/out

### Sound Effects
| Effect | Use | Level |
|--------|-----|-------|
| Key press | Typing | -15dB |
| Whoosh | Transitions | -12dB |
| Chime | Success | -10dB |
| Error tone | Failures | -10dB |

### Voice (if applicable)
- **Level**: -6dB (primary)
- **Compression**: Light (3:1)
- **EQ**: Slight high boost for clarity

---

## Text Overlay Guidelines

### Fonts
- **Primary**: JetBrains Mono (code)
- **Secondary**: Inter (UI text)
- **Accent**: Space Grotesk (headlines)

### Sizes (1080p)
- **Headlines**: 72px
- **Subheads**: 48px
- **Body**: 36px
- **Code**: 24px

### Colors
- **Primary Text**: #FFFFFF
- **Secondary**: #A0A0A0
- **Accent**: #4ECDC4 (brand color)
- **Success**: #10B981
- **Warning**: #F59E0B
- **Error**: #EF4444

### Animation
- **Fade Duration**: 300ms
- **Slide Distance**: 20px
- **Easing**: ease-out (entries), ease-in (exits)

---

## Platform-Specific Adjustments

### YouTube (16:9)
- Standard recipes apply
- Add end screen (last 20s)
- Include subscribe CTA

### YouTube Shorts (9:16)
- Crop to vertical
- Larger text (1.5x)
- Faster pacing (0.8x duration)
- Hook in first 1 second

### Twitter/X (1:1 or 16:9)
- Max 2:20 duration
- Captions required
- Hook in first 3 seconds

### LinkedIn (16:9)
- Professional tone
- Slower pacing
- Clear business value

### GitHub README (GIF)
- Max 30 seconds
- No audio
- Optimized file size (<10MB)
- Loop-friendly endings
