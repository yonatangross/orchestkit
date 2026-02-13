# Pacing Guidelines

Words-per-minute targets, comprehension research, and platform-specific pacing strategies for narration scripts.

## The Science of Pacing

### Cognitive Load and WPM

```
COMPREHENSION RESEARCH SUMMARY
==============================

Speech Rate         Comprehension    Retention    Use Case
-----------         -------------    ---------    --------
<100 WPM            95-100%          High         Accessibility, elderly
100-120 WPM         90-95%           High         Technical, complex
120-140 WPM         85-90%           Good         Tutorial, educational
140-160 WPM         75-85%           Moderate     Standard content
160-180 WPM         65-75%           Lower        Entertainment
180-200 WPM         50-65%           Low          Energetic, hype
>200 WPM            <50%             Very Low     Auctioneers, rap

Key Finding: Optimal comprehension drops significantly above 150 WPM
             for educational content, but entertainment tolerates higher.
```

### The Processing Window

```
COGNITIVE PROCESSING MODEL
==========================

Spoken words → Auditory buffer (2-3 seconds)
                     ↓
            Working memory processing
                     ↓
            Integration with visuals
                     ↓
            Long-term memory encoding

Implications:
- New concepts need ~2 seconds to process
- Complex ideas need ~3-4 seconds
- Visual + audio together can overload
- Pauses allow integration

Rule of Thumb:
  New concept = 2-3 second pause after
  Complex concept = 3-4 second pause after
  Action instruction = 1-2 second pause for user to act
```

---

## WPM by Content Type

### Technical and Educational Content

```
TECHNICAL CONTENT PACING
========================

Content Type              WPM        Pause Frequency    Notes
------------              ---        ---------------    -----
Code explanation          100-120    Every 6-8 words    Show code, explain
API documentation         110-130    Every 8-10 words   Reference material
Architecture overview     120-140    Every 10-12 words  Concepts + diagrams
Bug walkthrough          130-140    Every 12-14 words  Problem → solution
Configuration tutorial    120-140    Every 8-10 words   Step-by-step
Tool installation        140-150    Every 10-12 words  Action-focused

PACING EXAMPLE - Code Explanation (115 WPM):

"This function takes two parameters. || (pause 1s)
First, the user ID. || (pause 0.5s)
Second, the permission level. || (pause 0.5s)
It returns a boolean. || (pause 1s)
True if authorized. False otherwise."

Words: 23 | Duration: ~12s | Effective WPM: 115
```

### Marketing and Promotional Content

```
MARKETING CONTENT PACING
========================

Content Type              WPM        Energy Level       Notes
------------              ---        ------------       -----
Product launch            150-170    High               Excitement
Feature highlight         140-160    Medium-High        Value-focused
Testimonial               130-150    Medium             Trust, credibility
Brand story               120-140    Medium             Emotional
Quick promo               170-190    Very High          TikTok/Reels
Event announcement        160-180    High               Urgency

PACING EXAMPLE - Product Launch (165 WPM):

"Introducing the fastest way to build APIs. |
No more boilerplate. |
No more configuration headaches. |
Just describe what you want, |
and watch it happen. |
OrchestKit. Build at the speed of thought."

Words: 33 | Duration: ~12s | Effective WPM: 165
```

### Instructional Content

```
INSTRUCTIONAL PACING
====================

Content Type              WPM        Pause Strategy     Notes
------------              ---        --------------     -----
Beginner tutorial         120-130    Frequent (1-2s)    Patient, clear
Intermediate tutorial     130-145    Moderate (0.5-1s)  Efficient
Advanced tutorial         140-155    Minimal            Assumes knowledge
Quick tip                 150-165    Punchy             Dense value
Workshop                  115-130    Extended pauses    Follow-along
Lecture                   120-140    Topic transitions  Academic

PACING EXAMPLE - Beginner Tutorial (125 WPM):

"Step one. || (pause 1.5s)
Open your terminal. || (pause 1s)
Type this command. || (pause 2s - show command)
Press enter. || (pause 1.5s)
You should see this output. || (pause 2s - show output)
If you see an error, || (pause 0.5s)
check your installation."

Words: 28 | Duration: ~13.5s (including pauses) | Effective WPM: 125
```

---

## Platform-Specific Pacing

### Short-Form Platforms

```
TIKTOK PACING
=============

Duration         WPM Range       Pacing Style
--------         ---------       ------------
7-15 seconds     170-190         Rapid-fire, punchy
15-30 seconds    160-180         Fast, few pauses
30-60 seconds    150-170         Moderate speed
60+ seconds      140-160         Slight slowdown

Characteristics:
- Front-load value (first 2 seconds critical)
- No long pauses (>1 second loses viewers)
- Rhythmic delivery (matches music beats)
- Question hooks pace slower for impact
- CTA very fast

Example 15s TikTok (175 WPM):
"Stop. | You're using npm wrong. |
Here's what senior devs do instead. |
Add this flag. | Double your speed. |
Follow for more."

Words: 23 | Duration: ~8s active | Pauses: minimal
```

```
INSTAGRAM REELS PACING
======================

Duration         WPM Range       Pacing Style
--------         ---------       ------------
15-30 seconds    155-175         Aesthetic + fast
30-60 seconds    145-165         Balanced
60-90 seconds    135-155         Slightly slower

Characteristics:
- More polished than TikTok
- Room for aesthetic pauses
- Can have "cinematic" moments
- Voice quality matters more
- Slightly lower energy acceptable

Example 30s Reel (155 WPM):
"Three things I wish I knew before learning React. ||
One. State isn't magic. || (pause 0.5s)
Two. Props flow down. || (pause 0.5s)
Three. Effects have cleanup. ||
Save this for later."

Words: 31 | Duration: ~12s | Pauses: rhythmic
```

```
YOUTUBE SHORTS PACING
=====================

Duration         WPM Range       Pacing Style
--------         ---------       ------------
15-30 seconds    150-170         Value-focused
30-45 seconds    145-160         Teaching pace
45-60 seconds    140-155         Comprehensive

Characteristics:
- More educational than TikTok/Reels
- Hook can be slightly longer (2-3s)
- Value proposition clear upfront
- Subscribe CTAs work better
- Connects to long-form

Example 45s Short (150 WPM):
"Want to learn API design in 45 seconds? ||
Here's the framework every senior dev uses. ||
Step one: Define your resources. ||
Step two: Choose your methods. ||
Step three: Handle errors gracefully. ||
That's REST in a nutshell. ||
Full breakdown in my latest video. Link in bio."

Words: 48 | Duration: ~19s + pauses | Pauses: educational
```

### Long-Form Platforms

```
YOUTUBE LONG-FORM PACING
========================

Section          WPM Range       Duration        Notes
-------          ---------       --------        -----
Cold open        160-175         15-30s          Grab attention
Intro            140-155         30-60s          Set expectations
Main content     130-150         Variable        Teaching pace
Deep dives       120-140         2-5 min each    Complex concepts
Recaps           145-160         30-60s          Faster summary
CTA              150-165         15-30s          Energetic close

PACING CURVE (15-minute video):

Time        WPM     Purpose
----        ---     -------
0:00        165     Cold open hook
0:30        150     Intro
2:00        140     First topic
5:00        135     Deep dive
8:00        130     Most complex part
10:00       140     Building back up
12:00       150     Recap
14:00       160     CTA + close

Average: ~142 WPM with natural variation
```

```
LINKEDIN VIDEO PACING
=====================

Duration         WPM Range       Tone
--------         ---------       ----
30-60 seconds    120-140         Professional
60-90 seconds    115-135         Authoritative
90-180 seconds   110-130         Measured

Characteristics:
- Slower = more professional
- Deliberate pauses for emphasis
- No rushed delivery
- Clear articulation matters
- Business vocabulary
- Thought leadership positioning

Example 60s LinkedIn (128 WPM):
"I've managed engineering teams for fifteen years. ||
And I've learned one crucial lesson. ||
The best code isn't clever. ||
It's maintainable. ||
Let me explain. ||
When a developer writes 'clever' code, || (pause)
they're optimizing for the wrong thing. ||
They're optimizing for themselves. Today. ||
Not for the team. Tomorrow. ||
Great engineers write for the next person."

Words: 64 | Duration: ~30s | Pauses: authoritative
```

---

## Word Budget Calculator

### Duration to Word Count

```
WORD BUDGET BY DURATION AND WPM
===============================

Duration    120 WPM    140 WPM    160 WPM    180 WPM
--------    -------    -------    -------    -------
10s         20         23         27         30
15s         30         35         40         45
20s         40         47         53         60
30s         60         70         80         90
45s         90         105        120        135
60s         120        140        160        180
90s         180        210        240        270
120s        240        280        320        360
3 min       360        420        480        540
5 min       600        700        800        900
10 min      1200       1400       1600       1800
15 min      1800       2100       2400       2700
```

### Accounting for Pauses

```
PAUSE ADJUSTMENT FORMULA
========================

Effective Words = Raw Words x Pause Factor

Pause Density    Factor    Example (100 raw words)
-------------    ------    ----------------------
Minimal          0.95      95 effective words
Light            0.90      90 effective words
Moderate         0.85      85 effective words
Heavy            0.80      80 effective words
Very Heavy       0.75      75 effective words

Example Calculation:
- 60 second video
- Target 140 WPM
- Moderate pauses (0.85 factor)

Raw budget: 140 words
Effective budget: 140 x 0.85 = 119 words
Pause time: 60s x 0.15 = 9 seconds of pauses
```

---

## Pacing Patterns

### The Rhythm Pattern

```
PACING RHYTHM: Fast-Slow-Fast
=============================

Section      Duration    WPM         Purpose
-------      --------    ---         -------
Hook         3s          175         Grab attention
Slow         2s          120         Land key point
Fast         4s          160         Build excitement
Slow         3s          130         Complex concept
Fast         5s          165         Demo/proof
Slow         2s          115         Let it sink in
Fast         3s          170         CTA

Creates natural breathing and emphasis.
```

### The Escalation Pattern

```
PACING ESCALATION: Building Energy
==================================

Phase        WPM Range    Direction    Use For
-----        ---------    ---------    -------
Setup        130-140      Baseline     Context
Build 1      145-155      +10%         First point
Build 2      155-165      +10%         Second point
Build 3      165-175      +10%         Third point
Peak         175-185      +10%         Climax
Resolve      140-150      -20%         CTA, close

Creates momentum toward key message.
```

### The Wave Pattern

```
PACING WAVE: Tension and Release
================================

    WPM
    ^
180 |           ●               ●
    |         /   \           /   \
160 |       /       \       /       \
    |     /           \   /           \
140 |   /               ●               \
    | /                                   \
120 ●                                       ●
    └──────────────────────────────────────────▶ Time
      Hook    Build   Peak   Release   CTA

Use for storytelling, emotional content.
```

---

## Breath and Pause Guidelines

### Natural Breath Points

```
BREATH POINT RULES
==================

Insert breath after:
- Clause boundaries (commas, conjunctions)
- Complete thoughts (periods)
- Questions (before answer)
- List items (each item)
- Key terms (for emphasis)

Breath duration:
- Quick breath: 150-200ms (imperceptible)
- Short pause: 300-500ms (natural)
- Medium pause: 500-800ms (emphasis)
- Long pause: 800-1200ms (dramatic)
- Extended pause: 1200-2000ms (scene change)

Example with breaths:
"The secret to great code... | (300ms)
isn't about writing more. | (200ms)
It's about writing less. | (500ms)
And making every line count."
```

### Pause for Comprehension

```
COMPREHENSION PAUSE TABLE
=========================

Concept Complexity    Pause After    Example
------------------    -----------    -------
Simple fact           0-200ms        "Click the button."
New term              300-500ms      "This is called 'dependency injection.'"
Counter-intuitive     500-800ms      "Less code is actually harder."
Complex concept       800-1200ms     "This architecture pattern separates concerns."
Paradigm shift        1200-2000ms    "Everything you know about X is wrong."
```

---

## Validation and Testing

### Script Timing Test

```
TIMING VALIDATION PROCESS
=========================

1. Write script with target WPM
2. Read aloud with stopwatch
3. Compare actual vs. target
4. Adjust:
   - Too slow? Cut words or speed up
   - Too fast? Add pauses or elaborate

Acceptable variance: +/- 5% of target WPM

Example:
Target: 150 WPM, 60s = 150 words
Acceptable: 143-158 words
```

### TTS Calibration

```
TTS PACING ADJUSTMENTS
======================

TTS Provider     Default WPM    Adjustment
------------     -----------    ----------
OpenAI TTS       ~155           Rate 0.85 for 130 WPM
ElevenLabs       ~150           Speed 0.9 for 135 WPM
Google TTS       ~160           Speaking rate 0.85 for 136 WPM
Azure TTS        ~155           Rate 0.87 for 135 WPM

Formula: Adjusted WPM = Default WPM x Rate Setting
```

### Pacing Checklist

```
PACING VALIDATION CHECKLIST
===========================

Before Recording:
[ ] WPM calculated for each scene
[ ] Total word count matches duration
[ ] Pause points marked
[ ] Breath points identified
[ ] Complex concepts have extra time

After Recording:
[ ] Actual duration within 5% of target
[ ] No rushed sections
[ ] No awkward silences
[ ] Pacing matches content energy
[ ] CTA has appropriate urgency
```

---

## Quick Reference Card

```
PACING QUICK REFERENCE
======================

Educational:    130-150 WPM    Pause: Moderate
Marketing:      150-170 WPM    Pause: Light
Technical:      110-130 WPM    Pause: Heavy
Entertainment:  160-180 WPM    Pause: Minimal
Professional:   120-140 WPM    Pause: Deliberate

PLATFORM CHEAT SHEET
====================
TikTok:     170 WPM
Reels:      160 WPM
Shorts:     150 WPM
YouTube:    140 WPM
LinkedIn:   125 WPM

WORD BUDGET (at 150 WPM)
========================
15s = 38 words
30s = 75 words
60s = 150 words
3m  = 450 words
5m  = 750 words
```
