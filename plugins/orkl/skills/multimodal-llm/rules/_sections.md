---
title: Multimodal LLM Rule Categories
version: 1.0.0
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
