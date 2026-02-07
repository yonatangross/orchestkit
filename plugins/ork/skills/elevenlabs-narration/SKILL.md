---
name: elevenlabs-narration
description: ElevenLabs TTS integration for video narration. Use when generating voiceover audio, selecting voices, or building script-to-audio pipelines
tags: [video, audio, narration, tts, elevenlabs, voice, speech]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
complexity: low
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

## Voice Selection Quick Reference

### Pre-Built Voices for Video Narration

| Voice | ID | Characteristics | Use Case |
|-------|-----|-----------------|----------|
| **Rachel** | 21m00Tcm4TlvDq8ikWAM | Warm, conversational | General narration |
| **Adam** | pNInz6obpgDQGcFmaJgB | Deep, authoritative | Tech explainers |
| **Antoni** | ErXwobaYiN019PkySvjV | Energetic, youthful | Product demos |
| **Bella** | EXAVITQu4vr4xnSDxMaL | Friendly, engaging | Tutorials |
| **Josh** | TxGEqnHWrfWFTfGW9XjX | Deep, narrative | Documentaries |

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
function framesToMs(frames: number, fps: number = 30): number {
  return Math.round((frames / fps) * 1000);
}

function msToFrames(ms: number, fps: number = 30): number {
  return Math.round((ms / 1000) * fps);
}

// Examples
framesToMs(90, 30);   // 3000ms (3 seconds at 30fps)
framesToMs(150, 30);  // 5000ms (5 seconds at 30fps)
msToFrames(2500, 30); // 75 frames
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

## Remotion Integration

### Audio Component for Remotion

```typescript
import { Audio, Sequence, useVideoConfig } from 'remotion';

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
  return (
    <Audio
      src={audioUrl}
      startFrom={0}
      volume={volume}
    />
  );
};

// Usage in a scene
export const NarratedScene: React.FC = () => {
  return (
    <>
      <Sequence from={0} durationInFrames={150}>
        <HookScene />
        <Narration audioUrl="/audio/hook-narration.mp3" startFrame={0} />
      </Sequence>

      <Sequence from={150} durationInFrames={300}>
        <DemoScene />
        <Narration audioUrl="/audio/demo-narration.mp3" startFrame={150} />
      </Sequence>
    </>
  );
};
```

## Cost Optimization

### Character Counting

```typescript
function estimateCost(
  text: string,
  model: 'multilingual' | 'turbo' | 'flash' = 'multilingual'
): number {
  const chars = text.length;
  const costPer1K = {
    multilingual: 0.30,
    turbo: 0.18,
    flash: 0.08
  };
  return (chars / 1000) * costPer1K[model];
}
```

### Cost Optimization Strategies

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| Use Turbo for drafts | 40% | Switch model_id during preview |
| Cache generated audio | 100% | Hash text+voice, store locally |
| Batch similar requests | 20% | Group by voice, reduce overhead |
| Use Flash for previews | 73% | Draft with flash, final with v2 |

## Environment Setup

```bash
# Required
ELEVENLABS_API_KEY=xi_xxxxxxxxxxxxxxxxxxxx

# Optional
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_DEFAULT_VOICE=21m00Tcm4TlvDq8ikWAM
```

## Related Skills

- `video-pacing`: Video rhythm and timing rules
- `video-storyboarding`: Pre-production planning and scene structure
- `audio-language-models`: Broader TTS comparison (Gemini, OpenAI, etc.)
- `remotion-composer`: Programmatic video generation

## References

- [API Integration](./references/api-integration.md) - Full API patterns, streaming, error handling
- [Voice Selection](./references/voice-selection.md) - Complete voice catalog with characteristics
- [Timing Calculation](./references/timing-calculation.md) - Segment planning, pipeline implementation

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

### cost-optimization
**Keywords:** cost, pricing, budget, optimize, characters
**Solves:**
- Estimate narration costs
- Reduce API usage with caching
- Choose cost-effective models
