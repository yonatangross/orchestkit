# Skill Demo Recipe - Complete Implementation

Detailed production guide for creating 15-25 second skill demonstration videos.

## Overview

**Duration**: 15-25 seconds
**Purpose**: Showcase a single skill's capability with maximum impact
**Format**: Terminal-focused with overlays

---

## Timeline Breakdown

### Phase 1: Hook (0:00-0:03)

#### Visual Setup
```typescript
// Frame 0-90 (at 30fps)
const hookPhase = {
  background: '#0D1117', // GitHub dark
  terminal: {
    visible: true,
    opacity: 0.3, // Dimmed initially
    cursor: { blinking: true, interval: 500 },
  },
  overlay: {
    text: 'Need to review a PR?',
    position: 'center',
    style: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textShadow: '0 2px 20px rgba(0,0,0,0.5)',
    },
  },
};
```

#### Animation Sequence
1. **Frame 0-15**: Fade in from black (500ms)
2. **Frame 15-45**: Text appears with slight scale (1.0 → 1.02)
3. **Frame 45-90**: Hold for reading

#### Audio
- **0:00-0:02**: Silence
- **0:02-0:03**: Subtle ambient fade in

---

### Phase 2: Command Entry (0:03-0:08)

#### Visual Setup
```typescript
const commandPhase = {
  terminal: {
    opacity: 1.0, // Full brightness
    prompt: '❯ ',
    command: '/ork:review-pr 123',
  },
  typing: {
    speed: 50, // ms per character
    cursor: 'block',
    sound: true,
  },
};
```

#### Typing Animation Detail

| Time | Character | Cumulative | Audio |
|------|-----------|------------|-------|
| 0:03.00 | / | / | key |
| 0:03.05 | o | /o | key |
| 0:03.10 | r | /or | key |
| 0:03.15 | k | /ork | key |
| 0:03.20 | : | /ork: | key |
| 0:03.25 | r | /ork:r | key |
| 0:03.30 | e | /ork:re | key |
| 0:03.35 | v | /ork:rev | key |
| 0:03.40 | i | /ork:revi | key |
| 0:03.45 | e | /ork:revie | key |
| 0:03.50 | w | /ork:review | key |
| 0:03.55 | - | /ork:review- | key |
| 0:03.60 | p | /ork:review-p | key |
| 0:03.65 | r | /ork:review-pr | key |
| 0:03.70 | (space) | /ork:review-pr  | key |
| 0:03.75 | 1 | /ork:review-pr 1 | key |
| 0:03.80 | 2 | /ork:review-pr 12 | key |
| 0:03.85 | 3 | /ork:review-pr 123 | key |
| 0:03.90-0:04.50 | (pause) | — | — |
| 0:04.50 | Enter | — | enter_key |

#### Command Highlight Effect
```typescript
// After Enter pressed, command glows
const commandGlow = {
  startFrame: 135, // 4.5s at 30fps
  duration: 300, // 10 frames
  effect: {
    textShadow: '0 0 10px #4ECDC4',
    transition: 'ease-out',
  },
};
```

---

### Phase 3: Result Display (0:08-0:18)

#### Output Simulation
```typescript
const outputSequence = [
  { delay: 0, text: '🔍 Analyzing PR #123...', style: 'dim' },
  { delay: 300, text: '├── Fetching diff (847 lines)', style: 'dim' },
  { delay: 600, text: '├── Spawning analysis agents...', style: 'dim' },
  { delay: 1200, text: '', style: 'normal' },
  { delay: 1400, text: '## Security Analysis', style: 'heading' },
  { delay: 1600, text: '⚠️  SQL injection risk in query.ts:45', style: 'warning', highlight: true },
  { delay: 1900, text: '⚠️  Unvalidated input in handler.ts:23', style: 'warning', highlight: true },
  { delay: 2200, text: '', style: 'normal' },
  { delay: 2400, text: '## Performance', style: 'heading' },
  { delay: 2600, text: '🔴 N+1 query detected in users.ts:89', style: 'error', highlight: true },
  { delay: 2900, text: '', style: 'normal' },
  { delay: 3100, text: '## Code Quality', style: 'heading' },
  { delay: 3300, text: '💡 3 functions exceed complexity threshold', style: 'info' },
  { delay: 3600, text: '', style: 'normal' },
  { delay: 3800, text: '✅ Analysis complete: 6 issues found', style: 'success' },
];
```

#### Highlight Boxes
```typescript
// Visual highlights for key findings
const highlights = [
  {
    target: 'SQL injection risk',
    type: 'box',
    color: '#F59E0B', // Warning yellow
    timing: { appear: 1600, duration: 8400 }, // Visible until phase end
    animation: 'pulse', // Subtle pulse effect
  },
  {
    target: 'N+1 query detected',
    type: 'box',
    color: '#EF4444', // Error red
    timing: { appear: 2600, duration: 7400 },
    animation: 'pulse',
  },
];
```

#### Camera Movement
```typescript
const cameraMovement = {
  type: 'slowZoom',
  startScale: 1.0,
  endScale: 1.15,
  focusPoint: { x: 0.3, y: 0.4 }, // Slightly left of center, upper third
  duration: 10000, // 10 seconds
  easing: 'ease-in-out',
};
```

---

### Phase 4: Impact Statement (0:18-0:22)

#### Visual Composition
```typescript
const impactPhase = {
  terminal: {
    scale: 0.7, // Shrink terminal
    position: 'left',
    opacity: 0.5,
  },
  impactCard: {
    position: 'right',
    content: {
      number: '6',
      unit: 'issues',
      subtext: 'found in 8 seconds',
    },
    style: {
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: 16,
      padding: 40,
    },
  },
};
```

#### Number Animation
```typescript
const numberAnimation = {
  type: 'countUp',
  from: 0,
  to: 6,
  duration: 800,
  easing: 'ease-out',
  style: {
    fontSize: 96,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
};
```

#### Audio
- **0:18.0**: Success chime (C-E-G chord)
- **0:18.5-0:22**: Ambient sustain

---

### Phase 5: Call to Action (0:22-0:25)

#### Badge Design
```typescript
const ctaBadge = {
  content: 'Try /ork:review-pr',
  style: {
    background: '#4ECDC4',
    color: '#000000',
    fontSize: 32,
    fontWeight: 'bold',
    padding: '16px 32px',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(78, 205, 196, 0.4)',
  },
  animation: {
    type: 'slideIn',
    from: 'right',
    distance: 100,
    duration: 400,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Slight overshoot
  },
};
```

#### End Card
```typescript
const endCard = {
  elements: [
    {
      type: 'logo',
      position: 'bottom-left',
      size: 48,
    },
    {
      type: 'text',
      content: 'OrchestKit',
      position: 'bottom-left',
      style: { fontSize: 24, marginLeft: 60 },
    },
    {
      type: 'badge',
      content: ctaBadge,
      position: 'center-right',
    },
  ],
};
```

---

## Complete Frame-by-Frame Reference

| Frame | Time | Event | Visual | Audio |
|-------|------|-------|--------|-------|
| 0 | 0:00.00 | Start | Black screen | — |
| 15 | 0:00.50 | Fade in complete | Terminal dimmed, hook text | — |
| 45 | 0:01.50 | Text fully visible | "Need to review a PR?" | — |
| 90 | 0:03.00 | Start typing | Terminal brightens | ambient_start |
| 91-117 | 0:03.03-0:03.90 | Type command | Characters appear | key_press × 18 |
| 118-135 | 0:03.93-0:04.50 | Pause | Full command shown | — |
| 135 | 0:04.50 | Enter pressed | Command glows | enter_key |
| 150-165 | 0:05.00-0:05.50 | Loading | "Analyzing..." | — |
| 165-540 | 0:05.50-0:18.00 | Output | Results stream | processing |
| 540-660 | 0:18.00-0:22.00 | Impact | Stats card | success_chime |
| 660-750 | 0:22.00-0:25.00 | CTA | Badge slides in | fade_out |

---

## Asset Requirements

### Terminal Assets
- Clean terminal window (no extra chrome)
- Blinking cursor sprite/animation
- Command prompt character

### Typography
- JetBrains Mono (terminal text)
- Inter (overlays)
- Space Grotesk (impact numbers)

### Colors
```css
:root {
  --bg-dark: #0D1117;
  --bg-terminal: #161B22;
  --text-primary: #E6EDF3;
  --text-dim: #8B949E;
  --accent-primary: #4ECDC4;
  --accent-warning: #F59E0B;
  --accent-error: #EF4444;
  --accent-success: #10B981;
}
```

### Audio Files
- `key_press.wav` (50ms, -15dB)
- `enter_key.wav` (100ms, -12dB)
- `success_chime.wav` (500ms, -10dB)
- `ambient_loop.wav` (loop, -20dB)

---

## Remotion Component Structure

```typescript
// SkillDemo.tsx
import { Composition } from 'remotion';

export const SkillDemo: React.FC<{
  skillName: string;
  command: string;
  hookText: string;
  output: OutputLine[];
  impactStats: ImpactStats;
}> = (props) => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={90}>
        <HookPhase text={props.hookText} />
      </Sequence>

      <Sequence from={90} durationInFrames={150}>
        <CommandPhase command={props.command} />
      </Sequence>

      <Sequence from={240} durationInFrames={300}>
        <OutputPhase lines={props.output} />
      </Sequence>

      <Sequence from={540} durationInFrames={120}>
        <ImpactPhase stats={props.impactStats} />
      </Sequence>

      <Sequence from={660} durationInFrames={90}>
        <CTAPhase skillName={props.skillName} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## Variations

### Minimal (15 seconds)
- Skip hook phase, start with command
- Reduce output display time
- Combined impact + CTA phase

### Extended (25 seconds)
- Longer hook with context
- Full output scroll
- Additional stats in impact phase

### Vertical (Shorts)
- Same timing, vertical crop
- Larger text (1.5x)
- Stacked layout instead of side-by-side

---

## Quality Checklist

### Before Recording
- [ ] Command tested and working
- [ ] Output captured or simulated
- [ ] All text proofread
- [ ] Audio levels set

### During Production
- [ ] Typing speed consistent
- [ ] Highlights visible and clear
- [ ] Transitions smooth
- [ ] Audio synced

### After Production
- [ ] Total duration within range
- [ ] Text readable at 480p
- [ ] Works without audio
- [ ] File size optimized
