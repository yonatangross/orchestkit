# Plugin Install Demo Recipe - Complete Implementation

Detailed production guide for creating 10-15 second plugin installation demonstration videos showcasing quick impact and transformation.

## Overview

**Duration**: 10-15 seconds
**Purpose**: Show instant value proposition for marketplace listings
**Format**: Transformation sequence with before/after

---

## Timeline Breakdown

### Phase 1: Before State (0:00-0:02)

#### Visual Setup
```typescript
const beforePhase = {
  terminal: {
    type: 'plain',
    prompt: '$ ',
    background: '#1E1E1E', // VS Code dark
    chrome: {
      visible: true,
      title: 'Claude Code',
      minimal: true,
    },
  },
  badge: {
    text: 'STANDARD',
    position: 'top-right',
    style: {
      background: '#8B949E',
      color: '#FFFFFF',
      fontSize: 14,
      padding: '4px 12px',
      borderRadius: 4,
    },
  },
  content: {
    lines: [
      '$ claude',
      '> Hello! How can I help you today?',
      '> ',
    ],
    style: 'dim', // Slightly muted to emphasize "before"
  },
};
```

#### Animation
```typescript
const beforeAnimation = {
  fadeIn: {
    duration: 300,
    from: 0,
    to: 1,
  },
  badge: {
    delay: 150,
    effect: 'slide-in-right',
    duration: 200,
  },
};
```

#### Mood
- Functional but plain
- Slight desaturation
- Subtle "this could be better" feeling

---

### Phase 2: Install Command (0:02-0:06)

#### Command Sequence
```typescript
const installCommand = {
  command: 'claude plugin add orchestkit/ork',
  timing: {
    typeSpeed: 40, // Faster typing for short demo
    pauseBeforeEnter: 200,
    enterKeyHold: 100,
  },
};
```

#### Progress Indicator
```typescript
const installProgress = {
  type: 'spinner-to-progress',
  phases: [
    {
      time: 0,
      type: 'spinner',
      text: 'Installing plugin...',
    },
    {
      time: 500,
      type: 'progress',
      value: 30,
      text: 'Downloading...',
    },
    {
      time: 1000,
      type: 'progress',
      value: 60,
      text: 'Installing...',
    },
    {
      time: 1500,
      type: 'progress',
      value: 90,
      text: 'Configuring...',
    },
    {
      time: 2000,
      type: 'complete',
      text: '✓ Plugin installed',
      color: '#10B981',
    },
  ],
  style: {
    width: 300,
    height: 4,
    background: '#333',
    fill: '#4ECDC4',
    borderRadius: 2,
  },
};
```

#### Audio
- **0:02.0-0:02.8**: Key press sounds
- **0:02.8**: Enter sound
- **0:03.0-0:05.5**: Processing ambience
- **0:05.5**: Success chime

---

### Phase 3: Transformation (0:06-0:10)

#### Visual Transformation Effect
```typescript
const transformationEffect = {
  type: 'upgrade-burst',
  phases: [
    {
      time: 0,
      action: 'screen-flash',
      color: '#4ECDC4',
      opacity: 0.15,
      duration: 100,
    },
    {
      time: 100,
      action: 'badge-swap',
      from: 'STANDARD',
      to: 'ENHANCED',
      effect: 'flip',
    },
    {
      time: 200,
      action: 'features-spawn',
      items: 'skills',
      direction: 'left',
    },
    {
      time: 600,
      action: 'features-spawn',
      items: 'agents',
      direction: 'right',
    },
    {
      time: 1000,
      action: 'features-spawn',
      items: 'hooks',
      direction: 'bottom',
    },
  ],
};
```

#### Feature Badge Animation
```typescript
interface FeatureBadge {
  text: string;
  icon: string;
  color: string;
  animation: {
    type: 'fly-in';
    origin: { x: number; y: number };
    destination: { x: number; y: number };
    duration: number;
    delay: number;
    easing: string;
  };
}

const skillBadges: FeatureBadge[] = [
  {
    text: 'review-pr',
    icon: '🔍',
    color: '#3B82F6',
    animation: {
      type: 'fly-in',
      origin: { x: -100, y: 200 },
      destination: { x: 150, y: 200 },
      duration: 400,
      delay: 200,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
  {
    text: 'commit',
    icon: '📝',
    color: '#10B981',
    animation: {
      type: 'fly-in',
      origin: { x: -100, y: 260 },
      destination: { x: 150, y: 260 },
      duration: 400,
      delay: 280,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
  {
    text: 'fix-issue',
    icon: '🔧',
    color: '#F59E0B',
    animation: {
      type: 'fly-in',
      origin: { x: -100, y: 320 },
      destination: { x: 150, y: 320 },
      duration: 400,
      delay: 360,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
];

const agentIcons: FeatureBadge[] = [
  {
    text: 'Security',
    icon: '🛡️',
    color: '#EF4444',
    animation: {
      type: 'fly-in',
      origin: { x: 2020, y: 200 },
      destination: { x: 1700, y: 200 },
      duration: 400,
      delay: 600,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
  {
    text: 'Explore',
    icon: '🔭',
    color: '#8B5CF6',
    animation: {
      type: 'fly-in',
      origin: { x: 2020, y: 260 },
      destination: { x: 1700, y: 260 },
      duration: 400,
      delay: 680,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
  {
    text: 'Implement',
    icon: '⚙️',
    color: '#06B6D4',
    animation: {
      type: 'fly-in',
      origin: { x: 2020, y: 320 },
      destination: { x: 1700, y: 320 },
      duration: 400,
      delay: 760,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },
];

const hookIndicators = {
  count: 5,
  style: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#4ECDC4',
    boxShadow: '0 0 8px #4ECDC4',
  },
  animation: {
    type: 'pop-in',
    stagger: 50,
    startDelay: 1000,
    duration: 200,
  },
  positions: [
    { x: 960, y: 700 },
    { x: 920, y: 720 },
    { x: 1000, y: 720 },
    { x: 940, y: 740 },
    { x: 980, y: 740 },
  ],
};
```

#### Terminal Enhancement
```typescript
const enhancedTerminal = {
  prompt: {
    before: '$ ',
    after: '❯ ',
    transition: 'morph',
    duration: 300,
  },
  background: {
    before: '#1E1E1E',
    after: '#0D1117',
    transition: 'crossfade',
    duration: 500,
  },
  statusBar: {
    visible: true,
    position: 'bottom',
    content: 'OrchestKit v5.2.8 • 179 skills • 35 agents • 144 hooks',
    animation: 'slide-up',
    delay: 1200,
  },
};
```

---

### Phase 4: Feature List Flash (0:10-0:13)

#### Stats Reveal
```typescript
const statsReveal = {
  layout: 'horizontal-center',
  stats: [
    {
      number: 179,
      label: 'Skills',
      icon: '⚡',
      color: '#4ECDC4',
      animation: {
        type: 'countUp',
        from: 0,
        duration: 400,
        easing: 'ease-out',
      },
    },
    {
      number: 34,
      label: 'Agents',
      icon: '🤖',
      color: '#8B5CF6',
      animation: {
        type: 'countUp',
        from: 0,
        duration: 400,
        delay: 100,
        easing: 'ease-out',
      },
    },
    {
      number: 144,
      label: 'Hooks',
      icon: '🔗',
      color: '#F59E0B',
      animation: {
        type: 'countUp',
        from: 0,
        duration: 400,
        delay: 200,
        easing: 'ease-out',
      },
    },
  ],
  style: {
    gap: 100,
    numberSize: 72,
    labelSize: 24,
    position: 'center',
  },
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    padding: 60,
    borderRadius: 16,
  },
};
```

#### Audio
- **0:10.0**: Pop sound for first stat
- **0:10.1**: Pop sound (higher pitch)
- **0:10.2**: Pop sound (highest pitch)
- **0:10.5-0:13.0**: Subtle ambient swell

---

### Phase 5: Install CTA (0:13-0:15)

#### CTA Button Design
```typescript
const ctaButton = {
  text: 'Install Now',
  style: {
    background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
    color: '#000000',
    fontSize: 36,
    fontWeight: 'bold',
    padding: '20px 48px',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(78, 205, 196, 0.4)',
  },
  animation: {
    type: 'scale-in',
    from: 0.8,
    to: 1.0,
    duration: 300,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  pulse: {
    enabled: true,
    scale: 1.02,
    duration: 1000,
    repeat: true,
  },
};
```

#### Command Display
```typescript
const installCommandDisplay = {
  text: 'claude plugin add orchestkit/ork',
  style: {
    fontFamily: 'JetBrains Mono',
    fontSize: 20,
    color: '#8B949E',
    background: 'rgba(0, 0, 0, 0.5)',
    padding: '8px 16px',
    borderRadius: 4,
  },
  position: 'below-cta',
  marginTop: 16,
  animation: {
    type: 'fade-in',
    delay: 200,
    duration: 200,
  },
};
```

#### End Card Layout
```typescript
const endCard = {
  layout: 'centered-stack',
  elements: [
    {
      type: 'logo',
      asset: 'orchestkit-logo.svg',
      size: 64,
      position: 'center-top',
    },
    {
      type: 'title',
      text: 'OrchestKit',
      style: { fontSize: 48, fontWeight: 'bold', color: '#FFFFFF' },
    },
    {
      type: 'cta',
      component: ctaButton,
    },
    {
      type: 'command',
      component: installCommandDisplay,
    },
  ],
  background: {
    type: 'gradient',
    colors: ['#0D1117', '#161B22'],
    direction: 'to-bottom',
  },
};
```

---

## Complete Frame Reference

| Frame | Time | Event | Visual | Audio |
|-------|------|-------|--------|-------|
| 0 | 0:00.00 | Start | Black | — |
| 15 | 0:00.50 | Before state | Plain terminal | — |
| 45 | 0:01.50 | Badge appears | "STANDARD" badge | — |
| 60 | 0:02.00 | Typing starts | Command typing | keys |
| 84 | 0:02.80 | Enter pressed | Command complete | enter |
| 90 | 0:03.00 | Install starts | Progress bar | processing |
| 165 | 0:05.50 | Install done | Success message | success |
| 180 | 0:06.00 | Transform | Screen flash | power_up |
| 186 | 0:06.20 | Badge swap | "ENHANCED" | — |
| 192 | 0:06.40 | Skills fly in | Left side | whoosh_1 |
| 210 | 0:07.00 | Agents fly in | Right side | whoosh_2 |
| 228 | 0:07.60 | Hooks pop in | Bottom | pop_sequence |
| 270 | 0:09.00 | Terminal upgrade | Enhanced prompt | — |
| 300 | 0:10.00 | Stats overlay | Numbers appear | stat_1 |
| 303 | 0:10.10 | Second stat | 35 agents | stat_2 |
| 306 | 0:10.20 | Third stat | 144 hooks | stat_3 |
| 390 | 0:13.00 | CTA | Install button | — |
| 450 | 0:15.00 | End | Fade out | — |

---

## Visual Effects Library

### Screen Flash
```typescript
const screenFlash = {
  type: 'overlay',
  color: '#4ECDC4',
  keyframes: [
    { time: 0, opacity: 0 },
    { time: 50, opacity: 0.15 },
    { time: 150, opacity: 0 },
  ],
  blendMode: 'screen',
};
```

### Power-Up Particles
```typescript
const powerUpParticles = {
  count: 30,
  origin: 'center',
  spread: 'radial',
  colors: ['#4ECDC4', '#3B82F6', '#8B5CF6', '#F59E0B'],
  size: { min: 4, max: 12 },
  velocity: { min: 100, max: 300 },
  duration: 800,
  fadeOut: true,
};
```

### Badge Flip
```typescript
const badgeFlip = {
  type: '3d-flip',
  axis: 'y',
  duration: 400,
  phases: [
    { time: 0, rotateY: 0, scale: 1 },
    { time: 200, rotateY: 90, scale: 1.1, opacity: 0 },
    { time: 200, text: 'new-value' }, // Swap content
    { time: 400, rotateY: 0, scale: 1, opacity: 1 },
  ],
  style: {
    before: { background: '#8B949E', text: 'STANDARD' },
    after: { background: '#4ECDC4', text: 'ENHANCED' },
  },
};
```

---

## Remotion Component Structure

```typescript
// PluginDemo.tsx
import { AbsoluteFill, Sequence, Audio } from 'remotion';

export const PluginDemo: React.FC<{
  pluginName: string;
  installCommand: string;
  features: FeatureList;
}> = (props) => {
  return (
    <AbsoluteFill style={{ background: '#0D1117' }}>
      {/* Background Audio */}
      <Audio src={processingAmbient} volume={0.3} startFrom={60} />

      {/* Phase 1: Before State */}
      <Sequence from={0} durationInFrames={60}>
        <BeforeState />
      </Sequence>

      {/* Phase 2: Install Command */}
      <Sequence from={60} durationInFrames={120}>
        <InstallPhase command={props.installCommand} />
      </Sequence>

      {/* Phase 3: Transformation */}
      <Sequence from={180} durationInFrames={120}>
        <TransformationPhase features={props.features} />
      </Sequence>

      {/* Phase 4: Stats Flash */}
      <Sequence from={300} durationInFrames={90}>
        <StatsPhase features={props.features} />
      </Sequence>

      {/* Phase 5: CTA */}
      <Sequence from={390} durationInFrames={60}>
        <CTAPhase
          pluginName={props.pluginName}
          command={props.installCommand}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## Audio Design

### Sound Effects Sequence
```typescript
const audioTimeline = [
  { time: 2000, sound: 'key_press_rapid', duration: 800 },
  { time: 2800, sound: 'enter_key' },
  { time: 3000, sound: 'processing_loop', duration: 2500, loop: true },
  { time: 5500, sound: 'success_chime' },
  { time: 6000, sound: 'power_up_burst' },
  { time: 6400, sound: 'whoosh_left' },
  { time: 7000, sound: 'whoosh_right' },
  { time: 7600, sound: 'pop_sequence' },
  { time: 10000, sound: 'stat_reveal', pitch: 1.0 },
  { time: 10100, sound: 'stat_reveal', pitch: 1.1 },
  { time: 10200, sound: 'stat_reveal', pitch: 1.2 },
];
```

### Audio Files Required
- `key_press_rapid.wav` - Quick typing sequence
- `enter_key.wav` - Command execution
- `processing_loop.wav` - Install progress (loopable)
- `success_chime.wav` - Install complete
- `power_up_burst.wav` - Transformation initiate
- `whoosh_left.wav` - Features flying in
- `whoosh_right.wav` - Features flying in (opposite)
- `pop_sequence.wav` - Multiple quick pops
- `stat_reveal.wav` - Single stat appearance (pitch-shiftable)

---

## Variations

### Ultra-Short (10 seconds)
```
[0:00-0:01] Before state (quick flash)
[0:01-0:04] Install command + progress
[0:04-0:07] Transformation (condensed)
[0:07-0:10] Stats + CTA combined
```

### Extended (15 seconds)
```
[0:00-0:03] Before state with context
[0:03-0:07] Install with detailed progress
[0:07-0:11] Full transformation sequence
[0:11-0:13] Stats reveal
[0:13-0:15] CTA with command
```

### Vertical (Shorts/Reels)
- Stacked layout (stats vertical)
- Larger text (1.5x)
- Features animate top-to-bottom
- CTA fills bottom third

---

## Marketplace Optimization

### Thumbnail Frame
```typescript
const thumbnailFrame = {
  frame: 300, // Stats reveal
  elements: [
    'logo',
    'stats-overlay',
    'enhanced-badge',
  ],
  text: {
    primary: '179 Skills',
    secondary: 'One Install',
  },
};
```

### First-Second Hook
- Immediately show value proposition
- Bold number or benefit
- Contrast with "before" state

### Looping Consideration
- End state can transition back to start
- Consider seamless loop for GIF version

---

## Quality Checklist

### Pre-Production
- [ ] Install command verified
- [ ] Feature counts accurate
- [ ] Plugin name correct
- [ ] All assets prepared

### Production
- [ ] Typing speed appropriate
- [ ] Progress bar smooth
- [ ] Features animate cleanly
- [ ] Stats count up correctly

### Post-Production
- [ ] 10-15 second target met
- [ ] Audio synced properly
- [ ] Colors on-brand
- [ ] CTA visible and clear
- [ ] Works as GIF (no audio)

### Platform Checks
- [ ] Readable at 480p
- [ ] Thumbnail effective
- [ ] Loop point natural
- [ ] File size under limits
