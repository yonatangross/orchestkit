# Audio Language Models Checklist

## Real-Time Voice

- [ ] Grok Voice Agent WebSocket setup
- [ ] Gemini Live API connection
- [ ] Voice activity detection (VAD)
- [ ] Barge-in support
- [ ] Session management

## Transcription

- [ ] Gemini 2.5 Pro for long audio (9.5hr)
- [ ] GPT-4o-Transcribe for accuracy
- [ ] Speaker diarization
- [ ] Timestamp generation
- [ ] Language detection

## Text-to-Speech

- [ ] Gemini TTS with style prompts
- [ ] OpenAI TTS voice selection
- [ ] Grok expressive cues
- [ ] Multi-speaker dialogue
- [ ] Streaming audio output

## Audio Processing

- [ ] Convert to 16kHz mono WAV
- [ ] Normalize audio levels
- [ ] Handle long audio chunking
- [ ] Support common formats (mp3, wav, m4a)

## WebSocket Integration

- [ ] Connection establishment
- [ ] Audio streaming (input/output)
- [ ] Transcript events
- [ ] Reconnection logic
- [ ] Graceful shutdown

## Error Handling

- [ ] Handle connection drops
- [ ] Audio format validation
- [ ] Rate limit handling
- [ ] Timeout management
- [ ] Fallback to STT+LLM+TTS if needed
