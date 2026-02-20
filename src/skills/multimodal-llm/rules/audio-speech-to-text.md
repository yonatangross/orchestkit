---
title: Configure speech-to-text with the right provider and model for accuracy and cost
impact: HIGH
impactDescription: "Using deprecated Whisper-1 or wrong provider for long audio causes poor accuracy and unnecessary cost"
tags: audio, speech-to-text, transcription, diarization, stt, whisper
---

## Audio Speech-to-Text

Convert audio to text with speaker labels, timestamps, and structured output.

**Incorrect — using deprecated model:**
```python
# Whisper-1 is deprecated — use GPT-4o-Transcribe for better accuracy
response = client.audio.transcriptions.create(model="whisper-1", file=audio_file)
```

**Correct — GPT-4o-Transcribe with structured output:**
```python
from openai import OpenAI
client = OpenAI()

with open(audio_path, "rb") as audio_file:
    response = client.audio.transcriptions.create(
        model="gpt-4o-transcribe",
        file=audio_file,
        language="en",  # Optional: improves accuracy for known language
        response_format="verbose_json",
        timestamp_granularities=["word", "segment"]
    )

result = {
    "text": response.text,
    "words": response.words,        # Word-level timestamps
    "segments": response.segments,  # Segment-level with speaker info
    "duration": response.duration
}
```

**Gemini — best for long-form audio (up to 9.5 hours):**
```python
import google.generativeai as genai
model = genai.GenerativeModel("gemini-2.5-pro")

audio_file = genai.upload_file(audio_path)
response = model.generate_content([
    audio_file,
    """Transcribe with:
    1. Speaker labels (Speaker 1, Speaker 2)
    2. Timestamps: [HH:MM:SS]
    3. Punctuation and formatting"""
])
```

**AssemblyAI — best feature set (diarization + sentiment + entities):**
```python
import assemblyai as aai
aai.settings.api_key = "YOUR_API_KEY"

config = aai.TranscriptionConfig(
    speaker_labels=True,
    sentiment_analysis=True,
    entity_detection=True,
    auto_highlights=True,
    language_detection=True
)
transcript = aai.Transcriber().transcribe(audio_url, config=config)
```

**STT model comparison:**

| Model | WER | Latency | Best For |
|-------|-----|---------|----------|
| Gemini 2.5 Pro | ~5% | Medium | 9.5hr audio, diarization |
| GPT-4o-Transcribe | ~7% | Medium | Accuracy + accents |
| AssemblyAI Universal-2 | 8.4% | 200ms | Best features |
| Deepgram Nova-3 | ~18% | <300ms | Lowest latency |
| Whisper Large V3 | 7.4% | Slow | Self-host, 99+ langs |

**Key rules:**
- Use GPT-4o-Transcribe, not Whisper-1 (deprecated)
- For audio >1 hour, prefer Gemini 2.5 Pro (handles up to 9.5 hours natively)
- AssemblyAI provides the richest metadata (sentiment, entities, highlights)
- Deepgram Nova-3 for lowest latency STT (<300ms)
- Whisper Large V3 only for self-hosted / air-gapped environments
- Always specify language when known — improves accuracy significantly
