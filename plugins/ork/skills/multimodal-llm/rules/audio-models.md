---
title: Audio Model Selection
impact: MEDIUM
impactDescription: "Using STT+LLM+TTS pipeline instead of native speech-to-speech adds 2-5x latency — choose the right architecture"
tags: audio, models, voice-agent, real-time, comparison, pricing
---

## Audio Model Selection

Choose the right audio provider based on latency, features, and cost.

**Incorrect — building STT+LLM+TTS pipeline for voice assistants:**
```python
# 3-step pipeline adds 2-5x latency vs native speech-to-speech
text = transcribe(audio)          # STT: ~500ms
response = llm.generate(text)     # LLM: ~1000ms
audio = text_to_speech(response)  # TTS: ~500ms
# Total: ~2000ms minimum
```

**Correct — use native speech-to-speech for voice assistants:**
```python
# Grok Voice Agent: <1s time-to-first-audio (5x faster)
async with websockets.connect("wss://api.x.ai/v1/realtime", extra_headers=headers) as ws:
    await ws.send(json.dumps({
        "type": "session.update",
        "session": {
            "model": "grok-4-voice",
            "voice": "Aria",
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "turn_detection": {"type": "server_vad"}
        }
    }))
    # Direct audio in -> audio out, no intermediary transcription
```

**Real-time voice provider comparison:**

| Model | Latency | Languages | Price | Best For |
|-------|---------|-----------|-------|----------|
| **Grok Voice Agent** | <1s TTFA | 100+ | $0.05/min | Fastest, lowest cost |
| **Gemini Live API** | Low | 24 (30 voices) | Usage-based | Emotional awareness |
| **OpenAI Realtime** | ~1s | 50+ | $0.10/min | Ecosystem integration |

**Gemini Live — emotional awareness and barge-in:**
```python
async with model.connect(config=config) as session:
    # Supports barge-in (user can interrupt anytime)
    # Affective dialog (understands and responds to emotions)
    # Proactive audio (responds only when relevant)
    async for response in session.receive():
        if response.data:
            yield response.data  # Audio bytes
```

**Pricing comparison:**

| Provider | Type | Price | Notes |
|----------|------|-------|-------|
| Grok Voice Agent | Real-time | $0.05/min | Cheapest real-time |
| Gemini Live | Real-time | Usage-based | 30 HD voices |
| OpenAI Realtime | Real-time | $0.10/min | |
| Gemini 2.5 Pro | Transcription | $1.25/M tokens | 9.5hr audio |
| GPT-4o-Transcribe | Transcription | $0.01/min | |
| AssemblyAI | Transcription | ~$0.15/hr | Best features |
| Deepgram | Transcription | ~$0.0043/min | Cheapest STT |

**Selection guide:**

| Scenario | Recommendation |
|----------|----------------|
| Voice assistant (speed) | Grok Voice Agent (<1s) |
| Emotional AI | Gemini Live API |
| Long audio (hours) | Gemini 2.5 Pro (9.5hr) |
| Speaker diarization | AssemblyAI or Gemini |
| Lowest latency STT | Deepgram Nova-3 (<300ms) |
| Self-hosted STT | Whisper Large V3 |
| Cheapest real-time | Grok ($0.05/min) |

**Key rules:**
- Use native speech-to-speech for voice assistants — never chain STT+LLM+TTS
- Grok Voice Agent is OpenAI Realtime API compatible (easy migration)
- Gemini Live supports barge-in — essential for natural conversations
- Always test latency with real users under realistic network conditions
- For phone agents, <1s time-to-first-audio is the quality threshold
