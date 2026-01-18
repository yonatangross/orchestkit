# Text-to-Speech Patterns (2026)

Implementing high-quality speech synthesis using Gemini TTS, OpenAI TTS, and ElevenLabs.

## Provider Comparison (January 2026)

| Provider | Voices | Quality | Features | Price |
|----------|--------|---------|----------|-------|
| **Gemini 2.5 TTS** | 30 HD | Excellent | Style prompts, pacing | Usage-based |
| **OpenAI TTS-1-HD** | 6 | Excellent | Simple API | $30/1M chars |
| **ElevenLabs** | 1000+ | Best | Voice cloning | $0.30/1K chars |
| **Grok Voice** | 3+ | Excellent | Auditory cues | Part of voice agent |

## Gemini 2.5 TTS (Latest)

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

def gemini_tts(
    text: str,
    voice: str = "Kore",
    style: str = None
) -> bytes:
    """Generate speech with Gemini 2.5 TTS.

    Features:
    - 30 HD voices across 24 languages
    - Enhanced expressivity with style prompts
    - Precision pacing (context-aware speed)
    - Multi-speaker dialogue consistency

    Voices: Puck, Charon, Kore, Fenrir, Aoede, and 25 more
    """
    model = genai.GenerativeModel("gemini-2.5-flash-tts")

    # Optional style instruction
    content = text
    if style:
        content = f"[Style: {style}] {text}"

    response = model.generate_content(
        contents=content,
        generation_config=genai.GenerationConfig(
            response_mime_type="audio/mp3",
            speech_config=genai.SpeechConfig(
                voice_config=genai.VoiceConfig(
                    prebuilt_voice_config=genai.PrebuiltVoiceConfig(
                        voice_name=voice
                    )
                )
            )
        )
    )

    return response.audio

# Multi-speaker dialogue
def gemini_dialogue_tts(dialogue: list[dict]) -> bytes:
    """Generate multi-speaker dialogue with consistent voices.

    dialogue = [
        {"speaker": "Alice", "voice": "Kore", "text": "Hello!"},
        {"speaker": "Bob", "voice": "Charon", "text": "Hi there!"}
    ]
    """
    model = genai.GenerativeModel("gemini-2.5-flash-tts")

    formatted = "\n".join([
        f"[Voice: {d['voice']}] {d['speaker']}: {d['text']}"
        for d in dialogue
    ])

    response = model.generate_content(
        contents=formatted,
        generation_config=genai.GenerationConfig(
            response_mime_type="audio/mp3"
        )
    )

    return response.audio

# Gemini voice options
GEMINI_VOICES = {
    "Puck": "Playful, energetic",
    "Charon": "Deep, authoritative",
    "Kore": "Warm, friendly",
    "Fenrir": "Strong, confident",
    "Aoede": "Melodic, soothing"
}
```

## OpenAI TTS

```python
from openai import OpenAI

client = OpenAI()

def openai_tts(
    text: str,
    voice: str = "nova",
    model: str = "tts-1-hd"
) -> bytes:
    """Generate speech with OpenAI TTS.

    Voices: alloy, echo, fable, onyx, nova, shimmer
    Models: tts-1 (fast), tts-1-hd (quality)
    """
    response = client.audio.speech.create(
        model=model,
        voice=voice,
        input=text,
        response_format="mp3"
    )
    return response.content

# Streaming for immediate playback
async def stream_openai_tts(text: str, voice: str = "nova"):
    """Stream audio chunks for low-latency playback."""
    response = client.audio.speech.create(
        model="tts-1",  # Faster for streaming
        voice=voice,
        input=text
    )

    for chunk in response.iter_bytes(chunk_size=4096):
        yield chunk

# Voice characteristics
OPENAI_VOICES = {
    "alloy": "Neutral, balanced",
    "echo": "Male, warm",
    "fable": "Animated, storytelling",
    "onyx": "Male, deep (audiobooks)",
    "nova": "Female, warm (assistants)",
    "shimmer": "Female, clear (educational)"
}
```

## ElevenLabs (Premium Quality)

```python
from elevenlabs import generate, Voice, VoiceSettings, clone

def elevenlabs_tts(
    text: str,
    voice_id: str = "21m00Tcm4TlvDq8ikWAM",  # Rachel
    stability: float = 0.5,
    similarity: float = 0.8
) -> bytes:
    """High-quality TTS with ElevenLabs.

    Best voice quality, supports cloning.
    """
    audio = generate(
        text=text,
        voice=Voice(
            voice_id=voice_id,
            settings=VoiceSettings(
                stability=stability,
                similarity_boost=similarity,
                style=0.0,
                use_speaker_boost=True
            )
        ),
        model="eleven_turbo_v2_5"
    )
    return audio

# Clone a custom voice
def clone_voice(name: str, audio_samples: list[str]) -> str:
    """Create custom voice from 1-25 audio samples."""
    voice = clone(
        name=name,
        files=audio_samples,
        description=f"Cloned voice: {name}"
    )
    return voice.voice_id
```

## Grok Voice (Real-Time TTS)

```python
import websockets
import json
import base64

async def grok_tts(text: str, voice: str = "Aria") -> bytes:
    """TTS via Grok Voice Agent API.

    Supports expressive auditory cues:
    [whisper], [sigh], [laugh], [pause], [excited], [concerned]
    """
    uri = "wss://api.x.ai/v1/realtime"
    headers = {"Authorization": f"Bearer {XAI_API_KEY}"}

    async with websockets.connect(uri, extra_headers=headers) as ws:
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "model": "grok-4-voice",
                "voice": voice,  # Aria, Eve, Leo
                "modalities": ["audio"]
            }
        }))

        await ws.send(json.dumps({
            "type": "response.create",
            "response": {
                "modalities": ["audio"],
                "instructions": text
            }
        }))

        audio_chunks = []
        async for message in ws:
            data = json.loads(message)
            if data["type"] == "response.audio.delta":
                audio_chunks.append(base64.b64decode(data["delta"]))
            elif data["type"] == "response.done":
                break

        return b"".join(audio_chunks)

# Expressive example
text = "[excited] Great news! [pause] Your order has shipped. [whisper] It's a surprise."
```

## Long-Form Audio Generation

```python
import re
from io import BytesIO
from pydub import AudioSegment

def generate_audiobook(
    text: str,
    voice: str = "onyx",
    provider: str = "openai"
) -> bytes:
    """Generate audio for long text with chunking."""
    # Split at sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) < 4000:
            current += sentence + " "
        else:
            chunks.append(current.strip())
            current = sentence + " "
    if current:
        chunks.append(current.strip())

    # Generate audio for each chunk
    segments = []
    for chunk in chunks:
        if provider == "gemini":
            audio = gemini_tts(chunk, voice)
        else:
            audio = openai_tts(chunk, voice)
        segments.append(AudioSegment.from_mp3(BytesIO(audio)))

    # Concatenate with pauses
    silence = AudioSegment.silent(duration=300)
    combined = segments[0]
    for seg in segments[1:]:
        combined += silence + seg

    output = BytesIO()
    combined.export(output, format="mp3")
    return output.getvalue()
```

## Provider Selection

| Use Case | Recommended |
|----------|-------------|
| General TTS | Gemini 2.5 TTS (30 voices, style prompts) |
| Simple API | OpenAI TTS-1-HD |
| Voice cloning | ElevenLabs |
| Expressive/emotional | Grok Voice (auditory cues) |
| Audiobooks | OpenAI onyx or Gemini Charon |
| Assistants | OpenAI nova or Gemini Kore |

## Best Practices

1. **Match voice to content**: Deep for audiobooks, warm for assistants
2. **Use HD models**: tts-1-hd for final output, tts-1 for drafts
3. **Chunk long text**: Stay under 4096 chars per request
4. **Cache audio**: Don't regenerate unchanged content
5. **Style prompts**: Use Gemini's style control for tone
6. **Expressive cues**: Use Grok's [whisper], [laugh] for emotion
