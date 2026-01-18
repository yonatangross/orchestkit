# Transcription Patterns (2026)

Comprehensive guide to audio transcription using Gemini 2.5 Pro, GPT-4o-Transcribe, and Whisper.

## Model Comparison (January 2026)

| Model | WER | Max Duration | Cost | Best For |
|-------|-----|--------------|------|----------|
| **Gemini 2.5 Pro** | ~5% | 9.5 hours | $1.25/M tokens | Long-form, diarization |
| **GPT-4o-Transcribe** | ~7% | 25MB file | $0.01/min | Accuracy, accents |
| **Whisper Large V3** | 7.4% | Unlimited | Self-host | Multilingual (99+) |
| **Whisper V3 Turbo** | ~8% | Unlimited | Self-host | 6x faster |
| **AssemblyAI** | 8.4% | 5GB | ~$0.15/hr | Best features |

## Gemini 2.5 Pro Transcription (Best for Long Audio)

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

def transcribe_with_gemini(audio_path: str) -> dict:
    """Transcribe up to 9.5 hours with speaker diarization.

    Gemini 2.5 Pro handles long-form audio natively without chunking.
    """
    model = genai.GenerativeModel("gemini-2.5-pro")

    # Upload audio file (supports wav, mp3, aac, etc.)
    audio_file = genai.upload_file(audio_path)

    response = model.generate_content([
        audio_file,
        """Transcribe this audio completely with:
        1. Speaker labels (Speaker 1, Speaker 2, etc.)
        2. Timestamps for each segment [HH:MM:SS]
        3. Proper punctuation and formatting
        4. Paragraph breaks for topic changes

        Format:
        [00:00:00] Speaker 1: First statement here...
        [00:00:15] Speaker 2: Response here..."""
    ])

    return {
        "transcript": response.text,
        "audio_duration": audio_file.duration,
        "model": "gemini-2.5-pro"
    }

# With structured output
def transcribe_structured(audio_path: str) -> dict:
    """Get structured JSON output."""
    model = genai.GenerativeModel("gemini-2.5-pro")
    audio_file = genai.upload_file(audio_path)

    response = model.generate_content([
        audio_file,
        """Transcribe this audio and return JSON:
        {
            "duration_seconds": <number>,
            "speakers": ["Speaker 1", "Speaker 2"],
            "segments": [
                {
                    "start": "00:00:00",
                    "end": "00:00:15",
                    "speaker": "Speaker 1",
                    "text": "..."
                }
            ],
            "summary": "Brief summary of the content"
        }"""
    ])

    import json
    return json.loads(response.text)
```

## GPT-4o-Transcribe (Best Accuracy)

```python
from openai import OpenAI

client = OpenAI()

def transcribe_openai(audio_path: str, language: str = None) -> dict:
    """Transcribe with GPT-4o-Transcribe for best accuracy.

    Replaces deprecated Whisper-1 API.
    """
    with open(audio_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=audio_file,
            language=language,  # ISO 639-1: "en", "es", "ja"
            response_format="verbose_json",
            timestamp_granularities=["word", "segment"]
        )

    return {
        "text": response.text,
        "words": response.words,
        "segments": response.segments,
        "duration": response.duration,
        "language": response.language
    }

# Generate SRT subtitles
def generate_srt(audio_path: str) -> str:
    """Generate SRT subtitle file."""
    with open(audio_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=audio_file,
            response_format="srt"
        )
    return response
```

## Whisper Self-Hosted (Cost-Effective)

```python
import whisper
import torch

# Load model (GPU recommended)
model = whisper.load_model("large-v3")  # or "turbo" for 6x speed

def transcribe_local(audio_path: str, language: str = None) -> dict:
    """Transcribe with local Whisper model.

    Models: tiny, base, small, medium, large-v3, turbo
    """
    result = model.transcribe(
        audio_path,
        language=language,  # None for auto-detect
        task="transcribe",  # or "translate" for English
        word_timestamps=True,
        verbose=False
    )

    return {
        "text": result["text"],
        "segments": result["segments"],
        "language": result["language"]
    }

# Faster with Turbo
def transcribe_fast(audio_path: str) -> str:
    """6x faster with V3 Turbo, ~1% WER increase."""
    turbo_model = whisper.load_model("turbo")
    result = turbo_model.transcribe(audio_path)
    return result["text"]
```

## Handling Long Audio (OpenAI)

```python
from pydub import AudioSegment
import tempfile

def transcribe_long_audio_openai(
    audio_path: str,
    chunk_seconds: int = 600  # 10 minutes
) -> str:
    """Transcribe audio longer than 25MB limit."""
    audio = AudioSegment.from_file(audio_path)
    chunks = []

    chunk_ms = chunk_seconds * 1000
    for i in range(0, len(audio), chunk_ms):
        chunk = audio[i:i + chunk_ms]
        chunk_path = tempfile.mktemp(suffix=".wav")
        chunk.export(chunk_path, format="wav")
        chunks.append(chunk_path)

    # Transcribe with context chaining
    transcripts = []
    previous = ""

    for chunk_path in chunks:
        with open(chunk_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model="gpt-4o-transcribe",
                file=f,
                prompt=previous[-224:]  # Context from previous
            )
        transcripts.append(response.text)
        previous = response.text

    return " ".join(transcripts)
```

## Provider Selection Guide

```python
def select_transcription_provider(
    audio_duration_hours: float,
    needs_diarization: bool,
    budget: str = "normal"
) -> str:
    """Select optimal transcription provider."""

    if audio_duration_hours > 1:
        return "gemini"  # 9.5hr limit, native diarization

    if needs_diarization and budget != "low":
        return "assemblyai"  # Best diarization features

    if budget == "low":
        return "whisper_local"  # Free, self-hosted

    return "openai"  # GPT-4o-Transcribe for accuracy
```

## Best Practices

1. **Long audio**: Use Gemini 2.5 Pro (no chunking needed for 9.5hr)
2. **Accuracy priority**: GPT-4o-Transcribe with language hint
3. **Cost-sensitive**: Self-host Whisper Large V3
4. **Speed priority**: Whisper V3 Turbo (6x faster)
5. **Features (sentiment, entities)**: AssemblyAI
6. **Prompting**: Include vocabulary for technical terms
