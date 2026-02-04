# Timing Calculation for Video Narration

Frame-to-millisecond conversion, segment planning, and audio synchronization for video production.

## Core Conversion Formulas

### Frame-to-Time Conversion

```typescript
/**
 * Convert video frames to milliseconds
 * @param frames - Number of frames
 * @param fps - Frames per second (default: 30)
 * @returns Duration in milliseconds
 */
function framesToMs(frames: number, fps: number = 30): number {
  return Math.round((frames / fps) * 1000);
}

/**
 * Convert milliseconds to frames
 * @param ms - Duration in milliseconds
 * @param fps - Frames per second (default: 30)
 * @returns Number of frames
 */
function msToFrames(ms: number, fps: number = 30): number {
  return Math.round((ms / 1000) * fps);
}

/**
 * Convert frames to seconds
 */
function framesToSeconds(frames: number, fps: number = 30): number {
  return frames / fps;
}

/**
 * Convert seconds to frames
 */
function secondsToFrames(seconds: number, fps: number = 30): number {
  return Math.round(seconds * fps);
}
```

### Common FPS Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    FPS REFERENCE TABLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Standard       │ FPS     │ ms/frame  │ Use Case                │
│  ───────────────┼─────────┼───────────┼───────────────────────  │
│  Film           │ 24      │ 41.67     │ Cinema, artistic        │
│  PAL            │ 25      │ 40.00     │ European broadcast      │
│  NTSC           │ 29.97   │ 33.37     │ US broadcast            │
│  Web Standard   │ 30      │ 33.33     │ Online video (default)  │
│  High Frame     │ 60      │ 16.67     │ Gaming, smooth motion   │
│  Slow Motion    │ 120     │ 8.33      │ Sports, action          │
│                                                                  │
│  Quick Calculations (30 fps):                                    │
│  ├── 1 second   = 30 frames  = 1000ms                           │
│  ├── 3 seconds  = 90 frames  = 3000ms                           │
│  ├── 5 seconds  = 150 frames = 5000ms                           │
│  ├── 10 seconds = 300 frames = 10000ms                          │
│  └── 30 seconds = 900 frames = 30000ms                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Words Per Minute (WPM) Calculations

### WPM Reference

```typescript
// Speaking pace constants
const WPM = {
  SLOW: 100,        // Dramatic, emphasize
  DELIBERATE: 120,  // Clear, educational
  NATURAL: 140,     // Comfortable conversation
  STANDARD: 150,    // Default narration
  BRISK: 170,       // Energetic delivery
  FAST: 190,        // Rapid, excited
  MAXIMUM: 200,     // Upper limit for clarity
};

/**
 * Calculate word count from text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Estimate audio duration based on WPM
 * @returns Duration in milliseconds
 */
function estimateAudioDuration(text: string, wpm: number = 150): number {
  const words = countWords(text);
  const minutes = words / wpm;
  return Math.round(minutes * 60 * 1000);
}

/**
 * Calculate required WPM to fit text in duration
 */
function calculateRequiredWpm(text: string, durationMs: number): number {
  const words = countWords(text);
  const minutes = durationMs / 60000;
  return Math.round(words / minutes);
}
```

### WPM by Content Type

```
┌─────────────────────────────────────────────────────────────────┐
│                    WPM BY CONTENT TYPE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Content Type          │ WPM Range  │ Words/30s  │ Feeling      │
│  ──────────────────────┼────────────┼────────────┼────────────  │
│  Dramatic reveals      │ 80-100     │ 40-50      │ Impactful    │
│  Documentary           │ 100-130    │ 50-65      │ Thoughtful   │
│  Tutorial              │ 120-140    │ 60-70      │ Clear        │
│  Standard narration    │ 140-160    │ 70-80      │ Natural      │
│  Product demo          │ 150-170    │ 75-85      │ Engaging     │
│  Marketing             │ 160-180    │ 80-90      │ Energetic    │
│  Social media          │ 170-190    │ 85-95      │ Punchy       │
│                                                                  │
│  Danger Zones:                                                   │
│  ├── Below 80 WPM: Feels awkwardly slow                         │
│  ├── Above 200 WPM: Loses clarity                               │
│  └── Inconsistent WPM: Feels unnatural                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Estimation Table

```
Duration   │ @100 WPM  │ @130 WPM  │ @150 WPM  │ @180 WPM
───────────┼───────────┼───────────┼───────────┼───────────
5 seconds  │ 8 words   │ 11 words  │ 12 words  │ 15 words
10 seconds │ 17 words  │ 22 words  │ 25 words  │ 30 words
15 seconds │ 25 words  │ 33 words  │ 38 words  │ 45 words
30 seconds │ 50 words  │ 65 words  │ 75 words  │ 90 words
60 seconds │ 100 words │ 130 words │ 150 words │ 180 words
90 seconds │ 150 words │ 195 words │ 225 words │ 270 words
120 seconds│ 200 words │ 260 words │ 300 words │ 360 words
```

---

## Segment Planning

### Segment Data Structure

```typescript
interface VideoSegment {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
}

interface TimedSegment extends VideoSegment {
  // Calculated properties
  durationFrames: number;
  durationMs: number;
  durationSeconds: number;

  // Text analysis
  wordCount: number;
  characterCount: number;

  // Pacing
  estimatedAudioMs: number;
  requiredWpm: number;
  targetWpm: number;

  // Validation
  isOverrun: boolean;
  isTooFast: boolean;
  isTooSlow: boolean;
  fitScore: number; // 0-100
}
```

### Segment Timing Calculator

```typescript
interface TimingConfig {
  fps: number;
  targetWpm: number;
  minWpm: number;
  maxWpm: number;
  bufferPercent: number; // Extra time margin
}

const DEFAULT_CONFIG: TimingConfig = {
  fps: 30,
  targetWpm: 150,
  minWpm: 100,
  maxWpm: 180,
  bufferPercent: 10,
};

function calculateSegmentTiming(
  segment: VideoSegment,
  config: TimingConfig = DEFAULT_CONFIG
): TimedSegment {
  // Duration calculations
  const durationFrames = segment.endFrame - segment.startFrame;
  const durationMs = framesToMs(durationFrames, config.fps);
  const durationSeconds = durationMs / 1000;

  // Text analysis
  const wordCount = countWords(segment.text);
  const characterCount = segment.text.length;

  // Pacing calculations
  const estimatedAudioMs = estimateAudioDuration(segment.text, config.targetWpm);
  const bufferMs = durationMs * (config.bufferPercent / 100);
  const availableMs = durationMs - bufferMs;
  const requiredWpm = calculateRequiredWpm(segment.text, availableMs);

  // Validation
  const isOverrun = estimatedAudioMs > durationMs;
  const isTooFast = requiredWpm > config.maxWpm;
  const isTooSlow = requiredWpm < config.minWpm;

  // Fit score (100 = perfect, 0 = impossible)
  let fitScore = 100;
  if (isOverrun) {
    fitScore = Math.max(0, 100 - ((estimatedAudioMs - durationMs) / durationMs) * 100);
  } else if (isTooFast || isTooSlow) {
    const deviation = Math.abs(requiredWpm - config.targetWpm);
    fitScore = Math.max(0, 100 - (deviation / config.targetWpm) * 100);
  }

  return {
    ...segment,
    durationFrames,
    durationMs,
    durationSeconds,
    wordCount,
    characterCount,
    estimatedAudioMs,
    requiredWpm,
    targetWpm: config.targetWpm,
    isOverrun,
    isTooFast,
    isTooSlow,
    fitScore: Math.round(fitScore),
  };
}
```

### Batch Segment Validation

```typescript
interface ValidationResult {
  segments: TimedSegment[];
  summary: {
    totalDurationMs: number;
    totalWords: number;
    averageWpm: number;
    overrunCount: number;
    tooFastCount: number;
    tooSlowCount: number;
    averageFitScore: number;
  };
  warnings: string[];
  errors: string[];
}

function validateSegments(
  segments: VideoSegment[],
  config: TimingConfig = DEFAULT_CONFIG
): ValidationResult {
  const timedSegments = segments.map((s) =>
    calculateSegmentTiming(s, config)
  );

  const warnings: string[] = [];
  const errors: string[] = [];

  // Analyze each segment
  for (const seg of timedSegments) {
    if (seg.isOverrun) {
      errors.push(
        `[${seg.id}] Audio (~${seg.estimatedAudioMs}ms) exceeds ` +
        `scene duration (${seg.durationMs}ms). ` +
        `Reduce text by ~${seg.wordCount - Math.floor(seg.durationMs / 60000 * config.targetWpm)} words.`
      );
    }

    if (seg.isTooFast) {
      warnings.push(
        `[${seg.id}] Required pace ${seg.requiredWpm} WPM exceeds comfortable ` +
        `maximum (${config.maxWpm}). May sound rushed.`
      );
    }

    if (seg.isTooSlow && seg.wordCount > 5) {
      warnings.push(
        `[${seg.id}] Pace ${seg.requiredWpm} WPM below minimum (${config.minWpm}). ` +
        `Consider adding content or shortening scene.`
      );
    }
  }

  // Calculate summary
  const totalDurationMs = timedSegments.reduce(
    (sum, s) => sum + s.durationMs,
    0
  );
  const totalWords = timedSegments.reduce(
    (sum, s) => sum + s.wordCount,
    0
  );

  return {
    segments: timedSegments,
    summary: {
      totalDurationMs,
      totalWords,
      averageWpm: Math.round((totalWords / (totalDurationMs / 60000))),
      overrunCount: timedSegments.filter((s) => s.isOverrun).length,
      tooFastCount: timedSegments.filter((s) => s.isTooFast).length,
      tooSlowCount: timedSegments.filter((s) => s.isTooSlow).length,
      averageFitScore: Math.round(
        timedSegments.reduce((sum, s) => sum + s.fitScore, 0) / timedSegments.length
      ),
    },
    warnings,
    errors,
  };
}
```

---

## Gap and Pause Planning

### Natural Pause Durations

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAUSE TIMING GUIDE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Pause Type           │ Duration     │ Frames @30fps │ Use      │
│  ─────────────────────┼──────────────┼───────────────┼────────  │
│  Comma pause          │ 150-250ms    │ 5-8           │ Breath   │
│  Period pause         │ 300-500ms    │ 9-15          │ Sentence │
│  Paragraph break      │ 600-1000ms   │ 18-30         │ Topic    │
│  Scene transition     │ 1000-2000ms  │ 30-60         │ Context  │
│  Dramatic pause       │ 1500-3000ms  │ 45-90         │ Impact   │
│                                                                  │
│  Buffer Between Scenes:                                          │
│  ├── Quick cut: 0-100ms (0-3 frames)                            │
│  ├── Standard: 200-400ms (6-12 frames)                          │
│  └── Breathe: 500-1000ms (15-30 frames)                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Gap Calculation

```typescript
interface SegmentGap {
  afterSegmentId: string;
  beforeSegmentId: string;
  gapFrames: number;
  gapMs: number;
  recommended: "none" | "short" | "medium" | "long";
}

function calculateGaps(
  segments: VideoSegment[],
  fps: number = 30
): SegmentGap[] {
  const gaps: SegmentGap[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];

    const gapFrames = next.startFrame - current.endFrame;
    const gapMs = framesToMs(gapFrames, fps);

    let recommended: "none" | "short" | "medium" | "long";
    if (gapMs < 100) recommended = "none";
    else if (gapMs < 400) recommended = "short";
    else if (gapMs < 1000) recommended = "medium";
    else recommended = "long";

    gaps.push({
      afterSegmentId: current.id,
      beforeSegmentId: next.id,
      gapFrames,
      gapMs,
      recommended,
    });
  }

  return gaps;
}
```

---

## Timeline Visualization

### ASCII Timeline Generator

```typescript
function visualizeTimeline(
  segments: TimedSegment[],
  width: number = 60
): string {
  const totalMs = segments.reduce(
    (sum, s) => Math.max(sum, framesToMs(s.endFrame, 30)),
    0
  );

  let output = "";

  // Header
  output += "Timeline (each char = " +
    Math.round(totalMs / width) + "ms)\n";
  output += "─".repeat(width) + "\n";

  // Segment bars
  for (const seg of segments) {
    const startPos = Math.round(
      (framesToMs(seg.startFrame, 30) / totalMs) * width
    );
    const endPos = Math.round(
      (framesToMs(seg.endFrame, 30) / totalMs) * width
    );
    const length = Math.max(1, endPos - startPos);

    let bar = " ".repeat(startPos);
    bar += seg.isOverrun ? "!" : (seg.isTooFast ? "▓" : "█");
    bar += "█".repeat(length - 1);

    output += `${seg.id.padEnd(10)} │${bar}\n`;
  }

  // Footer
  output += "─".repeat(width) + "\n";
  output += "0s" + " ".repeat(width - 8) +
    Math.round(totalMs / 1000) + "s\n";

  // Legend
  output += "\nLegend: █ = OK, ▓ = Fast, ! = Overrun\n";

  return output;
}

// Example output:
// Timeline (each char = 167ms)
// ────────────────────────────────────────────────────────────
// hook       │████████
// intro      │        █████████████████
// demo       │                         ███████████████████
// cta        │                                            ████
// ────────────────────────────────────────────────────────────
// 0s                                                       10s
```

---

## Integration with Video Frameworks

### Remotion Integration

```typescript
import { useVideoConfig, Sequence } from "remotion";

interface RemotionTimingProps {
  text: string;
  startFrame: number;
  endFrame: number;
}

function useNarrationTiming(props: RemotionTimingProps) {
  const { fps } = useVideoConfig();

  const timing = calculateSegmentTiming(
    {
      id: "segment",
      text: props.text,
      startFrame: props.startFrame,
      endFrame: props.endFrame,
    },
    { ...DEFAULT_CONFIG, fps }
  );

  return {
    durationInFrames: timing.durationFrames,
    durationMs: timing.durationMs,
    wordCount: timing.wordCount,
    wpm: timing.requiredWpm,
    isValid: !timing.isOverrun && !timing.isTooFast,
    warning: timing.isTooFast
      ? `Speaking pace ${timing.requiredWpm} WPM may be too fast`
      : timing.isOverrun
      ? `Text too long for segment duration`
      : null,
  };
}

// Usage in component
const NarratedScene: React.FC<{ text: string; from: number; duration: number }> = ({
  text,
  from,
  duration,
}) => {
  const timing = useNarrationTiming({
    text,
    startFrame: from,
    endFrame: from + duration,
  });

  if (!timing.isValid) {
    console.warn(`Scene warning: ${timing.warning}`);
  }

  return (
    <Sequence from={from} durationInFrames={timing.durationInFrames}>
      <div>{text}</div>
      <Audio src={`/audio/${timing.durationMs}.mp3`} />
    </Sequence>
  );
};
```

### FFMPEG Timing

```typescript
interface FFmpegTiming {
  startTime: string; // HH:MM:SS.mmm
  duration: string;  // HH:MM:SS.mmm
  endTime: string;   // HH:MM:SS.mmm
}

function msToFFmpegTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:` +
    `${minutes.toString().padStart(2, "0")}:` +
    `${seconds.toString().padStart(2, "0")}.` +
    `${millis.toString().padStart(3, "0")}`;
}

function getFFmpegTiming(segment: TimedSegment): FFmpegTiming {
  const startMs = framesToMs(segment.startFrame, 30);
  const endMs = framesToMs(segment.endFrame, 30);

  return {
    startTime: msToFFmpegTime(startMs),
    duration: msToFFmpegTime(segment.durationMs),
    endTime: msToFFmpegTime(endMs),
  };
}

// Generate FFmpeg command
function generateAudioOverlayCommand(
  videoPath: string,
  segments: { audioPath: string; timing: FFmpegTiming }[]
): string {
  const inputs = segments
    .map((s, i) => `-i "${s.audioPath}"`)
    .join(" ");

  const filters = segments
    .map((s, i) => `[${i + 1}:a]adelay=${msToFFmpegTime(
      parseInt(s.timing.startTime.split(":")[2]) * 1000
    ).replace(":", "")}|${msToFFmpegTime(
      parseInt(s.timing.startTime.split(":")[2]) * 1000
    ).replace(":", "")}[a${i}]`)
    .join(";");

  const mix = segments.map((_, i) => `[a${i}]`).join("");

  return `ffmpeg -i "${videoPath}" ${inputs} ` +
    `-filter_complex "${filters};${mix}amix=inputs=${segments.length}[aout]" ` +
    `-map 0:v -map "[aout]" -c:v copy output.mp4`;
}
```

---

## Timing Adjustment Strategies

### Text Reduction Formulas

```typescript
/**
 * Calculate how many words to remove to fit duration
 */
function calculateWordReduction(segment: TimedSegment): {
  currentWords: number;
  targetWords: number;
  wordsToRemove: number;
  reductionPercent: number;
} {
  const targetWords = Math.floor(
    (segment.durationMs / 60000) * segment.targetWpm
  );

  return {
    currentWords: segment.wordCount,
    targetWords,
    wordsToRemove: Math.max(0, segment.wordCount - targetWords),
    reductionPercent: Math.round(
      ((segment.wordCount - targetWords) / segment.wordCount) * 100
    ),
  };
}

/**
 * Calculate scene extension needed to fit text
 */
function calculateSceneExtension(segment: TimedSegment): {
  currentDurationMs: number;
  requiredDurationMs: number;
  extensionMs: number;
  extensionFrames: number;
} {
  const requiredMs = segment.estimatedAudioMs * 1.1; // 10% buffer

  return {
    currentDurationMs: segment.durationMs,
    requiredDurationMs: Math.round(requiredMs),
    extensionMs: Math.round(Math.max(0, requiredMs - segment.durationMs)),
    extensionFrames: msToFrames(
      Math.max(0, requiredMs - segment.durationMs),
      30
    ),
  };
}
```

### Automated Text Compression

```typescript
/**
 * Suggest text edits to fit timing
 */
function suggestTextEdits(
  text: string,
  targetWordCount: number
): {
  original: string;
  suggestions: string[];
  techniques: string[];
} {
  const words = text.split(/\s+/);
  const currentCount = words.length;
  const toRemove = currentCount - targetWordCount;

  if (toRemove <= 0) {
    return { original: text, suggestions: [], techniques: [] };
  }

  const techniques: string[] = [];
  const suggestions: string[] = [];

  // Technique 1: Remove filler words
  const fillers = ["just", "really", "very", "actually", "basically", "simply"];
  const withoutFillers = words
    .filter((w) => !fillers.includes(w.toLowerCase()))
    .join(" ");

  if (withoutFillers !== text) {
    suggestions.push(withoutFillers);
    techniques.push("Remove filler words");
  }

  // Technique 2: Contract phrases
  const contractions: Record<string, string> = {
    "it is": "it's",
    "you are": "you're",
    "we are": "we're",
    "they are": "they're",
    "do not": "don't",
    "can not": "can't",
    "will not": "won't",
    "is not": "isn't",
    "are not": "aren't",
  };

  let contracted = text;
  for (const [phrase, replacement] of Object.entries(contractions)) {
    contracted = contracted.replace(new RegExp(phrase, "gi"), replacement);
  }

  if (contracted !== text) {
    suggestions.push(contracted);
    techniques.push("Use contractions");
  }

  return { original: text, suggestions, techniques };
}
```

---

## Quick Reference Tables

### Frame/Time Conversion (30 FPS)

| Frames | Milliseconds | Seconds |
|--------|--------------|---------|
| 1 | 33.33 | 0.033 |
| 15 | 500 | 0.5 |
| 30 | 1000 | 1.0 |
| 45 | 1500 | 1.5 |
| 60 | 2000 | 2.0 |
| 90 | 3000 | 3.0 |
| 150 | 5000 | 5.0 |
| 300 | 10000 | 10.0 |
| 450 | 15000 | 15.0 |
| 900 | 30000 | 30.0 |
| 1800 | 60000 | 60.0 |

### WPM/Duration Matrix

| Words | @120 WPM | @150 WPM | @180 WPM |
|-------|----------|----------|----------|
| 10 | 5.0s | 4.0s | 3.3s |
| 25 | 12.5s | 10.0s | 8.3s |
| 50 | 25.0s | 20.0s | 16.7s |
| 75 | 37.5s | 30.0s | 25.0s |
| 100 | 50.0s | 40.0s | 33.3s |
| 150 | 75.0s | 60.0s | 50.0s |
| 200 | 100.0s | 80.0s | 66.7s |
| 300 | 150.0s | 120.0s | 100.0s |

### Validation Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| WPM | 120-160 | 100-120 or 160-180 | <100 or >180 |
| Fit Score | 80-100 | 60-80 | <60 |
| Buffer % | 15-25% | 10-15% or 25-35% | <10% or >35% |
| Overrun | None | 1-10% | >10% |
