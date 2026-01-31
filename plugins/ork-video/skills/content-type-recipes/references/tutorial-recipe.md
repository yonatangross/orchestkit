# Tutorial/Walkthrough Recipe - Complete Implementation

Detailed production guide for creating 60-120 second educational tutorial videos with step-by-step instruction.

## Overview

**Duration**: 60-120 seconds
**Purpose**: Teach a concept or workflow with clear, repeatable steps
**Format**: Narrated walkthrough with visual highlights

---

## Tutorial Types

### Quick Tutorial (60 seconds)
- 3 steps maximum
- Single concept focus
- No digressions

### Standard Tutorial (90 seconds)
- 3-5 steps
- Context + execution
- One variation shown

### Deep Dive (120 seconds)
- 5-7 steps
- Multiple concepts
- Troubleshooting tips
- Advanced options

---

## Timeline Breakdown

### Phase 1: Introduction (0:00-0:10)

#### Title Card
```typescript
const titleCard = {
  duration: 3000, // 3 seconds
  layout: {
    background: 'linear-gradient(135deg, #0D1117 0%, #161B22 100%)',
    overlay: {
      type: 'pattern',
      pattern: 'dots',
      opacity: 0.05,
    },
  },
  elements: [
    {
      type: 'title',
      text: 'How to Review PRs with OrchestKit',
      style: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      animation: {
        type: 'fade-up',
        duration: 500,
        delay: 200,
      },
    },
    {
      type: 'subtitle',
      text: 'A 90-second guide',
      style: {
        fontSize: 24,
        color: '#8B949E',
        marginTop: 16,
      },
      animation: {
        type: 'fade-up',
        duration: 500,
        delay: 400,
      },
    },
    {
      type: 'logo',
      position: 'bottom-right',
      opacity: 0.8,
    },
  ],
};
```

#### Learning Objectives
```typescript
const learningObjectives = {
  duration: 4000, // 4 seconds
  title: "What you'll learn:",
  items: [
    '✓ Run automated PR reviews',
    '✓ Understand multi-agent analysis',
    '✓ Customize review depth',
  ],
  animation: {
    type: 'stagger-reveal',
    itemDelay: 400,
    effect: 'fade-slide-left',
  },
  style: {
    itemFontSize: 28,
    itemSpacing: 20,
    checkColor: '#4ECDC4',
  },
};
```

#### Voiceover Script
```
[0:00-0:03] "In this tutorial, you'll learn how to run
             comprehensive PR reviews using OrchestKit."

[0:03-0:07] "We'll cover automated analysis, understanding
             results, and customizing for your workflow."

[0:07-0:10] "Let's get started."
```

---

### Phase 2: Context Setting (0:10-0:25)

#### Problem Statement
```typescript
const problemContext = {
  duration: 8000,
  layout: 'split-screen',
  left: {
    type: 'terminal',
    content: {
      lines: [
        '$ git log --oneline -5',
        'a1b2c3d Add user authentication',
        'e4f5g6h Refactor database queries',
        'i7j8k9l Update API endpoints',
        // ... more commits
      ],
    },
    label: 'Typical PR: 847 lines changed',
  },
  right: {
    type: 'pain-points',
    items: [
      { icon: '⏰', text: '45+ minutes manual review' },
      { icon: '😓', text: 'Easy to miss issues' },
      { icon: '🔄', text: 'Inconsistent coverage' },
    ],
    animation: 'stagger-in',
  },
  transition: {
    out: 'fade-to-solution',
    duration: 500,
  },
};
```

#### Solution Preview
```typescript
const solutionPreview = {
  duration: 5000,
  visual: {
    type: 'terminal-preview',
    content: 'Preview of automated review result',
    blur: 5, // Slightly blurred to tease
  },
  overlay: {
    text: 'One command. Complete coverage.',
    style: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#4ECDC4',
    },
  },
};
```

#### Voiceover Script
```
[0:10-0:15] "Code review is essential but time-consuming.
             A typical 800-line PR can take 45 minutes or more."

[0:15-0:20] "Manual reviews often miss security issues,
             performance problems, or documentation gaps."

[0:20-0:25] "OrchestKit's review skill automates this
             with multi-agent analysis. Here's how."
```

---

### Phase 3: Step 1 - Basic Command (0:25-0:45)

#### Step Header
```typescript
const stepHeader = {
  number: 1,
  title: 'Run the Review Command',
  style: {
    position: 'top-left',
    background: 'rgba(0, 0, 0, 0.8)',
    padding: '12px 24px',
    borderRadius: 8,
    numberStyle: {
      background: '#4ECDC4',
      color: '#000',
      width: 32,
      height: 32,
      borderRadius: '50%',
    },
    titleStyle: {
      fontSize: 24,
      fontWeight: 'semibold',
      marginLeft: 12,
    },
  },
  animation: {
    type: 'slide-in-left',
    duration: 300,
  },
};
```

#### Command Demonstration
```typescript
const step1Demo = {
  terminal: {
    fullScreen: true,
    fontSize: 18,
  },
  sequence: [
    {
      type: 'narration',
      time: 0,
      text: 'First, navigate to your repository...',
    },
    {
      type: 'typing',
      time: 1500,
      command: '/ork:review-pr 123',
      speed: 55,
      highlight: {
        '/ork:review-pr': { color: '#4ECDC4', label: 'skill' },
        '123': { color: '#F59E0B', label: 'PR number' },
      },
    },
    {
      type: 'annotation',
      time: 3500,
      target: '123',
      text: 'Use your PR number or URL',
      position: 'below',
      style: {
        background: '#1E1E1E',
        border: '1px solid #4ECDC4',
        padding: '8px 12px',
      },
    },
    {
      type: 'execute',
      time: 5500,
      showProgress: true,
    },
    {
      type: 'output',
      time: 6000,
      lines: [
        '🔍 Fetching PR #123...',
        '📊 Analyzing 847 lines across 12 files...',
        '🤖 Spawning analysis agents...',
      ],
      delay: 400,
    },
  ],
};
```

#### Visual Highlights
```typescript
const step1Highlights = {
  commandBreakdown: {
    visible: true,
    elements: [
      {
        text: '/ork:',
        label: 'Plugin prefix',
        color: '#8B949E',
      },
      {
        text: 'review-pr',
        label: 'Skill name',
        color: '#4ECDC4',
      },
      {
        text: '123',
        label: 'Target',
        color: '#F59E0B',
      },
    ],
    animation: 'appear-on-hover',
  },
};
```

#### Voiceover Script
```
[0:25-0:28] "Step 1: Run the review command."

[0:28-0:33] "Type /ork:review-pr followed by your PR number.
             You can also paste a full GitHub URL."

[0:33-0:38] "Press Enter, and OrchestKit will fetch
             the PR and begin analysis."

[0:38-0:45] "Watch as it spawns multiple specialized
             agents to analyze different aspects."
```

---

### Phase 4: Step 2 - Understanding Results (0:45-1:05)

#### Results Display
```typescript
const step2Results = {
  terminal: {
    scrollable: true,
    highlightRegions: true,
  },
  output: {
    sections: [
      {
        heading: '## Security Analysis',
        icon: '🛡️',
        color: '#EF4444',
        findings: [
          {
            severity: 'warning',
            text: 'SQL injection risk in query.ts:45',
            highlight: true,
            annotation: 'Click to see details',
          },
        ],
      },
      {
        heading: '## Performance',
        icon: '⚡',
        color: '#3B82F6',
        findings: [
          {
            severity: 'error',
            text: 'N+1 query detected in users.ts:89',
            highlight: true,
          },
        ],
      },
      {
        heading: '## Code Quality',
        icon: '✨',
        color: '#10B981',
        findings: [
          {
            severity: 'info',
            text: '3 functions exceed complexity threshold',
          },
        ],
      },
    ],
  },
  annotations: [
    {
      target: 'severity-icons',
      time: 48000,
      text: 'Severity levels help prioritize fixes',
      duration: 3000,
    },
    {
      target: 'file-links',
      time: 52000,
      text: 'File:line references are clickable',
      duration: 3000,
    },
  ],
};
```

#### Zoom and Pan
```typescript
const step2Camera = {
  movements: [
    {
      time: 0,
      action: 'full-view',
      duration: 3000,
    },
    {
      time: 3000,
      action: 'zoom',
      target: 'security-section',
      scale: 1.5,
      duration: 500,
    },
    {
      time: 6000,
      action: 'pan',
      target: 'performance-section',
      duration: 500,
    },
    {
      time: 10000,
      action: 'zoom-out',
      scale: 1.0,
      duration: 500,
    },
  ],
};
```

#### Voiceover Script
```
[0:45-0:50] "Step 2: Understanding your results."

[0:50-0:55] "The review groups findings by category.
             Security issues are flagged with severity levels."

[0:55-1:00] "Each finding includes the file and line number.
             In your terminal, these are clickable links."

[1:00-1:05] "The summary at the bottom shows total
             issues found and time taken."
```

---

### Phase 5: Step 3 - Customization (1:05-1:25)

#### Options Demonstration
```typescript
const step3Options = {
  commands: [
    {
      variant: 'Quick scan',
      command: '/ork:review-pr 123 --depth quick',
      description: 'Fast overview, main issues only',
      duration: 6000,
    },
    {
      variant: 'Full analysis',
      command: '/ork:review-pr 123 --depth full',
      description: 'Complete multi-agent review',
      duration: 6000,
    },
    {
      variant: 'Security focus',
      command: '/ork:review-pr 123 --focus security',
      description: 'Deep security analysis only',
      duration: 6000,
    },
  ],
  display: {
    type: 'carousel',
    transition: 'slide-left',
    showComparison: false,
  },
};
```

#### Flags Table
```typescript
const flagsTable = {
  visible: true,
  position: 'overlay-right',
  title: 'Common Options',
  rows: [
    { flag: '--depth', values: 'quick | standard | full' },
    { flag: '--focus', values: 'security | perf | quality' },
    { flag: '--output', values: 'terminal | markdown | json' },
  ],
  animation: 'fade-in',
  duration: 5000,
};
```

#### Voiceover Script
```
[1:05-1:10] "Step 3: Customize your review."

[1:10-1:15] "Add --depth quick for a fast scan,
             or --depth full for comprehensive analysis."

[1:15-1:20] "Use --focus to concentrate on specific areas
             like security or performance."

[1:20-1:25] "Export options let you save results
             as markdown for PR comments."
```

---

### Phase 6: Integration Demo (1:25-1:45)

#### Workflow Example
```typescript
const integrationDemo = {
  title: 'Putting It Together',
  sequence: [
    {
      step: 'Quick review',
      command: '/ork:review-pr 123 --depth quick',
      output: '2 critical issues found',
      duration: 5000,
    },
    {
      step: 'Deep dive on security',
      command: '/ork:review-pr 123 --focus security --depth full',
      output: 'Detailed security report',
      duration: 5000,
    },
    {
      step: 'Export for PR',
      command: '/ork:review-pr 123 --output markdown > review.md',
      output: 'Ready to paste into PR comment',
      duration: 5000,
    },
  ],
  transition: {
    type: 'step-by-step',
    indicator: 'progress-dots',
  },
};
```

#### Replay at Speed
```typescript
const workflowReplay = {
  enabled: true,
  speed: 2.0, // 2x speed
  overlay: {
    text: 'Full workflow: 12 seconds',
    position: 'top-right',
  },
  duration: 5000,
};
```

#### Voiceover Script
```
[1:25-1:30] "In practice, you might start with a quick
             scan to catch obvious issues."

[1:30-1:35] "Then deep-dive into specific areas
             based on the initial findings."

[1:35-1:40] "Finally, export the results as markdown
             to share with your team."

[1:40-1:45] "What took 45 minutes now takes
             less than 15 seconds."
```

---

### Phase 7: Summary + Next Steps (1:45-2:00)

#### Summary Card
```typescript
const summaryCard = {
  title: 'What You Learned',
  layout: 'two-column',
  left: {
    heading: 'Commands',
    items: [
      '/ork:review-pr [number]',
      '--depth quick|full',
      '--focus security|perf',
      '--output markdown',
    ],
    style: {
      fontFamily: 'JetBrains Mono',
      fontSize: 16,
    },
  },
  right: {
    heading: 'Benefits',
    items: [
      '45 min → 12 seconds',
      'Consistent coverage',
      'Multi-perspective analysis',
      'Exportable results',
    ],
  },
  animation: {
    type: 'fade-in-stagger',
    duration: 3000,
  },
};
```

#### Next Steps CTA
```typescript
const nextStepsCTA = {
  title: 'Continue Learning',
  options: [
    {
      text: 'Try /ork:fix-issue next',
      link: '/tutorial-fix-issue',
      primary: true,
    },
    {
      text: 'Explore all 179 skills',
      link: '/skills-catalog',
      primary: false,
    },
  ],
  subscribe: {
    visible: true,
    text: 'Subscribe for more tutorials',
    position: 'bottom',
  },
};
```

#### End Card
```typescript
const endCard = {
  duration: 5000,
  elements: [
    {
      type: 'logo',
      size: 80,
      position: 'center-top',
    },
    {
      type: 'title',
      text: 'OrchestKit',
      subtitle: 'AI-Powered Development',
    },
    {
      type: 'social',
      handles: ['@orchestkit', 'github.com/orchestkit'],
      position: 'bottom',
    },
  ],
  animation: 'fade-in',
};
```

#### Voiceover Script
```
[1:45-1:50] "To recap: review-pr gives you instant,
             comprehensive PR analysis."

[1:50-1:55] "Customize with depth and focus flags.
             Export results for team collaboration."

[1:55-2:00] "Next, try the fix-issue skill
             to automatically resolve findings."
```

---

## Complete Frame Reference (90 seconds at 30fps)

| Frame | Time | Phase | Content | VO |
|-------|------|-------|---------|-----|
| 0-90 | 0:00-0:03 | Intro | Title card | "In this tutorial..." |
| 90-210 | 0:03-0:07 | Intro | Objectives | "...automated analysis..." |
| 210-300 | 0:07-0:10 | Intro | Transition | "Let's get started" |
| 300-450 | 0:10-0:15 | Context | Problem | "...time-consuming..." |
| 450-600 | 0:15-0:20 | Context | Pain points | "...miss issues..." |
| 600-750 | 0:20-0:25 | Context | Solution preview | "Here's how" |
| 750-840 | 0:25-0:28 | Step 1 | Header | "Step 1..." |
| 840-990 | 0:28-0:33 | Step 1 | Typing | "Type /ork:review-pr..." |
| 990-1140 | 0:33-0:38 | Step 1 | Execute | "Press Enter..." |
| 1140-1350 | 0:38-0:45 | Step 1 | Output | "Watch as it spawns..." |
| 1350-1500 | 0:45-0:50 | Step 2 | Header | "Step 2..." |
| 1500-1650 | 0:50-0:55 | Step 2 | Categories | "...groups findings..." |
| 1650-1800 | 0:55-1:00 | Step 2 | Details | "...file and line..." |
| 1800-1950 | 1:00-1:05 | Step 2 | Summary | "...total issues..." |
| 1950-2100 | 1:05-1:10 | Step 3 | Header | "Step 3..." |
| 2100-2250 | 1:10-1:15 | Step 3 | Depth flag | "...--depth quick..." |
| 2250-2400 | 1:15-1:20 | Step 3 | Focus flag | "...--focus security..." |
| 2400-2550 | 1:20-1:25 | Step 3 | Export | "Export options..." |
| 2550-2700 | 1:25-1:30 | Integration | Quick scan | "In practice..." |
| 2700-2850 | 1:30-1:35 | Integration | Deep dive | "Then deep-dive..." |
| 2850-3000 | 1:35-1:40 | Integration | Export | "Finally, export..." |
| 3000-3150 | 1:40-1:45 | Integration | Time save | "...15 seconds" |
| 3150-3300 | 1:45-1:50 | Summary | Recap | "To recap..." |
| 3300-3450 | 1:50-1:55 | Summary | Commands | "Customize with..." |
| 3450-3600 | 1:55-2:00 | Next | CTA | "Next, try..." |

---

## Voiceover Guidelines

### Tone
- Friendly but professional
- Clear and measured pace
- Enthusiastic without being over-the-top

### Pacing
```typescript
const voiceoverPacing = {
  wordsPerMinute: 150, // Standard narration pace
  pauseAfterKey: 500,  // Pause after key terms
  pauseBetweenSteps: 1000, // Pause between major sections
  breathingRoom: true, // Allow natural pauses
};
```

### Script Format
```
[TIMESTAMP] Narration text here.
            (emphasis) for key terms.
            [PAUSE] for intentional pauses.
            {VISUAL CUE} for sync points.
```

### Recording Tips
- Record in quiet environment
- Use pop filter
- Leave 2 seconds silence at start/end
- Record each section separately

---

## Visual Accessibility

### Captions
```typescript
const captionSettings = {
  enabled: true,
  style: {
    fontFamily: 'Inter',
    fontSize: 24,
    background: 'rgba(0, 0, 0, 0.8)',
    padding: '8px 16px',
    borderRadius: 4,
    position: 'bottom-center',
    marginBottom: 60,
  },
  timing: {
    leadTime: 0, // Appear with audio
    lagTime: 200, // Stay slightly after
  },
};
```

### Color Considerations
- All text meets WCAG AA contrast
- Don't rely solely on color for meaning
- Use icons alongside color coding

### Motion Sensitivity
- Avoid rapid animations
- Provide static alternatives for GIF exports
- Transitions under 500ms

---

## Remotion Component Structure

```typescript
// Tutorial.tsx
import { AbsoluteFill, Sequence, Audio, useCurrentFrame } from 'remotion';

export const Tutorial: React.FC<TutorialProps> = (props) => {
  const { title, objectives, steps, summary } = props;

  return (
    <AbsoluteFill>
      {/* Voiceover Track */}
      <Audio src={props.voiceover} />

      {/* Background Music (low volume) */}
      <Audio src={backgroundMusic} volume={0.1} />

      {/* Intro */}
      <Sequence from={0} durationInFrames={300}>
        <IntroPhase title={title} objectives={objectives} />
      </Sequence>

      {/* Context */}
      <Sequence from={300} durationInFrames={450}>
        <ContextPhase />
      </Sequence>

      {/* Steps */}
      {steps.map((step, index) => (
        <Sequence
          key={step.id}
          from={750 + index * 600}
          durationInFrames={600}
        >
          <StepPhase step={step} number={index + 1} />
        </Sequence>
      ))}

      {/* Integration */}
      <Sequence from={2550} durationInFrames={600}>
        <IntegrationPhase />
      </Sequence>

      {/* Summary */}
      <Sequence from={3150} durationInFrames={450}>
        <SummaryPhase content={summary} />
      </Sequence>

      {/* Captions (persistent) */}
      <Captions script={props.captionScript} />

      {/* Progress Bar */}
      <ProgressIndicator />
    </AbsoluteFill>
  );
};
```

---

## Quality Checklist

### Pre-Production
- [ ] Script finalized and timed
- [ ] All commands tested
- [ ] Voiceover recorded
- [ ] Assets prepared

### Production
- [ ] Steps flow logically
- [ ] Timing matches voiceover
- [ ] Highlights visible
- [ ] Transitions smooth

### Post-Production
- [ ] Captions accurate
- [ ] Audio balanced
- [ ] Pacing comfortable
- [ ] End card professional

### Educational Quality
- [ ] Objectives met
- [ ] Steps actionable
- [ ] Terms explained
- [ ] Next steps clear

### Platform Optimization
- [ ] YouTube SEO tags
- [ ] Chapters marked
- [ ] Thumbnail compelling
- [ ] Description complete
