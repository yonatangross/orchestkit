# Real-Time Voice Streaming (2026)

Patterns for building real-time voice agents using Grok Voice Agent API and Gemini Live API.

## Provider Comparison

| Provider | TTFA | Architecture | Best For |
|----------|------|--------------|----------|
| **Grok Voice Agent** | <1s | Native S2S | Fastest, phone agents |
| **Gemini Live API** | Low | Native S2S | Emotional awareness |
| **OpenAI Realtime** | ~1s | Native S2S | Ecosystem integration |
| **Deepgram + LLM** | ~500ms | STT→LLM→TTS | Custom pipelines |

## Grok Voice Agent (WebSocket)

```python
import asyncio
import websockets
import json
import base64

class GrokVoiceAgent:
    """Real-time voice agent - #1 on Big Bench Audio.

    - <1 second time-to-first-audio
    - Native speech-to-speech (no transcription step)
    - $0.05/min (half of OpenAI)
    - OpenAI Realtime API compatible
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.uri = "wss://api.x.ai/v1/realtime"
        self.ws = None

    async def connect(
        self,
        voice: str = "Aria",
        instructions: str = "You are a helpful assistant."
    ):
        """Establish WebSocket connection."""
        headers = {"Authorization": f"Bearer {self.api_key}"}

        self.ws = await websockets.connect(
            self.uri,
            extra_headers=headers
        )

        # Configure session
        await self.ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "model": "grok-4-voice",
                "voice": voice,  # Aria, Eve, Leo
                "instructions": instructions,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "silence_duration_ms": 500
                }
            }
        }))

    async def send_audio(self, audio_chunk: bytes):
        """Send audio chunk to the model."""
        await self.ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": base64.b64encode(audio_chunk).decode()
        }))

    async def receive(self):
        """Receive responses from the model."""
        async for message in self.ws:
            data = json.loads(message)

            if data["type"] == "response.audio.delta":
                yield {
                    "type": "audio",
                    "data": base64.b64decode(data["delta"])
                }
            elif data["type"] == "response.text.delta":
                yield {
                    "type": "transcript",
                    "data": data["delta"]
                }
            elif data["type"] == "input_audio_buffer.speech_started":
                yield {"type": "user_speaking"}
            elif data["type"] == "input_audio_buffer.speech_stopped":
                yield {"type": "user_stopped"}

    async def close(self):
        """Close the connection."""
        if self.ws:
            await self.ws.close()

# Usage
async def voice_assistant():
    agent = GrokVoiceAgent(api_key="YOUR_XAI_KEY")
    await agent.connect(
        voice="Aria",
        instructions="You are a friendly customer support agent."
    )

    # Stream microphone audio
    async for audio_chunk in get_microphone_stream():
        await agent.send_audio(audio_chunk)

    # Receive and play responses
    async for response in agent.receive():
        if response["type"] == "audio":
            play_audio(response["data"])
        elif response["type"] == "transcript":
            print(f"Assistant: {response['data']}")
```

## Gemini Live API (Emotional AI)

```python
import google.generativeai as genai
from google.generativeai import live

genai.configure(api_key="YOUR_API_KEY")

class GeminiLiveAgent:
    """Real-time voice with emotional understanding.

    - 30 HD voices in 24 languages
    - Affective dialog (understands user emotions)
    - Barge-in support
    - Proactive audio mode
    """

    def __init__(self):
        self.model = genai.GenerativeModel("gemini-2.5-flash-live")
        self.session = None

    async def connect(
        self,
        voice: str = "Puck",
        instructions: str = "You are a helpful assistant."
    ):
        """Connect to Gemini Live."""
        config = live.LiveConnectConfig(
            response_modalities=["AUDIO", "TEXT"],
            speech_config=live.SpeechConfig(
                voice_config=live.VoiceConfig(
                    prebuilt_voice_config=live.PrebuiltVoiceConfig(
                        voice_name=voice  # Puck, Charon, Kore, Fenrir, Aoede
                    )
                )
            ),
            system_instruction=instructions,
            # Enable emotional understanding
            enable_affective_dialog=True
        )

        self.session = await self.model.connect(config=config)

    async def send_audio(self, audio_chunk: bytes):
        """Send audio to Gemini."""
        await self.session.send(
            input=live.LiveClientContent(
                realtime_input=live.RealtimeInput(
                    media_chunks=[live.MediaChunk(
                        data=audio_chunk,
                        mime_type="audio/pcm"
                    )]
                )
            )
        )

    async def receive(self):
        """Receive audio and text responses."""
        async for response in self.session.receive():
            if response.data:
                yield {"type": "audio", "data": response.data}

            if response.server_content:
                if response.server_content.model_turn:
                    for part in response.server_content.model_turn.parts:
                        if part.text:
                            yield {"type": "transcript", "data": part.text}

    async def close(self):
        """Close the session."""
        if self.session:
            await self.session.close()

# Gemini voices
GEMINI_VOICES = {
    "Puck": "Playful, energetic",
    "Charon": "Deep, authoritative",
    "Kore": "Warm, friendly",
    "Fenrir": "Strong, confident",
    "Aoede": "Melodic, soothing"
}
```

## FastAPI WebSocket Endpoint

```python
from fastapi import FastAPI, WebSocket
import asyncio

app = FastAPI()

@app.websocket("/ws/voice")
async def voice_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time voice."""
    await websocket.accept()

    # Choose provider based on requirements
    provider = websocket.query_params.get("provider", "grok")

    if provider == "grok":
        agent = GrokVoiceAgent(api_key=XAI_KEY)
    else:
        agent = GeminiLiveAgent()

    await agent.connect()

    async def receive_from_client():
        """Receive audio from client."""
        try:
            while True:
                audio = await websocket.receive_bytes()
                await agent.send_audio(audio)
        except Exception:
            pass

    async def send_to_client():
        """Send audio to client."""
        async for response in agent.receive():
            if response["type"] == "audio":
                await websocket.send_bytes(response["data"])
            elif response["type"] == "transcript":
                await websocket.send_json({
                    "type": "transcript",
                    "text": response["data"]
                })

    # Run both tasks
    await asyncio.gather(
        receive_from_client(),
        send_to_client()
    )

    await agent.close()
```

## Browser Client (JavaScript)

```javascript
class VoiceClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.mediaRecorder = null;
  }

  async start() {
    // Get microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // Record and send audio
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(e.data);
      }
    };

    // Send chunks every 100ms for low latency
    this.mediaRecorder.start(100);

    // Handle incoming audio
    this.ws.onmessage = async (e) => {
      if (e.data instanceof Blob) {
        const arrayBuffer = await e.data.arrayBuffer();
        this.playAudio(arrayBuffer);
      } else {
        const data = JSON.parse(e.data);
        if (data.type === 'transcript') {
          this.onTranscript(data.text);
        }
      }
    };
  }

  playAudio(arrayBuffer) {
    this.audioContext.decodeAudioData(arrayBuffer, (buffer) => {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start();
    });
  }

  onTranscript(text) {
    console.log('Assistant:', text);
  }

  stop() {
    this.mediaRecorder?.stop();
    this.ws?.close();
  }
}

// Usage
const client = new VoiceClient('wss://api.example.com/ws/voice?provider=grok');
await client.start();
```

## Expressive Voice (Grok)

```python
# Grok supports auditory cues for natural speech
AUDITORY_CUES = [
    "[whisper]",   # Soft, quiet speech
    "[sigh]",      # Exhalation
    "[laugh]",     # Laughter
    "[pause]",     # Brief pause
    "[excited]",   # Enthusiastic tone
    "[concerned]", # Worried tone
]

async def send_expressive_response(agent, text: str):
    """Send response with emotional cues."""
    await agent.ws.send(json.dumps({
        "type": "response.create",
        "response": {
            "modalities": ["text", "audio"],
            "instructions": text
        }
    }))

# Example: Empathetic response
await send_expressive_response(
    agent,
    "[concerned] I understand that must be frustrating. "
    "[pause] Let me help you resolve this issue."
)
```

## Error Handling & Reconnection

```python
async def resilient_voice_agent(
    agent_class,
    max_retries: int = 3
):
    """Voice agent with automatic reconnection."""
    retry_count = 0
    agent = None

    while retry_count < max_retries:
        try:
            agent = agent_class()
            await agent.connect()

            async for response in agent.receive():
                yield response
                retry_count = 0  # Reset on success

        except websockets.ConnectionClosed:
            retry_count += 1
            wait = 2 ** retry_count
            print(f"Connection lost, retrying in {wait}s...")
            await asyncio.sleep(wait)

        except Exception as e:
            print(f"Error: {e}")
            break

        finally:
            if agent:
                await agent.close()
```

## Best Practices

1. **Use native S2S**: Avoid STT→LLM→TTS pipelines for latency
2. **Enable VAD**: Let server detect speech for natural turn-taking
3. **Support barge-in**: Allow users to interrupt at any time
4. **Handle emotions**: Use Gemini's affective dialog for empathy
5. **Test latency**: Measure TTFA with real users
6. **Graceful degradation**: Fall back to text if audio fails
