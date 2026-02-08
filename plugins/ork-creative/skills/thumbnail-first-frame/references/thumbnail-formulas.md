# Thumbnail Composition Formulas

Deep dive into proven thumbnail layout patterns with psychological foundations and implementation details.

## The Psychology of Thumbnail Scanning

Users process thumbnails in a predictable pattern based on cognitive science:

```
EYE TRACKING PATTERN (F-Pattern for thumbnails)
===============================================

+------------------------------------------+
|  1 -----> 2                              |
|  |                                       |
|  3 -----> 4                              |
|  |                                       |
|  5                                       |
+------------------------------------------+

1. Top-left anchor (face/icon)
2. Horizontal scan (headline)
3. Return to left (secondary element)
4. Second horizontal scan (subtext)
5. Final decision point
```

### Attention Heatmap

```
HIGH ATTENTION          MEDIUM              LOW
==============          ======              ===

+------------------------------------------+
|  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░   |
|  ████████████████░░░░░░░░░░░░░░░░░░░░   |
|  ████████████████████░░░░░░░░░░░░░░░░   |
|  ████████████░░░░░░░░░░░░░░░░░░░░░░░░   |
|  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   |
+------------------------------------------+

Legend: ████ = High attention   ░░░░ = Low attention
```

## Formula Deep Dives

### Formula 1: Face + Text + Context (The Human Connection)

**Why it works:** Humans are hardwired for face detection. The fusiform face area (FFA) in the brain processes faces automatically, making them impossible to ignore.

```
OPTIMAL FACE POSITIONING
========================

+------------------------------------------+
|                                          |
|  +--------+                              |
|  |  FACE  |     TEXT AREA                |
|  | Looking|     "HOOK LINE"              |
|  | RIGHT->|     "supporting text"        |
|  +--------+                              |
|                      [context element]   |
|                                          |
+------------------------------------------+

Face placement: Left 30-40% of frame
Eye direction: Looking toward text (guides viewer)
Expression: Matches content emotion
```

**Expression Library:**

```
EMOTION           USE CASE                    FACE ELEMENTS
=======           ========                    =============
Surprise          Reveals, discoveries        Wide eyes, open mouth
Curiosity         Tutorials, how-to           Raised eyebrow, slight smile
Concern           Warnings, mistakes          Furrowed brow, slight frown
Excitement        Announcements, wins         Big smile, bright eyes
Confusion         Problem-solving             Squinted eyes, tilted head
```

**Face Size Guidelines:**

```
THUMBNAIL TYPE        FACE SIZE       NOTES
==============        =========       =====
Personal brand        40-50%          Face is the brand
Tutorial              30-40%          Balance with content
Review                25-35%          Product shares focus
News/reaction         35-45%          Emotion drives click
```

### Formula 2: Before/After Split (The Transformation Promise)

**Why it works:** Creates immediate visual tension and implies value delivery.

```
SPLIT COMPOSITION OPTIONS
=========================

OPTION A: Vertical Split (most common)
+-------------------+-------------------+
|      BEFORE       |       AFTER       |
|                   |                   |
|   - Dark/dull     |   - Bright/vivid  |
|   - Messy/broken  |   - Clean/fixed   |
|   - Old/outdated  |   - Modern/new    |
+-------------------+-------------------+

OPTION B: Diagonal Split (dynamic)
+------------------------------------------+
|  BEFORE      /                           |
|            /                             |
|          /        AFTER                  |
|        /                                 |
+------------------------------------------+

OPTION C: Overlay Split (subtle)
+------------------------------------------+
|  +--------+                              |
|  | BEFORE |        AFTER                 |
|  | (inset)|        (main image)          |
|  +--------+                              |
+------------------------------------------+
```

**Visual Contrast Techniques:**

```
ELEMENT           BEFORE                AFTER
=======           ======                =====
Saturation        Low (desaturated)     High (vibrant)
Brightness        Dim                   Bright
Sharpness         Soft/blurry           Crisp/sharp
Color temp        Cool (blue tint)      Warm (orange tint)
Complexity        Cluttered             Clean
```

### Formula 3: Number + Benefit (The Listicle Pattern)

**Why it works:** Numbers provide specificity and set expectations. Odd numbers (3, 5, 7) outperform even numbers.

```
NUMBER PERFORMANCE RANKING
==========================

Rank   Number   Why It Works
----   ------   ------------
1      7        "Lucky" associations, memorable
2      5        Easy to remember, feels complete
3      3        Minimal viable list, digestible
4      10       Round number authority
5      9        Close to 10, seems specific
```

**Number Styling:**

```
STYLE 1: Boxed Number
+------------------------------------------+
|                                          |
|     +-------+                            |
|     |   7   |    "SECRETS TO..."         |
|     +-------+                            |
|                                          |
+------------------------------------------+

STYLE 2: Large Background Number
+------------------------------------------+
|                                          |
|        77777777777                        |
|       7            "WAYS TO              |
|      7              IMPROVE"             |
|     7                                    |
|                                          |
+------------------------------------------+

STYLE 3: Circled Number
+------------------------------------------+
|                                          |
|       ( 5 )     "MISTAKES                |
|                  YOU'RE MAKING"          |
|                                          |
+------------------------------------------+
```

### Formula 4: Icon/Product Focus (The Object Hero)

**Why it works:** Works when the subject itself carries recognition value (logos, products, tools).

```
ICON HERO LAYOUTS
=================

LAYOUT A: Centered Icon
+------------------------------------------+
|                                          |
|           +-----------+                  |
|           |           |                  |
|           |   ICON    |                  |
|           |           |                  |
|           +-----------+                  |
|                                          |
|        "HEADLINE BELOW"                  |
+------------------------------------------+

LAYOUT B: Icon + Comparison
+------------------------------------------+
|                                          |
|    [Icon A]    VS    [Icon B]            |
|                                          |
|        "WHICH IS BETTER?"                |
|                                          |
+------------------------------------------+

LAYOUT C: Icon Array
+------------------------------------------+
|                                          |
|   [1]  [2]  [3]  [4]  [5]               |
|                                          |
|     "TOP 5 TOOLS FOR..."                 |
|                                          |
+------------------------------------------+
```

### Formula 5: Question Hook (The Curiosity Gap)

**Why it works:** Open questions create psychological tension that viewers want to resolve.

```
QUESTION LAYOUTS
================

LAYOUT A: Question + Visual Answer Hint
+------------------------------------------+
|                                          |
|     "IS THIS THE BEST                    |
|      WAY TO...?"                         |
|                                          |
|         [Intriguing visual               |
|          that hints at answer]           |
|                                          |
+------------------------------------------+

LAYOUT B: This or That
+------------------------------------------+
|     "WHICH SHOULD                        |
|      YOU USE?"                           |
|                                          |
|    [Option A]  [?]  [Option B]           |
|                                          |
+------------------------------------------+
```

## Combining Formulas

Advanced thumbnails often combine multiple formulas:

```
COMBINATION: Face + Number + Before/After
=========================================

+------------------------------------------+
|                                          |
|  +------+                                |
|  | FACE |    "3 CHANGES"                 |
|  | (wow |                                |
|  | expr)|  [before] --> [after]          |
|  +------+                                |
|                                          |
+------------------------------------------+
```

## Grid System for Thumbnails

Use a 3x3 grid for consistent composition:

```
RULE OF THIRDS GRID
===================

+----------+----------+----------+
|          |          |          |
|    A     |    B     |    C     |
|          |          |          |
+----------+----------+----------+
|          |          |          |
|    D     |    E     |    F     |
|          |          |          |
+----------+----------+----------+
|          |          |          |
|    G     |    H     |    I     |
|          |          |          |
+----------+----------+----------+

POWER POINTS: Intersections (A-B, B-C, D-E, E-F corners)
Place key elements at these intersections for visual impact.
```

**Grid Zone Usage:**

```
ZONE    BEST FOR
====    ========
A       Face/anchor
B       Headline start
C       Icon/logo
D       Secondary face element
E       Central focal point
F       Supporting visual
G       Branding
H       Subtext
I       Call-to-action element
```

## Platform-Specific Adjustments

### YouTube (16:9)

```
+------------------------------------------+
|  [AVOID: Timestamp overlay]      [AVOID] |
|                                          |
|      SAFE ZONE FOR CONTENT               |
|                                          |
|                        [AVOID: Duration] |
+------------------------------------------+
```

### Shorts/Reels/TikTok (9:16)

```
+----------------+
|  [AVOID]       |
|                |
|    MAIN        |
|   CONTENT      |
|    AREA        |
|                |
|  [AVOID]       |
|  [AVOID]       |
+----------------+
```

## Anti-Patterns to Avoid

```
ANTI-PATTERN                WHY IT FAILS
============                ============
Too much text               Can't read at small size
Face looking away           Breaks connection
Low contrast                Invisible in feed
Centered everything         No visual hierarchy
Cluttered composition       No clear focal point
Generic stock photos        Doesn't stand out
Clickbait mismatch          Hurts retention/trust
```

## Testing Your Formula Choice

```
FORMULA SELECTION FLOWCHART
===========================

START
  |
  v
Is there a recognizable face?
  |
  +-- YES --> Use Formula 1 (Face + Text)
  |
  +-- NO --> Is it a transformation?
              |
              +-- YES --> Use Formula 2 (Before/After)
              |
              +-- NO --> Is it a list/tips?
                          |
                          +-- YES --> Use Formula 3 (Number)
                          |
                          +-- NO --> Is there a key product/icon?
                                      |
                                      +-- YES --> Use Formula 4 (Icon Hero)
                                      |
                                      +-- NO --> Use Formula 5 (Question)
```
