# Timing Markers

Detailed specification for marking sync points between narration and visuals, including frame-accurate timing and TTS synchronization.

## Sync Point Notation System

### Marker Types

```
SYNC MARKER LEGEND
==================

Symbol    Name           Description                    Precision
------    ----           -----------                    ---------
[!]       Hard Sync      Word MUST land on frame        +/- 2 frames
[~]       Soft Sync      Word within 500ms window       +/- 15 frames
[...]     Window Sync    Phrase during scene            Flexible
[>]       Lead Sync      Word leads INTO action         100-300ms early
[<]       Lag Sync       Word follows action            100-500ms late
[||]      Pause          Deliberate silence             Specified duration
[*]       Emphasis       Stress this word               N/A
```

### Marker Format

```
Standard Format:
[MARKER TYPE][TIMESTAMP] "Narration text"

Examples:
[!0:03.500] "Click here."
[~0:15.000] "Watch what happens next."
[...0:20-0:25] "This entire section demonstrates the feature."
[>0:30.000] "And now..."
[<0:35.500] "That's the result."
[||0:40.000:500ms] (pause for visual impact)
```

---

## Frame-to-Time Conversion Tables

### Standard Frame Rates

```
CONVERSION TABLE: Frames to Milliseconds
========================================

Frame    24 fps      25 fps      30 fps      60 fps
-----    ------      ------      ------      ------
1        41.67ms     40.00ms     33.33ms     16.67ms
5        208.33ms    200.00ms    166.67ms    83.33ms
10       416.67ms    400.00ms    333.33ms    166.67ms
15       625.00ms    600.00ms    500.00ms    250.00ms
24       1000.00ms   960.00ms    800.00ms    400.00ms
30       1250.00ms   1200.00ms   1000.00ms   500.00ms
45       1875.00ms   1800.00ms   1500.00ms   750.00ms
60       2500.00ms   2400.00ms   2000.00ms   1000.00ms
90       3750.00ms   3600.00ms   3000.00ms   1500.00ms
120      5000.00ms   4800.00ms   4000.00ms   2000.00ms
150      6250.00ms   6000.00ms   5000.00ms   2500.00ms
180      7500.00ms   7200.00ms   6000.00ms   3000.00ms
```

### Quick Conversion Formulas

```
TIME TO FRAMES:
===============
Frames = (Milliseconds / 1000) x FPS

Examples (30 fps):
- 500ms  = 15 frames
- 1000ms = 30 frames
- 2500ms = 75 frames
- 5000ms = 150 frames

FRAMES TO TIME:
===============
Milliseconds = (Frames / FPS) x 1000

Examples (30 fps):
- 15 frames  = 500ms
- 45 frames  = 1500ms
- 90 frames  = 3000ms
- 180 frames = 6000ms
```

### Timestamp Formats

```
TIMESTAMP NOTATION
==================

Format 1 - Seconds.Milliseconds:
  0:03.500 = 3 seconds, 500 milliseconds
  0:15.250 = 15 seconds, 250 milliseconds
  1:30.000 = 1 minute, 30 seconds

Format 2 - Frame Count:
  @frame:45 = Frame 45
  @frame:90 = Frame 90

Format 3 - SMPTE Timecode:
  00:00:03:15 = 3 seconds, 15 frames (at 30fps = 3.5s)
  00:01:30:00 = 1 minute, 30 seconds, 0 frames

Conversion between formats:
  0:03.500 (at 30fps) = @frame:105 = 00:00:03:15
```

---

## Sync Point Use Cases

### Hard Sync [!] Examples

Use when word must land EXACTLY on visual action.

```
USE CASES:
- Click sounds matching mouse clicks
- "Now" on transition starts
- Action words on action completion
- Product name on logo reveal

SCRIPT EXAMPLES:

[!0:05.000] "Click."
Visual: Cursor clicks button at frame 150 (30fps)

[!0:10.500] "Done."
Visual: Checkmark appears at frame 315

[!0:00.000] "OrchestKit."
Visual: Logo fully visible at frame 0

TOLERANCE:
- Ideal: +/- 0 frames
- Acceptable: +/- 2 frames (66ms at 30fps)
- Unacceptable: > 3 frames off
```

### Soft Sync [~] Examples

Use when word should land near but not exactly on action.

```
USE CASES:
- Narration during animations
- Describing ongoing actions
- Scene transitions
- B-roll voiceover

SCRIPT EXAMPLES:

[~0:08.000] "Watch as the interface loads."
Visual: Loading animation plays from 0:07.5 to 0:09.0

[~0:15.500] "See how intuitive this is."
Visual: User navigating menu from 0:14 to 0:17

TOLERANCE:
- Window: +/- 500ms (15 frames at 30fps)
- Can start slightly before or after visual
```

### Window Sync [...] Examples

Use for phrases that span a scene.

```
USE CASES:
- Long explanations over B-roll
- Multiple visual examples
- Montage sequences
- Ambient narration

SCRIPT EXAMPLES:

[...0:20-0:35] "This automation saves hours every week.
               No more manual data entry.
               No more copy-paste errors."
Visual: Montage of automation in action

[...1:00-1:15] "Teams around the world rely on this daily."
Visual: Globe animation with user pins

TOLERANCE:
- Phrase should START within window
- Can END after window if pacing is natural
```

### Lead Sync [>] Examples

Use when narration anticipates the visual.

```
USE CASES:
- Building anticipation
- "Watch this" moments
- Pre-announcing results
- Transition setups

SCRIPT EXAMPLES:

[>0:25.000] "And here's where the magic happens..."
Visual: Major reveal at 0:25.000
Note: Narration starts ~300ms before

[>0:40.000] "Ready?"
Visual: Button press at 0:40.000
Note: Question completes just before click

TIMING GUIDE:
- Start narration 100-300ms before visual
- End word should land WITH or slightly before action
```

### Lag Sync [<] Examples

Use when narration follows a completed action.

```
USE CASES:
- Commenting on results
- Reactions to reveals
- Explaining what just happened
- Pause for impact then speak

SCRIPT EXAMPLES:

[<0:30.500] "Incredible, right?"
Visual: Result appeared at 0:30.000
Note: Narration starts ~500ms after

[<0:50.000] "That's the power of automation."
Visual: Process completed at 0:49.500
Note: Let result breathe before commenting

TIMING GUIDE:
- Start narration 100-500ms after visual
- Creates "reaction" feel
- Good for emotional beats
```

---

## TTS-Specific Sync Markers

### SSML Integration

```xml
SSML SYNC MARKERS
=================

Pause insertion:
<speak>
  Click the button.
  <break time="300ms"/>
  And watch the result.
</speak>

Script notation:
[!0:05.000] "Click the button."
[||0:05.800:300ms]
[!0:06.100] "And watch the result."

Rate control for timing:
<speak>
  <prosody rate="90%">Watch carefully.</prosody>
  <break time="200ms"/>
  <prosody rate="110%">This happens fast.</prosody>
</speak>

Script notation:
[!0:10.000] "Watch carefully." {rate:0.9}
[||0:11.200:200ms]
[~0:11.400] "This happens fast." {rate:1.1}
```

### Emphasis for Sync

```
EMPHASIS MARKERS
================

Word-level emphasis:
[!0:15.000] "*This* is the key feature."
TTS: Stresses "This"

Phrase emphasis:
[!0:20.000] "Not good. *Great*."
TTS: Normal on "Not good", emphasis on "Great"

De-emphasis (for speed):
[~0:25.000] "~If you want~ to learn more..."
TTS: Slightly faster/quieter on "If you want"
```

### Breath and Pause Points

```
PAUSE NOTATION
==============

Short breath (150-200ms):
[||:breath]
Used between clauses

Medium pause (300-500ms):
[||:500ms]
Used for emphasis, transitions

Long pause (500-1000ms):
[||:dramatic]
Used for reveals, impact moments

Example script:
[!0:00.000] "Here's the secret."
[||:500ms] (pause for effect)
[!0:01.500] "It's simpler than you think."
```

---

## Visual Action Types and Sync Strategies

### UI Actions

```
ACTION TYPE        SYNC STRATEGY           EXAMPLE
-----------        -------------           -------
Button click       [!] on click sound      [!] "Click"
Hover              [~] during hover        [~] "Notice this option"
Typing             [~] during typing       [~] "Enter your email"
Form submit        [!] on submit           [!] "Submit"
Page load          [<] after load          [<] "Now you can see..."
Modal open         [>] before open         [>] "Let me show you..."
Dropdown           [~] during expand       [~] "Choose from these"
Toggle             [!] on toggle           [!] "Enable this"
Scroll             [...] during scroll     [...] "Scroll through options"
```

### Transitions

```
TRANSITION TYPE    SYNC STRATEGY           TIMING OFFSET
---------------    -------------           -------------
Cut                [!] on first frame      0ms
Fade               [~] mid-transition      +50% of duration
Slide              [>] before start        -200ms
Zoom               [~] at target state     +80% of duration
Wipe               [...] during wipe       Start to end
Cross-dissolve     [~] at midpoint         +50% of duration
```

### Animations

```
ANIMATION TYPE     SYNC STRATEGY           TIMING POINT
--------------     -------------           ------------
Appear             [!] on first visible    0%
Fade in            [~] at 70% opacity      70%
Slide in           [~] at resting position 100%
Bounce             [!] at settle           After bounce
Scale up           [~] at 80% size         80%
Spin               [...] during rotation   0-100%
Pulse              [!] on peak             Max size
Shake              [...] during shake      0-100%
```

---

## Sync Sheet Template

```markdown
# SYNC SHEET: [Video Title]
# Duration: [Total Duration]
# Frame Rate: [FPS]

---

## Master Sync Points

| Timestamp | Frame | Type | Visual Event | Narration |
|-----------|-------|------|--------------|-----------|
| 0:00.000  | 0     | [!]  | Title in     | "Welcome to..." |
| 0:03.500  | 105   | [~]  | Interface    | "Here's the dashboard" |
| 0:08.000  | 240   | [!]  | Click        | "Click here" |
| 0:10.500  | 315   | [<]  | Result       | "And you're done" |
| 0:12.000  | 360   | [||] | Pause        | (300ms pause) |
| 0:15.000  | 450   | [...] | Demo        | "Watch how easy..." |

---

## Scene Breakdown

### Scene 1: [Name] (0:00 - 0:05)

```
Frame 0     [!] "Welcome"      → Title visible
Frame 45    [~] "to OrchestKit" → Logo animating
Frame 90    [||:200ms]          → Brief pause
Frame 96    [~] "the tool"     → Tagline appears
```

### Scene 2: [Name] (0:05 - 0:12)

```
Frame 150   [>] "Watch this"   → Before button hover
Frame 180   [!] "Click"        → Button click
Frame 240   [<] "Done"         → After checkmark
```

---

## TTS Configuration

Voice: [Voice Name]
Base Rate: [1.0]
Base Pitch: [0]

Special pronunciations:
- "API" → "A P I"
- "npm" → "N P M"
- "v2" → "version two"
```

---

## Common Sync Mistakes and Fixes

```
MISTAKE                        FIX
-------                        ---
Word lands before action       Delay narration or speed up visual
Word lands after action        Speed up narration or slow visual
Overlap feels rushed           Add pause before next phrase
Gap feels empty                Add bridging word or advance phrase
Emphasis on wrong word         Add TTS emphasis marker
Breath cuts off word           Move pause to natural break
```

## Validation Checklist

```
SYNC VALIDATION
===============

[ ] All [!] markers verified frame-accurate
[ ] All [~] markers within 500ms window
[ ] All pauses feel natural
[ ] No unintended silence gaps
[ ] No rushed overlaps
[ ] TTS generated audio matches timing sheet
[ ] Final audio syncs to video export
```
