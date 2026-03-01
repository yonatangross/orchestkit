---
name: multimodal-llm
license: MIT
compatibility: "Claude Code 2.1.59+."
author: OrchestKit
version: 2.0.0
description: Vision, audio, video generation, and multimodal LLM integration patterns. Use when processing images, transcribing audio, generating speech, generating AI video (Kling, Sora, Veo, Runway), or building multimodal AI pipelines.
tags: [vision, audio, video, multimodal, image, speech, transcription, tts, kling, sora, veo, video-generation]
user-invocable: false
disable-model-invocation: true
context: fork
complexity: high
metadata:
  category: mcp-enhancement
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Multimodal LLM Patterns

Integrate vision, audio, and video generation capabilities from leading multimodal models. Covers image analysis, document understanding, real-time voice agents, speech-to-text, text-to-speech, and AI video generation (Kling 3.0, Sora 2, Veo 3.1, Runway Gen-4.5).

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Vision: Image Analysis](#vision-image-analysis) | 1 | HIGH | Image captioning, VQA, multi-image comparison, object detection |
| [Vision: Document Understanding](#vision-document-understanding) | 1 | HIGH | OCR, chart/diagram analysis, PDF processing, table extraction |
| [Vision: Model Selection](#vision-model-selection) | 1 | MEDIUM | Choosing provider, cost optimization, image size limits |
| [Audio: Speech-to-Text](#audio-speech-to-text) | 1 | HIGH | Transcription, speaker diarization, long-form audio |
| [Audio: Text-to-Speech](#audio-text-to-speech) | 1 | MEDIUM | Voice synthesis, expressive TTS, multi-speaker dialogue |
| [Audio: Model Selection](#audio-model-selection) | 1 | MEDIUM | Real-time voice agents, provider comparison, pricing |
| [Video: Model Selection](#video-model-selection) | 1 | HIGH | Choosing video gen provider (Kling, Sora, Veo, Runway) |
| [Video: API Patterns](#video-api-patterns) | 1 | HIGH | Async task polling, SDK integration, webhook callbacks |
| [Video: Multi-Shot](#video-multi-shot) | 1 | HIGH | Storyboarding, character elements, scene consistency |

**Total: 9 rules across 3 categories (Vision, Audio, Video Generation)**

## Vision: Image Analysis

Send images to multimodal LLMs for captioning, visual QA, and object detection. Always set `max_tokens` and resize images before encoding.

| Rule | File | Key Pattern |
|------|------|-------------|
| Image Analysis | `rules/vision-image-analysis.md` | Base64 encoding, multi-image, bounding boxes |

## Vision: Document Understanding

Extract structured data from documents, charts, and PDFs using vision models.

| Rule | File | Key Pattern |
|------|------|-------------|
| Document Vision | `rules/vision-document.md` | PDF page ranges, detail levels, OCR strategies |

## Vision: Model Selection

Choose the right vision provider based on accuracy, cost, and context window needs.

| Rule | File | Key Pattern |
|------|------|-------------|
| Vision Models | `rules/vision-models.md` | Provider comparison, token costs, image limits |

## Audio: Speech-to-Text

Convert audio to text with speaker diarization, timestamps, and sentiment analysis.

| Rule | File | Key Pattern |
|------|------|-------------|
| Speech-to-Text | `rules/audio-speech-to-text.md` | Gemini long-form, GPT-4o-Transcribe, AssemblyAI features |

## Audio: Text-to-Speech

Generate natural speech from text with voice selection and expressive cues.

| Rule | File | Key Pattern |
|------|------|-------------|
| Text-to-Speech | `rules/audio-text-to-speech.md` | Gemini TTS, voice config, auditory cues |

## Audio: Model Selection

Select the right audio/voice provider for real-time, transcription, or TTS use cases.

| Rule | File | Key Pattern |
|------|------|-------------|
| Audio Models | `rules/audio-models.md` | Real-time voice comparison, STT benchmarks, pricing |

## Video: Model Selection

Choose the right video generation provider based on use case, duration, and budget.

| Rule | File | Key Pattern |
|------|------|-------------|
| Video Models | `rules/video-generation-models.md` | Kling vs Sora vs Veo vs Runway, pricing, capabilities |

## Video: API Patterns

Integrate video generation APIs with proper async polling, SDKs, and webhook callbacks.

| Rule | File | Key Pattern |
|------|------|-------------|
| API Integration | `rules/video-generation-patterns.md` | Kling REST, fal.ai SDK, Vercel AI SDK, task polling |

## Video: Multi-Shot

Generate multi-scene videos with consistent characters using storyboarding and character elements.

| Rule | File | Key Pattern |
|------|------|-------------|
| Multi-Shot | `rules/video-multi-shot.md` | Kling 3.0 character elements, 6-shot storyboards, identity binding |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| High accuracy vision | Claude Opus 4.6 or GPT-5 |
| Long documents | Gemini 2.5 Pro (1M context) |
| Cost-efficient vision | Gemini 2.5 Flash ($0.15/M tokens) |
| Video analysis | Gemini 2.5/3 Pro (native video) |
| Voice assistant | Grok Voice Agent (fastest, <1s) |
| Emotional voice AI | Gemini Live API |
| Long audio transcription | Gemini 2.5 Pro (9.5hr) |
| Speaker diarization | AssemblyAI or Gemini |
| Self-hosted STT | Whisper Large V3 |
| Character-consistent video | Kling 3.0 (Character Elements 3.0) |
| Narrative video / storytelling | Sora 2 (best cause-and-effect coherence) |
| Cinematic B-roll | Veo 3.1 (camera control + polished motion) |
| Professional VFX | Runway Gen-4.5 (Act-Two motion transfer) |
| High-volume social video | Kling 3.0 Standard ($0.20/video) |
| Open-source video gen | Wan 2.6 or LTX-2 |
| Lip-sync / avatar video | Kling 3.0 (native lip-sync API) |

## Example

```python
import anthropic, base64

client = anthropic.Anthropic()
with open("image.png", "rb") as f:
    b64 = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": [
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
        {"type": "text", "text": "Describe this image"}
    ]}]
)
```

## Common Mistakes

1. Not setting `max_tokens` on vision requests (responses truncated)
2. Sending oversized images without resizing (>2048px)
3. Using `high` detail level for simple yes/no classification
4. Using STT+LLM+TTS pipeline instead of native speech-to-speech
5. Not leveraging barge-in support for natural voice conversations
6. Using deprecated models (GPT-4V, Whisper-1)
7. Ignoring rate limits on vision and audio endpoints
8. Calling video generation APIs synchronously (they're async — poll or use callbacks)
9. Generating separate clips without character elements (characters look different each time)
10. Using Sora for high-volume social content (expensive, slow — use Kling Standard instead)

## Related Skills

- `ork:rag-retrieval` - Multimodal RAG with image + text retrieval
- `ork:llm-integration` - General LLM function calling patterns
- `streaming-api-patterns` - WebSocket patterns for real-time audio
- `ork:demo-producer` - Terminal demo videos (VHS, asciinema) — not AI video gen
