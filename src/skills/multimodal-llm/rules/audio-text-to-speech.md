---
title: Configure text-to-speech voice selection and style prompts for natural-sounding output
impact: MEDIUM
impactDescription: "Missing voice config or wrong TTS model produces robotic output — proper voice selection and style prompts are essential"
tags: audio, text-to-speech, tts, voice, synthesis, speech
---

## Audio Text-to-Speech

Generate natural speech from text with voice selection and expressive control.

**Incorrect — no voice configuration:**
```python
# Default voice with no style control — sounds robotic
response = model.generate_content(contents=text)
```

**Correct — Gemini TTS with voice and style config:**
```python
import google.generativeai as genai

def text_to_speech(text: str, voice: str = "Kore") -> bytes:
    """Gemini 2.5 Flash TTS with voice selection.

    Available voices: Puck, Charon, Kore, Fenrir, Aoede (30 total)
    """
    model = genai.GenerativeModel("gemini-2.5-flash-tts")

    response = model.generate_content(
        contents=text,
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
```

**Expressive voice with auditory cues (Grok Voice Agent):**
```python
# Supports: [whisper], [sigh], [laugh], [pause]
await ws.send(json.dumps({
    "type": "response.create",
    "response": {
        "instructions": "[sigh] Let me think about that... [pause] Here's what I found."
    }
}))
```

**Gemini Live — real-time TTS with emotional awareness:**
```python
config = live.LiveConnectConfig(
    response_modalities=["AUDIO"],
    speech_config=live.SpeechConfig(
        voice_config=live.VoiceConfig(
            prebuilt_voice_config=live.PrebuiltVoiceConfig(
                voice_name="Puck"  # 30 HD voices in 24 languages
            )
        )
    ),
    system_instruction="Speak warmly and naturally."
)
```

**Key rules:**
- Always configure voice explicitly — defaults vary by provider
- Gemini TTS supports enhanced expressivity with style prompts in system instructions
- Grok supports inline auditory cues: `[whisper]`, `[sigh]`, `[laugh]`, `[pause]`
- For multi-speaker dialogue, use consistent voice assignments per character
- Gemini offers 30 HD voices across 24 languages
- Test with real users — perceived quality varies by use case and language
