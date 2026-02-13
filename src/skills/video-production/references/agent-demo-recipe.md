# Agent Demo Recipe - Complete Implementation

Detailed production guide for creating 20-30 second multi-agent demonstration videos showcasing parallel execution and coordination.

## Overview

**Duration**: 20-30 seconds
**Purpose**: Demonstrate multi-agent coordination and parallel execution power
**Format**: Split-screen terminal with agent panels

---

## Timeline Breakdown

### Phase 1: Setup (0:00-0:04)

#### Visual Composition
```typescript
const setupPhase = {
  layout: 'single', // Full terminal view
  terminal: {
    width: '100%',
    background: '#0D1117',
    prompt: '❯ ',
  },
  taskDescription: {
    overlay: true,
    text: 'Reviewing 500+ line PR with complex changes...',
    position: 'top-center',
    style: {
      fontSize: 36,
      fontWeight: 'semibold',
      color: '#E6EDF3',
      background: 'rgba(0, 0, 0, 0.7)',
      padding: '12px 24px',
      borderRadius: 8,
    },
  },
  progressIndicator: {
    type: 'complexity',
    value: 'HIGH',
    color: '#F59E0B',
  },
};
```

#### Animation Sequence
1. **Frame 0-30**: Terminal fades in
2. **Frame 30-60**: Task description appears
3. **Frame 60-90**: Complexity indicator pulses
4. **Frame 90-120**: Command typing begins

#### Audio
- **0:00-0:02**: Ambient fade in
- **0:02-0:04**: Subtle tension build

---

### Phase 2: Agent Dispatch (0:04-0:10)

#### Command Entry
```typescript
const dispatchCommand = {
  command: '/ork:review-pr 456 --depth full',
  typing: {
    speed: 45,
    pauseBeforeEnter: 300,
  },
};
```

#### Split Screen Transition
```typescript
const splitTransition = {
  trigger: 'commandExecute', // After Enter pressed
  type: 'reveal',
  duration: 600,
  sequence: [
    {
      delay: 0,
      panel: 'main',
      width: '50%',
      slide: 'left',
    },
    {
      delay: 200,
      panel: 'agent-1',
      width: '25%',
      slide: 'right-top',
    },
    {
      delay: 400,
      panel: 'agent-2',
      width: '25%',
      slide: 'right-bottom',
    },
    {
      delay: 600,
      panel: 'agent-3',
      width: '25%',
      slide: 'left-bottom',
    },
  ],
};
```

#### Agent Panel Design
```typescript
interface AgentPanel {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  header: {
    height: 32,
    background: string;
    text: string;
  };
  terminal: {
    background: '#0D1117';
    fontSize: 12;
  };
}

const agents: AgentPanel[] = [
  {
    id: 'security',
    name: 'Security Agent',
    icon: '🛡️',
    accentColor: '#EF4444',
    header: {
      height: 32,
      background: 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)',
      text: '🛡️ Security Agent',
    },
  },
  {
    id: 'performance',
    name: 'Performance Agent',
    icon: '⚡',
    accentColor: '#3B82F6',
    header: {
      height: 32,
      background: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)',
      text: '⚡ Performance Agent',
    },
  },
  {
    id: 'quality',
    name: 'Quality Agent',
    icon: '✨',
    accentColor: '#10B981',
    header: {
      height: 32,
      background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
      text: '✨ Quality Agent',
    },
  },
  {
    id: 'docs',
    name: 'Docs Agent',
    icon: '📚',
    accentColor: '#8B5CF6',
    header: {
      height: 32,
      background: 'linear-gradient(90deg, #8B5CF6 0%, #7C3AED 100%)',
      text: '📚 Docs Agent',
    },
  },
];
```

#### Dispatch Animation
```typescript
const dispatchEffects = [
  {
    agent: 'security',
    delay: 0,
    effect: 'spawn',
    sound: 'dispatch_1',
  },
  {
    agent: 'performance',
    delay: 200,
    effect: 'spawn',
    sound: 'dispatch_2',
  },
  {
    agent: 'quality',
    delay: 400,
    effect: 'spawn',
    sound: 'dispatch_3',
  },
  {
    agent: 'docs',
    delay: 600,
    effect: 'spawn',
    sound: 'dispatch_4',
  },
];
```

---

### Phase 3: Parallel Execution (0:10-0:22)

#### Layout Options

**Option A: 2x2 Grid**
```
+-------------------+-------------------+
|   Security Agent  | Performance Agent |
|   (analyzing...)  |   (profiling...)  |
+-------------------+-------------------+
|   Quality Agent   |    Docs Agent     |
|   (scanning...)   |   (checking...)   |
+-------------------+-------------------+
```

**Option B: Main + Side Panels**
```
+---------------------------+-----------+
|                           | Security  |
|      Main Terminal        +-----------+
|   (Orchestration View)    | Perform.  |
|                           +-----------+
|                           | Quality   |
+---------------------------+-----------+
```

#### Agent Activity Sequences

```typescript
const agentActivities = {
  security: {
    lines: [
      { time: 0, text: 'Scanning for vulnerabilities...' },
      { time: 800, text: '├── Checking auth patterns' },
      { time: 1600, text: '├── Validating inputs' },
      { time: 2400, text: '├── SQL injection check' },
      { time: 3200, text: '⚠️ Found: Unescaped user input' },
      { time: 4000, text: '├── XSS prevention check' },
      { time: 4800, text: '⚠️ Found: Missing sanitization' },
      { time: 5600, text: '├── Secrets detection' },
      { time: 6400, text: '✅ No exposed secrets' },
      { time: 7200, text: '' },
      { time: 7400, text: '━━━ Complete: 2 issues ━━━', style: 'summary' },
    ],
    completionTime: 7400,
  },
  performance: {
    lines: [
      { time: 200, text: 'Analyzing performance...' },
      { time: 1000, text: '├── Query analysis' },
      { time: 1800, text: '🔴 N+1 detected in loop' },
      { time: 2600, text: '├── Bundle size check' },
      { time: 3400, text: '├── Lazy loading review' },
      { time: 4200, text: '├── Memory profiling' },
      { time: 5000, text: '⚠️ Large array allocation' },
      { time: 5800, text: '├── Caching opportunities' },
      { time: 6600, text: '💡 Redis cache suggested' },
      { time: 7400, text: '' },
      { time: 7600, text: '━━━ Complete: 3 issues ━━━', style: 'summary' },
    ],
    completionTime: 7600,
  },
  quality: {
    lines: [
      { time: 400, text: 'Running quality checks...' },
      { time: 1200, text: '├── Complexity analysis' },
      { time: 2000, text: '├── Duplication detection' },
      { time: 2800, text: '💡 3 similar code blocks' },
      { time: 3600, text: '├── Test coverage' },
      { time: 4400, text: '⚠️ New code uncovered' },
      { time: 5200, text: '├── Type safety' },
      { time: 6000, text: '├── Naming conventions' },
      { time: 6800, text: '✅ Conventions followed' },
      { time: 7600, text: '' },
      { time: 7800, text: '━━━ Complete: 2 issues ━━━', style: 'summary' },
    ],
    completionTime: 7800,
  },
  docs: {
    lines: [
      { time: 600, text: 'Checking documentation...' },
      { time: 1400, text: '├── JSDoc coverage' },
      { time: 2200, text: '├── README updates' },
      { time: 3000, text: '💡 New exports need docs' },
      { time: 3800, text: '├── API documentation' },
      { time: 4600, text: '├── Changelog entry' },
      { time: 5400, text: '⚠️ CHANGELOG not updated' },
      { time: 6200, text: '├── Example code' },
      { time: 7000, text: '✅ Examples valid' },
      { time: 7800, text: '' },
      { time: 8000, text: '━━━ Complete: 2 issues ━━━', style: 'summary' },
    ],
    completionTime: 8000,
  },
};
```

#### Visual Effects During Execution

```typescript
const executionEffects = {
  // Activity indicator in each panel
  activityPulse: {
    frequency: 200, // ms
    intensity: 0.1, // opacity variation
    color: 'accent', // uses agent's accent color
  },

  // Progress bar in panel header
  progressBar: {
    height: 2,
    position: 'bottom',
    color: 'accent',
    animation: 'left-to-right',
  },

  // Completion flash
  completionFlash: {
    duration: 300,
    effect: 'border-glow',
    color: '#10B981', // Success green
  },
};
```

#### Staggered Completion
```typescript
const completionOrder = [
  { agent: 'security', frame: 462 },    // 7.7s at 60fps
  { agent: 'performance', frame: 480 }, // 8.0s
  { agent: 'quality', frame: 498 },     // 8.3s
  { agent: 'docs', frame: 516 },        // 8.6s
];
```

---

### Phase 4: Synthesis (0:22-0:27)

#### Panel Collapse Animation
```typescript
const synthesisAnimation = {
  type: 'collapse-to-center',
  duration: 800,
  sequence: [
    { time: 0, action: 'panels-shrink', target: 0.5 },
    { time: 200, action: 'panels-move', target: 'center' },
    { time: 400, action: 'panels-merge', effect: 'flash' },
    { time: 600, action: 'report-expand', from: 'center' },
  ],
};
```

#### Unified Report Display
```typescript
const synthesisReport = {
  layout: 'single',
  header: {
    text: '📊 Synthesis Report',
    style: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#4ECDC4',
    },
  },
  sections: [
    {
      agent: 'security',
      icon: '🛡️',
      title: 'Security',
      findings: 2,
      severity: 'medium',
    },
    {
      agent: 'performance',
      icon: '⚡',
      title: 'Performance',
      findings: 3,
      severity: 'high',
    },
    {
      agent: 'quality',
      icon: '✨',
      title: 'Quality',
      findings: 2,
      severity: 'low',
    },
    {
      agent: 'docs',
      icon: '📚',
      title: 'Documentation',
      findings: 2,
      severity: 'low',
    },
  ],
  animation: {
    type: 'reveal',
    direction: 'top-to-bottom',
    stagger: 150,
  },
};
```

#### Visual Synthesis Effect
```typescript
const mergeEffect = {
  particleAnimation: {
    count: 20,
    origin: 'agent-panels',
    destination: 'center',
    color: ['#EF4444', '#3B82F6', '#10B981', '#8B5CF6'],
    duration: 400,
  },
  flash: {
    color: '#FFFFFF',
    opacity: 0.3,
    duration: 100,
  },
};
```

---

### Phase 5: Summary (0:27-0:30)

#### Stats Display
```typescript
const summaryStats = {
  layout: 'horizontal',
  stats: [
    {
      value: 4,
      label: 'agents',
      icon: '🤖',
      animation: 'countUp',
      duration: 600,
    },
    {
      value: 12,
      label: 'seconds',
      icon: '⚡',
      animation: 'countUp',
      duration: 600,
    },
    {
      value: 9,
      label: 'issues',
      icon: '🔍',
      animation: 'countUp',
      duration: 600,
    },
  ],
  style: {
    gap: 80,
    valueSize: 64,
    labelSize: 24,
    color: '#E6EDF3',
  },
};
```

#### Time Comparison (Optional)
```typescript
const timeComparison = {
  manual: {
    value: '45 min',
    label: 'manual review',
    style: { color: '#8B949E', strikethrough: true },
  },
  automated: {
    value: '12 sec',
    label: 'with agents',
    style: { color: '#4ECDC4', glow: true },
  },
  savings: {
    value: '225x faster',
    emphasis: true,
  },
};
```

---

## Complete Frame Reference

| Frame | Time | Event | Visual | Audio |
|-------|------|-------|--------|-------|
| 0 | 0:00.00 | Start | Black | — |
| 30 | 0:01.00 | Terminal in | Single terminal | ambient |
| 60 | 0:02.00 | Task shown | Task description overlay | — |
| 120 | 0:04.00 | Typing starts | Command typing | keys |
| 180 | 0:06.00 | Enter | Command complete | enter |
| 200 | 0:06.67 | Split 1 | First panel appears | dispatch_1 |
| 220 | 0:07.33 | Split 2 | Second panel | dispatch_2 |
| 240 | 0:08.00 | Split 3 | Third panel | dispatch_3 |
| 260 | 0:08.67 | Split 4 | Fourth panel | dispatch_4 |
| 300 | 0:10.00 | Parallel start | All agents active | processing |
| 462 | 0:15.40 | Agent 1 done | Security completes | check_1 |
| 480 | 0:16.00 | Agent 2 done | Performance completes | check_2 |
| 498 | 0:16.60 | Agent 3 done | Quality completes | check_3 |
| 516 | 0:17.20 | Agent 4 done | Docs completes | check_4 |
| 660 | 0:22.00 | Synthesis | Panels collapse | whoosh |
| 720 | 0:24.00 | Report | Unified report | — |
| 810 | 0:27.00 | Stats | Summary numbers | chime |
| 900 | 0:30.00 | End | Fade out | — |

---

## Layout Specifications

### 2x2 Grid Layout
```typescript
const gridLayout = {
  container: {
    width: 1920,
    height: 1080,
    padding: 20,
    gap: 10,
  },
  panels: [
    { x: 0, y: 0, width: 945, height: 525 },    // Top-left
    { x: 955, y: 0, width: 945, height: 525 },  // Top-right
    { x: 0, y: 535, width: 945, height: 525 },  // Bottom-left
    { x: 955, y: 535, width: 945, height: 525 }, // Bottom-right
  ],
};
```

### Main + Side Panels Layout
```typescript
const sideLayout = {
  main: {
    x: 0,
    y: 0,
    width: 1200,
    height: 1080,
  },
  side: {
    x: 1210,
    y: 0,
    width: 690,
    panels: [
      { y: 0, height: 260 },
      { y: 270, height: 260 },
      { y: 540, height: 260 },
      { y: 810, height: 260 },
    ],
  },
};
```

---

## Remotion Component Structure

```typescript
// AgentDemo.tsx
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';

export const AgentDemo: React.FC<{
  task: string;
  command: string;
  agents: AgentConfig[];
  activities: Record<string, ActivityLine[]>;
  summary: SummaryStats;
}> = (props) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: '#0D1117' }}>
      {/* Phase 1: Setup */}
      <Sequence from={0} durationInFrames={120}>
        <SetupPhase task={props.task} />
      </Sequence>

      {/* Phase 2: Dispatch */}
      <Sequence from={120} durationInFrames={180}>
        <DispatchPhase
          command={props.command}
          agents={props.agents}
        />
      </Sequence>

      {/* Phase 3: Parallel Execution */}
      <Sequence from={300} durationInFrames={360}>
        <ParallelPhase
          agents={props.agents}
          activities={props.activities}
        />
      </Sequence>

      {/* Phase 4: Synthesis */}
      <Sequence from={660} durationInFrames={150}>
        <SynthesisPhase agents={props.agents} />
      </Sequence>

      {/* Phase 5: Summary */}
      <Sequence from={810} durationInFrames={90}>
        <SummaryPhase stats={props.summary} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## Audio Design

### Dispatch Sounds
```typescript
const dispatchSounds = {
  dispatch_1: {
    file: 'dispatch_low.wav',
    pitch: 1.0,
    volume: 0.8,
  },
  dispatch_2: {
    file: 'dispatch_low.wav',
    pitch: 1.1,
    volume: 0.8,
  },
  dispatch_3: {
    file: 'dispatch_low.wav',
    pitch: 1.2,
    volume: 0.8,
  },
  dispatch_4: {
    file: 'dispatch_low.wav',
    pitch: 1.3,
    volume: 0.8,
  },
};
```

### Processing Ambience
```typescript
const processingAudio = {
  loop: 'processing_ambient.wav',
  fadeIn: 500,
  fadeOut: 500,
  volume: 0.3,
};
```

### Completion Sounds
```typescript
const completionSounds = {
  check: {
    file: 'soft_check.wav',
    pitch: [1.0, 1.05, 1.1, 1.15], // Rising pitch per agent
    volume: 0.6,
  },
  synthesis: {
    file: 'synthesis_whoosh.wav',
    volume: 0.8,
  },
  summary: {
    file: 'success_chime.wav',
    volume: 0.9,
  },
};
```

---

## Variations

### Quick Version (20 seconds)
- Reduce parallel execution phase to 8 seconds
- Skip detailed output, show progress bars only
- Combine synthesis and summary phases

### Extended Version (30 seconds)
- Full output display in each panel
- Detailed synthesis walkthrough
- Additional comparison stats

### Vertical (Shorts)
- Stack agents vertically (4 thin panels)
- Larger text, simplified output
- Sequential rather than parallel display

---

## Quality Checklist

### Pre-Production
- [ ] Agent activities scripted
- [ ] Timing synchronized across panels
- [ ] Color contrast verified
- [ ] Font sizes readable in grid

### Production
- [ ] Panel transitions smooth
- [ ] Activity text visible
- [ ] Completion stagger natural
- [ ] Audio levels balanced

### Post-Production
- [ ] All agents clearly identifiable
- [ ] Synthesis merge effect polished
- [ ] Stats animate correctly
- [ ] End card professional
