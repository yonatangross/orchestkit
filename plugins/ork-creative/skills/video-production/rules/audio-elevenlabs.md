---
title: ElevenLabs TTS Integration
impact: HIGH
impactDescription: "Professional narration transforms amateur demos into polished content — ElevenLabs provides the most natural AI voices but requires careful voice selection and cost management"
tags: elevenlabs, TTS, voice, narration, API, text-to-speech
---

## ElevenLabs TTS Integration

Generate professional narration using the ElevenLabs text-to-speech API with optimal voice selection, streaming, and cost control.

### Voice Selection Guide

| Voice | ID | Best For | Tone |
|-------|-----|----------|------|
| **Rachel** | `21m00Tcm4TlvDq8ikWAM` | Tutorials, docs | Calm, clear, professional |
| **Adam** | `pNInz6obpgDQGcFmaJgB` | Product demos | Confident, energetic |
| **Antoni** | `ErXwobaYiN019PkySvjV` | Storytelling | Warm, engaging |
| **Elli** | `MF3mGyEYCl7XYWbV9V6O` | Short-form, social | Young, upbeat |
| **Josh** | `TxGEqnHWrfWFTfGW9XjX` | Enterprise, deep | Authoritative, deep |

**Default recommendation:** Rachel for tutorials, Adam for demos.

### API Integration (Python)

```python
import requests

ELEVENLABS_API_KEY = os.environ["ELEVENLABS_API_KEY"]
VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel

def generate_narration(text: str, output_path: str) -> None:
    """Generate TTS audio from text."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    with open(output_path, "wb") as f:
        f.write(response.content)
```

### Streaming for Long Content

```python
def stream_narration(text: str, output_path: str) -> None:
    """Stream TTS for long narrations (>5000 chars)."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream"
    headers = {"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"}
    payload = {"text": text, "model_id": "eleven_turbo_v2_5"}
    response = requests.post(url, json=payload, headers=headers, stream=True)
    with open(output_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024):
            if chunk:
                f.write(chunk)
```

### Voice Settings Tuning

| Parameter | Range | Low Value | High Value |
|-----------|-------|-----------|------------|
| `stability` | 0.0-1.0 | More expressive, varied | More consistent, monotone |
| `similarity_boost` | 0.0-1.0 | More creative | Closer to original voice |
| `style` | 0.0-1.0 | Neutral delivery | More dramatic/stylized |

**Recommended for tech demos:** stability=0.5, similarity_boost=0.75, style=0.0

### Cost Optimization

| Model | Cost per 1K chars | Latency | Quality |
|-------|-------------------|---------|---------|
| `eleven_turbo_v2_5` | ~$0.15 | ~300ms | Good (recommended) |
| `eleven_multilingual_v2` | ~$0.30 | ~500ms | Best |
| `eleven_monolingual_v1` | ~$0.15 | ~250ms | Good (English only) |

**Budget tips:**
- Use `eleven_turbo_v2_5` for drafts and iterations
- Switch to `eleven_multilingual_v2` for final render only
- Cache generated audio — do not re-generate unchanged scripts
- Average 90-second video script: ~1200 characters = ~$0.18-$0.36

### Scene-by-Scene Generation

```bash
# Generate per-scene, then concatenate
for scene in scene_*.txt; do
  python generate_tts.py "$scene" "audio/${scene%.txt}.mp3"
done

# Concatenate with crossfade
ffmpeg -i "concat:audio/scene_01.mp3|audio/scene_02.mp3|audio/scene_03.mp3" \
  -af "acrossfade=d=0.3:c1=tri:c2=tri" narration.mp3
```

**Key rules:** Always cache generated audio. Use turbo model for iterations, multilingual for final. Keep stability at 0.5 for natural tech narration.

**References:** `references/elevenlabs-api.md`, `references/voice-selection-guide.md`
