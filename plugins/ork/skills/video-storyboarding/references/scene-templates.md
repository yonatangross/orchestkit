# Scene Templates

Copy-paste templates for common scene types in tech demo videos.

## Scene Document Schema

Every scene should follow this structure:

```yaml
scene:
  id: "<3-digit-number>"
  name: "<descriptive-name>"
  phase: "attention|interest|desire|action"

timing:
  start: "MM:SS"
  duration: "MM:SS"
  end: "MM:SS"

content:
  narration: |
    Full script text for voiceover.
    Keep sentences short for pacing.

  on_screen_text:
    - text: "Headline Text"
      position: "top|center|bottom|left|right"
      animation: "fade|scale-in|slide-left|slide-right|typewriter"
      timing: "M:SS-M:SS"

  key_points:
    - "First point"
    - "Second point"

visuals:
  background: "color|gradient|video|image"
  main_element: "Description of primary visual"
  secondary_elements: []

  shots:
    - type: "screen-capture|animation|static|split-screen"
      description: "What this shot shows"
      duration: "Xs"

transitions:
  in: "cut|fade|wipe|zoom"
  out: "cut|fade|wipe|zoom"

audio:
  music: "track-name or description"
  sfx:
    - "sound effect at M:SS"
  voiceover: true|false

assets_required:
  - "asset-filename.ext"

notes: |
  Additional production notes, alternatives, or considerations.
```

---

## Attention Phase Templates

### Template A1: Hook Statement

Best for: Opening with a bold claim or question

```yaml
scene:
  id: "001"
  name: "Hook Statement"
  phase: "attention"

timing:
  start: "0:00"
  duration: "0:05"
  end: "0:05"

content:
  narration: |
    What if [impossible-sounding benefit]?

  on_screen_text:
    - text: "[Bold Question]"
      position: "center"
      animation: "scale-in"
      timing: "0:00-0:05"

visuals:
  background: "dark gradient"
  main_element: "Kinetic typography"

  shots:
    - type: "animation"
      description: "Text animates in with dramatic timing"
      duration: "5s"

transitions:
  in: "cut"
  out: "fade"

audio:
  music: "Building tension"
  sfx:
    - "Subtle whoosh on text reveal"

assets_required:
  - "custom-font.otf"
  - "background-gradient.mp4"

notes: |
  First 3 seconds are critical.
  Question should create curiosity gap.
```

### Template A2: Statistic Hook

Best for: Impressive numbers that demonstrate scale

```yaml
scene:
  id: "001"
  name: "Statistic Hook"
  phase: "attention"

timing:
  start: "0:00"
  duration: "0:08"
  end: "0:08"

content:
  on_screen_text:
    - text: "[Large Number]"
      position: "center"
      animation: "counter-up"
      timing: "0:00-0:03"

    - text: "[What the number represents]"
      position: "center-below"
      animation: "fade"
      timing: "0:03-0:05"

    - text: "[Context or second stat]"
      position: "center"
      animation: "scale-in"
      timing: "0:05-0:08"

visuals:
  background: "animated particles"
  main_element: "Large animated numbers"

  shots:
    - type: "animation"
      description: "Number counting up animation"
      duration: "3s"
    - type: "animation"
      description: "Context text fade in"
      duration: "5s"

transitions:
  in: "cut"
  out: "quick-cut"

audio:
  sfx:
    - "Tick sounds during counter (subtle)"
    - "Impact sound on final number"

assets_required:
  - "counter-animation-preset"

notes: |
  Numbers should be genuinely impressive.
  Use specific numbers (163, not "100+").

  OrchestKit example:
  "163 Skills • 34 Agents • 144 Hooks"
```

### Template A3: Pain Point Opening

Best for: Connecting with audience frustration

```yaml
scene:
  id: "001"
  name: "Pain Point Hook"
  phase: "attention"

timing:
  start: "0:00"
  duration: "0:06"
  end: "0:06"

content:
  narration: |
    Stop [frustrating activity that wastes time].

  on_screen_text:
    - text: "Stop [Activity]"
      position: "center"
      animation: "slam"
      timing: "0:00-0:03"

    - text: "[Consequence of activity]"
      position: "center"
      animation: "fade"
      timing: "0:03-0:06"

visuals:
  background: "subtle warning color gradient"
  main_element: "Strong typography with emphasis"

  shots:
    - type: "animation"
      description: "Text slams onto screen"
      duration: "3s"
    - type: "animation"
      description: "Consequence fades in below"
      duration: "3s"

transitions:
  in: "cut"
  out: "fade"

audio:
  sfx:
    - "Impact sound on 'Stop'"

notes: |
  The pain point must be immediately recognizable.
  Don't dwell on negativity - move quickly to solution.

  OrchestKit example:
  "Stop rewriting prompts. Start building."
```

---

## Interest Phase Templates

### Template I1: Problem Setup

Best for: Establishing the problem your product solves

```yaml
scene:
  id: "002"
  name: "Problem Setup"
  phase: "interest"

timing:
  start: "0:06"
  duration: "0:12"
  end: "0:18"

content:
  narration: |
    [Describe the current frustrating situation]
    [What most people do - the old way]
    [Why it doesn't work]

  on_screen_text:
    - text: "The Problem"
      position: "top-left"
      animation: "fade"
      timing: "0:06-0:08"

visuals:
  background: "muted, slightly desaturated"
  main_element: "Screen capture or illustration of problem"

  shots:
    - type: "screen-capture"
      description: "Messy workflow / manual process"
      duration: "6s"
    - type: "split-screen"
      description: "Multiple examples of the problem"
      duration: "6s"

transitions:
  in: "fade"
  out: "fade-to-contrast"

audio:
  music: "Slightly tense, building"

notes: |
  Show, don't just tell the problem.
  Use relatable scenarios your audience experiences daily.

  OrchestKit example:
  Show cluttered notes, scattered prompts, repeated explanations
```

### Template I2: Solution Introduction

Best for: First reveal of your product solving the problem

```yaml
scene:
  id: "003"
  name: "Solution Introduction"
  phase: "interest"

timing:
  start: "0:18"
  duration: "0:15"
  end: "0:33"

content:
  narration: |
    [Product name] changes everything.
    [One sentence explanation of what it does]
    [Key differentiator]

  on_screen_text:
    - text: "[Product Name]"
      position: "center"
      animation: "scale-in"
      timing: "0:18-0:21"

    - text: "[Tagline]"
      position: "center-below"
      animation: "fade"
      timing: "0:21-0:24"

visuals:
  background: "bright, saturated - contrast from problem"
  main_element: "Product logo or hero shot"

  shots:
    - type: "animation"
      description: "Logo reveal with energy"
      duration: "6s"
    - type: "screen-capture"
      description: "First glimpse of product in action"
      duration: "9s"

transitions:
  in: "contrast-wipe"
  out: "cut"

audio:
  music: "Uplifting shift"
  sfx:
    - "Positive chime on reveal"

notes: |
  This is the "breath of fresh air" moment.
  Visual contrast from problem scene is important.
  Keep explanation simple - details come later.

  OrchestKit example:
  Logo reveal, then terminal showing /ork:implement
```

### Template I3: Feature Walkthrough

Best for: Demonstrating key capabilities

```yaml
scene:
  id: "004"
  name: "Feature Walkthrough"
  phase: "interest"

timing:
  start: "0:33"
  duration: "0:20"
  end: "0:53"

content:
  narration: |
    [Feature 1 name] - [what it does and why it matters]
    [Feature 2 name] - [what it does and why it matters]
    [Feature 3 name] - [what it does and why it matters]

  on_screen_text:
    - text: "Feature 1"
      position: "top-left"
      animation: "slide-right"
      timing: "0:33-0:40"

    - text: "Feature 2"
      position: "top-left"
      animation: "slide-right"
      timing: "0:40-0:47"

    - text: "Feature 3"
      position: "top-left"
      animation: "slide-right"
      timing: "0:47-0:53"

visuals:
  main_element: "Screen captures of each feature"

  shots:
    - type: "screen-capture"
      description: "Feature 1 demo"
      duration: "7s"
    - type: "screen-capture"
      description: "Feature 2 demo"
      duration: "7s"
    - type: "screen-capture"
      description: "Feature 3 demo"
      duration: "6s"

transitions:
  in: "cut"
  out: "cut"

audio:
  music: "Steady, informative"
  sfx:
    - "Subtle transition sound between features"

notes: |
  3 features maximum to maintain attention.
  Each feature gets equal time.
  Benefits, not just specifications.

  OrchestKit example:
  1. Skill library (163 patterns)
  2. Parallel agents (multi-tasking)
  3. Quality hooks (automated validation)
```

---

## Desire Phase Templates

### Template D1: Benefits Demonstration

Best for: Showing outcomes and transformations

```yaml
scene:
  id: "005"
  name: "Benefits Demo"
  phase: "desire"

timing:
  start: "0:53"
  duration: "0:15"
  end: "1:08"

content:
  narration: |
    [Benefit 1 with specific outcome]
    [Benefit 2 with measurable result]
    [Benefit 3 with emotional payoff]

  on_screen_text:
    - text: "[Metric/Outcome 1]"
      position: "center"
      animation: "fade"
      timing: "0:53-0:58"

    - text: "[Metric/Outcome 2]"
      position: "center"
      animation: "fade"
      timing: "0:58-1:03"

    - text: "[Metric/Outcome 3]"
      position: "center"
      animation: "fade"
      timing: "1:03-1:08"

visuals:
  main_element: "Before/after or metric visualizations"

  shots:
    - type: "split-screen"
      description: "Before and after comparison"
      duration: "5s"
    - type: "animation"
      description: "Metrics animation"
      duration: "5s"
    - type: "screen-capture"
      description: "Happy path result"
      duration: "5s"

transitions:
  in: "fade"
  out: "fade"

audio:
  music: "Triumphant, building"

notes: |
  Focus on OUTCOMES, not features.
  Use specific numbers when possible.
  Show the transformation visually.

  OrchestKit example:
  - "10x faster setup" (side-by-side)
  - "Zero forgotten patterns" (skill recall)
  - "Consistent quality" (hook validation)
```

### Template D2: Social Proof

Best for: Building trust through others' success

```yaml
scene:
  id: "006"
  name: "Social Proof"
  phase: "desire"

timing:
  start: "1:08"
  duration: "0:10"
  end: "1:18"

content:
  on_screen_text:
    - text: "[Impressive metric]"
      position: "center"
      animation: "counter-up"
      timing: "1:08-1:12"

    - text: "[Context for metric]"
      position: "center-below"
      animation: "fade"
      timing: "1:12-1:18"

visuals:
  main_element: "Metrics visualization or user logos"

  shots:
    - type: "animation"
      description: "Number counting animation"
      duration: "4s"
    - type: "static"
      description: "User logos or GitHub activity"
      duration: "6s"

transitions:
  in: "fade"
  out: "fade"

audio:
  sfx:
    - "Subtle success sound"

notes: |
  Use real, verifiable numbers.
  GitHub stars, downloads, active users.
  Company logos if you have them.

  OrchestKit example:
  - GitHub stars count
  - "Used in 50+ projects"
  - Active development visualization
```

---

## Action Phase Templates

### Template AC1: Simple CTA

Best for: Single clear action

```yaml
scene:
  id: "007"
  name: "Call to Action"
  phase: "action"

timing:
  start: "1:18"
  duration: "0:08"
  end: "1:26"

content:
  narration: |
    [Clear instruction for next step]
    [Time/effort required]

  on_screen_text:
    - text: "[Action verb + what to do]"
      position: "center"
      animation: "scale-in"
      timing: "1:18-1:22"

    - text: "[Command or URL]"
      position: "center"
      animation: "typewriter"
      timing: "1:22-1:26"

visuals:
  background: "brand color, high contrast"
  main_element: "CTA button or command"

  shots:
    - type: "animation"
      description: "CTA text with button/command"
      duration: "8s"

transitions:
  in: "contrast-wipe"
  out: "fade"

audio:
  sfx:
    - "Click sound on CTA"

notes: |
  One action only.
  Make the command copyable if shown.
  Mention how quick/easy it is.

  OrchestKit example:
  "Add to Claude Code in 30 seconds"
  claude mcp add orchestkit
```

### Template AC2: End Card

Best for: Closing with brand and resources

```yaml
scene:
  id: "008"
  name: "End Card"
  phase: "action"

timing:
  start: "1:26"
  duration: "0:04"
  end: "1:30"

content:
  on_screen_text:
    - text: "[Product Name]"
      position: "center"
      animation: "fade"
      timing: "1:26-1:28"

    - text: "[Tagline]"
      position: "center-below"
      animation: "fade"
      timing: "1:28-1:30"

visuals:
  background: "brand color"
  main_element: "Logo"
  secondary_elements:
    - "Website URL"
    - "Social handles (optional)"

  shots:
    - type: "static"
      description: "Logo with tagline"
      duration: "4s"

transitions:
  in: "fade"
  out: "fade-to-black"

audio:
  music: "Resolve to ending"

notes: |
  Keep it brief.
  Logo should be recognizable.
  Don't clutter with too much info.
```

---

## Specialty Scene Templates

### Template S1: Before/After Split

Best for: Visual comparison of improvement

```yaml
scene:
  id: "0XX"
  name: "Before After Split"
  phase: "desire"

timing:
  duration: "0:08"

content:
  on_screen_text:
    - text: "Before"
      position: "top-left"
      timing: "full"

    - text: "After"
      position: "top-right"
      timing: "full"

visuals:
  main_element: "Split screen comparison"

  shots:
    - type: "split-screen"
      description: |
        Left: Old way (messy, slow, frustrating)
        Right: New way (clean, fast, satisfying)
      duration: "8s"

audio:
  music: "Contrast - tense to positive"

notes: |
  Both sides should be visually distinct.
  Use color grading: desaturated before, vibrant after.
  Motion should favor the "after" side.
```

### Template S2: Command Demo

Best for: Showing CLI or terminal interaction

```yaml
scene:
  id: "0XX"
  name: "Command Demo"
  phase: "interest"

timing:
  duration: "0:10"

content:
  on_screen_text:
    - text: "[Command purpose]"
      position: "top"
      animation: "fade"

visuals:
  background: "terminal theme"
  main_element: "Terminal window"

  shots:
    - type: "screen-capture"
      description: |
        Terminal with command typed slowly,
        output appearing line by line
      duration: "10s"

audio:
  sfx:
    - "Keyboard sounds (subtle)"
    - "Success sound on completion"

notes: |
  Use a clean terminal theme.
  Slow down typing for readability.
  Highlight important output.
  Consider zoom/focus on key elements.
```

### Template S3: Feature Montage

Best for: Rapid showcase of multiple capabilities

```yaml
scene:
  id: "0XX"
  name: "Feature Montage"
  phase: "interest"

timing:
  duration: "0:12"

content:
  narration: |
    [Quick list of features with energy]

visuals:
  main_element: "Quick cuts between features"

  shots:
    - type: "screen-capture"
      description: "Feature 1"
      duration: "2s"
    - type: "screen-capture"
      description: "Feature 2"
      duration: "2s"
    - type: "screen-capture"
      description: "Feature 3"
      duration: "2s"
    - type: "screen-capture"
      description: "Feature 4"
      duration: "2s"
    - type: "screen-capture"
      description: "Feature 5"
      duration: "2s"
    - type: "screen-capture"
      description: "Feature 6"
      duration: "2s"

transitions:
  between: "quick-cut"

audio:
  music: "Fast-paced, energetic"

notes: |
  Each clip should be self-explanatory.
  Consider text labels for each feature.
  Rhythm should match music.
  Don't exceed 2s per feature or it drags.
```

---

## Quick Reference: Scene Duration Guidelines

```
┌──────────────────────────────────────────────────────────────────┐
│                   SCENE DURATION GUIDE                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Scene Type              │ Minimum  │ Optimal  │ Maximum        │
│  ────────────────────────┼──────────┼──────────┼────────        │
│  Hook Statement          │ 3s       │ 5s       │ 8s             │
│  Problem Setup           │ 8s       │ 12s      │ 20s            │
│  Solution Intro          │ 10s      │ 15s      │ 25s            │
│  Feature Demo            │ 5s       │ 8s       │ 15s            │
│  Benefits                │ 8s       │ 12s      │ 20s            │
│  Social Proof            │ 5s       │ 8s       │ 12s            │
│  CTA                     │ 5s       │ 8s       │ 12s            │
│  End Card                │ 3s       │ 4s       │ 6s             │
│  Split Screen            │ 5s       │ 8s       │ 12s            │
│  Command Demo            │ 8s       │ 12s      │ 20s            │
│  Montage (per clip)      │ 1s       │ 2s       │ 3s             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
