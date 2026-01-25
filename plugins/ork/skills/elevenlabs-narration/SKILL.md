---
name: elevenlabs-narration
description: ElevenLabs TTS integration for video narration - voice selection, segment timing, and script-to-audio pipeline
tags: [video, audio, narration, tts, elevenlabs, voice, speech]
user-invocable: false
version: 1.0.0
---

# ElevenLabs Narration for Video Production

Complete integration guide for using ElevenLabs text-to-speech in video production pipelines. Covers voice selection, timing calculations, API patterns, and cost optimization for professional narration.

## Overview

- Generating narration audio for video segments
- Selecting appropriate voices for content type
- Calculating segment timing from frames to milliseconds
- Building script-to-audio pipelines
- Optimizing API usage and costs
- Handling rate limits and errors

## ElevenLabs API Overview

### Model Comparison (2026)

| Model | Latency | Quality | Cost | Best For |
|-------|---------|---------|------|----------|
| **eleven_multilingual_v2** | Medium | Best | $0.30/1K chars | Production, multilingual |
| **eleven_turbo_v2_5** | Low | Excellent | $0.18/1K chars | Real-time, drafts |
| **eleven_flash_v2_5** | Lowest | Good | $0.08/1K chars | Previews, testing |
| **eleven_english_sts_v2** | Medium | Best | $0.30/1K chars | Speech-to-speech |

### API Endpoints

```
Base URL: https://api.elevenlabs.io/v1

POST /text-to-speech/{voice_id}           # Generate audio
POST /text-to-speech/{voice_id}/stream    # Stream audio
GET  /voices                              # List voices
GET  /voices/{voice_id}                   # Voice details
GET  /user                                # Usage/quota
POST /speech-to-speech/{voice_id}         # Voice conversion
```

## Core Integration Pattern

### Basic Text-to-Speech

```typescript
import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

async function generateNarration(
  text: string,
  voiceId: string = 'Rachel'
): Promise<Buffer> {
  const audio = await client.generate({
    voice: voiceId,
    text: text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0,
      use_speaker_boost: true
    }
  });

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

### Streaming for Low Latency

```typescript
async function* streamNarration(
  text: string,
  voiceId: string
): AsyncGenerator<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      })
    }
  );

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield Buffer.from(value);
  }
}
```

## Voice Selection Guide

### Pre-Built Voices for Video Narration

| Voice | ID | Characteristics | Use Case |
|-------|-----|-----------------|----------|
| **Rachel** | 21m00Tcm4TlvDq8ikWAM | Warm, conversational | General narration |
| **Adam** | pNInz6obpgDQGcFmaJgB | Deep, authoritative | Tech explainers |
| **Antoni** | ErXwobaYiN019PkySvjV | Energetic, youthful | Product demos |
| **Bella** | EXAVITQu4vr4xnSDxMaL | Friendly, engaging | Tutorials |
| **Domi** | AZnzlk1XvdvUeBnXmlld | Clear, professional | Corporate |
| **Elli** | MF3mGyEYCl7XYWbV9V6O | Soft, calming | Meditation, wellness |
| **Josh** | TxGEqnHWrfWFTfGW9XjX | Deep, narrative | Documentaries |
| **Sam** | yoZ06aMxZJJ28mfd3POQ | Energetic, dynamic | Marketing |

### Voice Selection by Content Type

```
Content Type          Recommended Voices       Settings
------------------------------------------------------------
Tech Demo            Adam, Rachel             stability: 0.6, similarity: 0.8
Product Launch       Antoni, Sam              stability: 0.4, similarity: 0.9
Tutorial             Bella, Rachel            stability: 0.7, similarity: 0.75
Documentary          Josh, Adam               stability: 0.8, similarity: 0.85
Corporate            Domi, Adam               stability: 0.7, similarity: 0.8
Social Media         Antoni, Sam              stability: 0.3, similarity: 0.9
```

### Voice Settings Explained

```typescript
interface VoiceSettings {
  stability: number;        // 0.0-1.0 (lower = more expressive)
  similarity_boost: number; // 0.0-1.0 (higher = closer to original)
  style: number;           // 0.0-1.0 (v2 models only)
  use_speaker_boost: boolean; // Clarity enhancement
}

// Recommended settings by content type
const VOICE_PRESETS = {
  narration: { stability: 0.65, similarity_boost: 0.8, style: 0.0 },
  conversational: { stability: 0.4, similarity_boost: 0.75, style: 0.2 },
  dramatic: { stability: 0.3, similarity_boost: 0.9, style: 0.5 },
  professional: { stability: 0.8, similarity_boost: 0.85, style: 0.0 },
  energetic: { stability: 0.35, similarity_boost: 0.85, style: 0.4 }
};
```

## Segment Timing Calculations

### Frame-to-Milliseconds Conversion

```typescript
/**
 * Convert video frames to milliseconds
 */
function framesToMs(frames: number, fps: number = 30): number {
  return Math.round((frames / fps) * 1000);
}

function msToFrames(ms: number, fps: number = 30): number {
  return Math.round((ms / 1000) * fps);
}

// Common FPS values
const FPS = {
  FILM: 24,
  NTSC: 29.97,
  WEB: 30,
  SMOOTH: 60
};

// Examples
framesToMs(90, 30);   // 3000ms (3 seconds at 30fps)
framesToMs(150, 30);  // 5000ms (5 seconds at 30fps)
msToFrames(2500, 30); // 75 frames
```

### Segment Timing Calculator

```typescript
interface VideoSegment {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  fps: number;
}

interface TimedSegment extends VideoSegment {
  startMs: number;
  endMs: number;
  durationMs: number;
  estimatedReadTime: number;
  wordsPerMinute: number;
}

function calculateSegmentTiming(
  segment: VideoSegment,
  targetWpm: number = 150
): TimedSegment {
  const startMs = framesToMs(segment.startFrame, segment.fps);
  const endMs = framesToMs(segment.endFrame, segment.fps);
  const durationMs = endMs - startMs;

  const wordCount = segment.text.split(/\s+/).length;
  const estimatedReadTime = (wordCount / targetWpm) * 60 * 1000;
  const wordsPerMinute = (wordCount / durationMs) * 60 * 1000;

  return {
    ...segment,
    startMs,
    endMs,
    durationMs,
    estimatedReadTime,
    wordsPerMinute
  };
}

// Validate segment fits the available time
function validateSegmentTiming(segment: TimedSegment): {
  valid: boolean;
  warning?: string;
} {
  if (segment.wordsPerMinute > 180) {
    return {
      valid: false,
      warning: `WPM ${Math.round(segment.wordsPerMinute)} too fast. ` +
               `Reduce text or extend segment.`
    };
  }
  if (segment.wordsPerMinute < 100) {
    return {
      valid: true,
      warning: `WPM ${Math.round(segment.wordsPerMinute)} slow. ` +
               `Consider adding content.`
    };
  }
  return { valid: true };
}
```

### Words Per Minute Reference

```
Speaking Speed       WPM     Words/30s    Use Case
----------------------------------------------------------
Slow (dramatic)      100     50           Hooks, reveals
Normal narration     130-150 65-75        Standard content
Conversational       150-170 75-85        Tutorials, demos
Fast (excited)       170-190 85-95        Features, energy
Very fast            200+    100+         Avoid (unclear)
```

## Script-to-Audio Pipeline

### Complete Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   NARRATION PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │  SCRIPT  │──▶│  TIMING  │──▶│   TTS    │──▶│  OUTPUT  │     │
│  │          │   │          │   │          │   │          │     │
│  │ • Parse  │   │ • Frames │   │ • Voice  │   │ • Cache  │     │
│  │ • Split  │   │ • WPM    │   │ • Stream │   │ • Export │     │
│  │ • SSML   │   │ • Pad    │   │ • Retry  │   │ • Merge  │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline Implementation

```typescript
import { createHash } from 'crypto';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';

interface NarrationSegment {
  id: string;
  text: string;
  voiceId: string;
  startFrame: number;
  endFrame: number;
}

interface GeneratedAudio {
  segmentId: string;
  audioBuffer: Buffer;
  durationMs: number;
  cached: boolean;
}

class NarrationPipeline {
  private cacheDir: string;
  private fps: number;

  constructor(cacheDir: string = './audio-cache', fps: number = 30) {
    this.cacheDir = cacheDir;
    this.fps = fps;
  }

  /**
   * Generate audio for all segments with caching
   */
  async generateAll(
    segments: NarrationSegment[],
    voiceSettings?: VoiceSettings
  ): Promise<GeneratedAudio[]> {
    const results: GeneratedAudio[] = [];

    for (const segment of segments) {
      // Check cache first
      const cacheKey = this.getCacheKey(segment);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.mp3`);

      if (existsSync(cachePath)) {
        const buffer = readFileSync(cachePath);
        results.push({
          segmentId: segment.id,
          audioBuffer: buffer,
          durationMs: await this.getAudioDuration(buffer),
          cached: true
        });
        continue;
      }

      // Generate new audio
      const audio = await this.generateSegment(segment, voiceSettings);

      // Cache the result
      writeFileSync(cachePath, audio.audioBuffer);

      results.push({
        ...audio,
        cached: false
      });

      // Rate limit protection (10 requests/second)
      await this.delay(100);
    }

    return results;
  }

  private async generateSegment(
    segment: NarrationSegment,
    settings?: VoiceSettings
  ): Promise<GeneratedAudio> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${segment.voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: segment.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: settings ?? {
            stability: 0.5,
            similarity_boost: 0.8
          }
        })
      }
    );

    if (!response.ok) {
      throw new NarrationError(
        `ElevenLabs API error: ${response.status}`,
        segment.id,
        await response.text()
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const durationMs = await this.getAudioDuration(buffer);

    return {
      segmentId: segment.id,
      audioBuffer: buffer,
      durationMs,
      cached: false
    };
  }

  private getCacheKey(segment: NarrationSegment): string {
    const content = `${segment.text}|${segment.voiceId}`;
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getAudioDuration(buffer: Buffer): Promise<number> {
    // Simplified - use audio library for accurate duration
    // MP3 at 128kbps: duration = bytes / (128000 / 8)
    return Math.round((buffer.length / 16000) * 1000);
  }
}
```

### SSML Support for Advanced Control

```typescript
/**
 * ElevenLabs supports limited SSML tags for timing control
 */
function buildSSML(text: string, options: {
  pauseMs?: number;
  emphasis?: boolean;
  rate?: 'slow' | 'medium' | 'fast';
}): string {
  let ssml = text;

  // Add pauses
  if (options.pauseMs) {
    ssml = ssml.replace(/\.\s/g, `. <break time="${options.pauseMs}ms"/> `);
  }

  // Wrap in speak tags
  return `<speak>${ssml}</speak>`;
}

// Example usage
const narrationText = buildSSML(
  "Welcome to OrchestKit. The most powerful plugin for Claude Code.",
  { pauseMs: 300 }
);
// Output: <speak>Welcome to OrchestKit. <break time="300ms"/> The most...</speak>
```

## Error Handling and Rate Limits

### Rate Limit Management

```typescript
interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

class RateLimitedClient {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private requestsPerSecond = 10;

  async request<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
      await new Promise(r =>
        setTimeout(r, 1000 / this.requestsPerSecond)
      );
    }

    this.processing = false;
  }
}
```

### Error Types and Handling

```typescript
class NarrationError extends Error {
  constructor(
    message: string,
    public segmentId: string,
    public apiResponse?: string
  ) {
    super(message);
    this.name = 'NarrationError';
  }
}

async function generateWithRetry(
  segment: NarrationSegment,
  maxRetries: number = 3
): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateNarration(segment.text, segment.voiceId);
    } catch (error) {
      lastError = error as Error;

      if (isRateLimitError(error)) {
        // Wait for rate limit reset
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited. Waiting ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
      } else if (isQuotaError(error)) {
        throw new NarrationError(
          'API quota exceeded. Check your ElevenLabs plan.',
          segment.id
        );
      } else {
        // Unknown error - wait and retry
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error('Generation failed');
}

function isRateLimitError(error: unknown): boolean {
  return (error as any)?.status === 429;
}

function isQuotaError(error: unknown): boolean {
  return (error as any)?.message?.includes('quota');
}
```

## Cost Optimization

### Character Counting

```typescript
function countCharacters(text: string): number {
  // ElevenLabs counts all characters including spaces
  return text.length;
}

function estimateCost(
  text: string,
  model: 'multilingual' | 'turbo' | 'flash' = 'multilingual'
): number {
  const chars = countCharacters(text);

  const costPer1K = {
    multilingual: 0.30,
    turbo: 0.18,
    flash: 0.08
  };

  return (chars / 1000) * costPer1K[model];
}

// Example
const script = "Welcome to our product demo. Today we'll explore...";
console.log(`Cost: $${estimateCost(script, 'turbo').toFixed(4)}`);
```

### Cost Optimization Strategies

```
Strategy                   Savings    Implementation
------------------------------------------------------------------
1. Use Turbo for drafts    40%        Switch model_id during preview
2. Cache generated audio   100%       Hash text+voice, store locally
3. Batch similar requests  20%        Group by voice, reduce overhead
4. Compress scripts        Varies     Remove filler words, tighten copy
5. Use Flash for previews  73%        Draft with flash, final with v2
```

### Caching Strategy

```typescript
interface CacheConfig {
  enabled: boolean;
  directory: string;
  maxAge: number; // milliseconds
}

const CACHE_CONFIG: CacheConfig = {
  enabled: true,
  directory: './narration-cache',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

function getCacheKey(text: string, voiceId: string, model: string): string {
  const content = JSON.stringify({ text, voiceId, model });
  return createHash('sha256').update(content).digest('hex');
}

async function getOrGenerate(
  text: string,
  voiceId: string,
  model: string
): Promise<Buffer> {
  const key = getCacheKey(text, voiceId, model);
  const cachePath = path.join(CACHE_CONFIG.directory, `${key}.mp3`);

  // Check cache
  if (CACHE_CONFIG.enabled && existsSync(cachePath)) {
    const stats = statSync(cachePath);
    if (Date.now() - stats.mtimeMs < CACHE_CONFIG.maxAge) {
      return readFileSync(cachePath);
    }
  }

  // Generate fresh
  const audio = await generateNarration(text, voiceId);

  // Store in cache
  if (CACHE_CONFIG.enabled) {
    writeFileSync(cachePath, audio);
  }

  return audio;
}
```

## Remotion Integration

### Audio Component for Remotion

```typescript
import { Audio, useCurrentFrame, useVideoConfig } from 'remotion';

interface NarrationProps {
  audioUrl: string;
  startFrame: number;
  volume?: number;
}

export const Narration: React.FC<NarrationProps> = ({
  audioUrl,
  startFrame,
  volume = 1
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Audio
      src={audioUrl}
      startFrom={0}
      volume={volume}
      // Audio starts at this frame in the video
      // Remotion handles the sync automatically
    />
  );
};

// Usage in a scene
export const NarratedScene: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <>
      <Sequence from={0} durationInFrames={150}>
        <HookScene />
        <Narration
          audioUrl="/audio/hook-narration.mp3"
          startFrame={0}
        />
      </Sequence>

      <Sequence from={150} durationInFrames={300}>
        <DemoScene />
        <Narration
          audioUrl="/audio/demo-narration.mp3"
          startFrame={150}
        />
      </Sequence>
    </>
  );
};
```

### Pre-render Audio Pipeline

```typescript
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

async function renderVideoWithNarration(
  segments: NarrationSegment[]
): Promise<string> {
  // 1. Generate all narration audio
  const pipeline = new NarrationPipeline('./audio-cache', 30);
  const audioFiles = await pipeline.generateAll(segments);

  // 2. Export audio files for Remotion
  for (const audio of audioFiles) {
    writeFileSync(
      `./public/audio/${audio.segmentId}.mp3`,
      audio.audioBuffer
    );
  }

  // 3. Bundle and render
  const bundleLocation = await bundle({
    entryPoint: './src/index.ts',
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'NarratedVideo',
  });

  const outputPath = './output/video-with-narration.mp4';

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
  });

  return outputPath;
}
```

## Quick Reference

### API Endpoints

```
POST /text-to-speech/{voice_id}         # Standard TTS
POST /text-to-speech/{voice_id}/stream  # Streaming TTS
GET  /voices                            # List all voices
GET  /voices/{voice_id}                 # Get voice details
GET  /user                              # Usage and quota
GET  /user/subscription                 # Plan details
```

### Environment Setup

```bash
# Required
ELEVENLABS_API_KEY=xi_xxxxxxxxxxxxxxxxxxxx

# Optional
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_DEFAULT_VOICE=21m00Tcm4TlvDq8ikWAM
```

### Common Voice IDs

```
Rachel:   21m00Tcm4TlvDq8ikWAM  (warm, conversational)
Adam:     pNInz6obpgDQGcFmaJgB  (deep, authoritative)
Antoni:   ErXwobaYiN019PkySvjV  (energetic, youthful)
Bella:    EXAVITQu4vr4xnSDxMaL  (friendly, engaging)
Josh:     TxGEqnHWrfWFTfGW9XjX  (deep, narrative)
```

## Related Skills

- `video-pacing`: Video rhythm and timing rules
- `video-storyboarding`: Pre-production planning and scene structure
- `audio-language-models`: Broader TTS comparison (Gemini, OpenAI, etc.)
- `remotion-composer`: Programmatic video generation

## References

- [API Integration](./references/api-integration.md) - Full API patterns, authentication, endpoints
- [Voice Selection](./references/voice-selection.md) - All voices with characteristics and use cases
- [Timing Calculation](./references/timing-calculation.md) - Frame-to-ms conversion, segment planning

## Capability Details

### elevenlabs-tts
**Keywords:** elevenlabs, tts, text-to-speech, narration, voice
**Solves:**
- Generate narration audio with ElevenLabs
- Configure voice settings for video
- Integrate TTS into video pipeline

### voice-selection
**Keywords:** voice, rachel, adam, narrator, character
**Solves:**
- Choose the right voice for content type
- Configure voice settings (stability, similarity)
- Match voice to audience and tone

### segment-timing
**Keywords:** timing, frames, milliseconds, duration, pacing
**Solves:**
- Convert frames to milliseconds
- Calculate WPM for narration
- Validate script fits video segment

### narration-pipeline
**Keywords:** pipeline, batch, cache, automation
**Solves:**
- Build automated narration workflows
- Cache audio for cost savings
- Handle rate limits and errors

### cost-optimization
**Keywords:** cost, pricing, budget, optimize, characters
**Solves:**
- Estimate narration costs
- Reduce API usage with caching
- Choose cost-effective models
