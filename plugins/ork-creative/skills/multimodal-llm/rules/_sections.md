---
title: Multimodal LLM Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Vision (vision) — HIGH — 3 rules

Image analysis, document understanding, and model selection for visual AI tasks. Wrong image encoding or missing `max_tokens` causes silent failures.

- `vision-image-analysis.md` — Base64 encoding, multi-image comparison, object detection
- `vision-document.md` — PDF page ranges, OCR strategies, detail level selection
- `vision-models.md` — Provider comparison, token costs, image size limits

## 2. Audio (audio) — HIGH — 3 rules

Speech-to-text, text-to-speech, and real-time voice agent patterns. Using STT+LLM+TTS pipelines instead of native speech-to-speech adds unnecessary latency.

- `audio-speech-to-text.md` — Gemini long-form, GPT-4o-Transcribe, AssemblyAI features
- `audio-text-to-speech.md` — Gemini TTS, voice config, expressive auditory cues
- `audio-models.md` — Real-time voice comparison, STT benchmarks, pricing

## 3. Video Generation (video) — HIGH — 3 rules

AI video generation from text/image prompts using Kling 3.0, Sora 2, Veo 3.1, and Runway Gen-4.5. Wrong model selection wastes budget; missing async polling loses completed videos.

- `video-generation-models.md` — Provider comparison, pricing, use-case selection guide
- `video-generation-patterns.md` — Async task polling, SDK integration (Kling, fal.ai, AI SDK)
- `video-multi-shot.md` — Multi-shot storyboarding, character elements, scene consistency
