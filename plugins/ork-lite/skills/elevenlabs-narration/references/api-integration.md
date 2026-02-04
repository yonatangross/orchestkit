# ElevenLabs API Integration

Complete API patterns, authentication, and endpoint reference for ElevenLabs TTS integration.

## Authentication

### API Key Setup

```typescript
// Environment variable (recommended)
const apiKey = process.env.ELEVENLABS_API_KEY;

// All requests require the xi-api-key header
const headers = {
  "xi-api-key": apiKey,
  "Content-Type": "application/json",
};
```

### Security Best Practices

```
DO:
- Store API key in environment variables
- Use server-side requests only (never expose key to client)
- Rotate keys periodically
- Use separate keys for development and production

DON'T:
- Commit API keys to version control
- Include keys in client-side JavaScript
- Share keys across teams without rotation
- Use production keys for testing
```

---

## API Endpoints Reference

### Base URL

```
https://api.elevenlabs.io/v1
```

### Text-to-Speech (Standard)

```
POST /text-to-speech/{voice_id}
```

Generate audio from text with a specific voice.

**Request:**

```typescript
interface TTSRequest {
  text: string;                    // Required: Text to synthesize (max ~5000 chars)
  model_id: string;               // Required: Model to use
  voice_settings?: {
    stability: number;            // 0.0-1.0 (default: 0.5)
    similarity_boost: number;     // 0.0-1.0 (default: 0.8)
    style?: number;               // 0.0-1.0 (v2 models only)
    use_speaker_boost?: boolean;  // Enhanced clarity (default: true)
  };
  pronunciation_dictionary_locators?: {
    pronunciation_dictionary_id: string;
    version_id: string;
  }[];
  seed?: number;                  // Reproducible output
  previous_text?: string;         // Context from previous segment
  next_text?: string;             // Context for next segment
  previous_request_ids?: string[]; // For consistent multi-segment
  next_request_ids?: string[];
}
```

**Response:**

```
Content-Type: audio/mpeg
Body: Binary audio data (MP3)

Headers:
- x-request-id: Unique request identifier
- character-cost: Characters billed
- history-item-id: ID for history reference
```

**Example:**

```typescript
async function generateSpeech(
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM"
): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`ElevenLabs API error: ${error.detail?.message}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
```

---

### Text-to-Speech (Streaming)

```
POST /text-to-speech/{voice_id}/stream
```

Stream audio chunks for low-latency playback.

**Additional Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `optimize_streaming_latency` | 0-4 | 0 | Higher = faster start, lower quality |
| `output_format` | string | mp3_44100_128 | Audio format |

**Output Formats:**

```
mp3_22050_32    - 32kbps, lowest quality
mp3_44100_64    - 64kbps, medium quality
mp3_44100_96    - 96kbps, good quality
mp3_44100_128   - 128kbps, high quality (default)
mp3_44100_192   - 192kbps, highest MP3 quality
pcm_16000       - Raw PCM, 16kHz
pcm_22050       - Raw PCM, 22.05kHz
pcm_24000       - Raw PCM, 24kHz
pcm_44100       - Raw PCM, 44.1kHz
ulaw_8000       - uLaw, 8kHz (telephony)
```

**Example:**

```typescript
async function* streamSpeech(
  text: string,
  voiceId: string
): AsyncGenerator<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?` +
    `optimize_streaming_latency=2&output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
      }),
    }
  );

  if (!response.ok || !response.body) {
    throw new Error("Stream request failed");
  }

  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield Buffer.from(value);
  }
}

// Usage
async function playStream(text: string) {
  for await (const chunk of streamSpeech(text, "21m00Tcm4TlvDq8ikWAM")) {
    // Play chunk immediately
    audioPlayer.write(chunk);
  }
}
```

---

### Voices API

#### List All Voices

```
GET /voices
```

**Response:**

```typescript
interface VoicesResponse {
  voices: Voice[];
}

interface Voice {
  voice_id: string;
  name: string;
  category: "premade" | "cloned" | "generated";
  fine_tuning: {
    is_allowed_to_fine_tune: boolean;
    language: string;
    finetuning_state: string;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: string[];
  settings: VoiceSettings | null;
  sharing: {
    status: string;
    history_item_sample_id: string | null;
  };
}
```

**Example:**

```typescript
async function listVoices(): Promise<Voice[]> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
    },
  });

  const data = await response.json();
  return data.voices;
}

// Filter voices by category
async function getPremadeVoices(): Promise<Voice[]> {
  const voices = await listVoices();
  return voices.filter((v) => v.category === "premade");
}
```

#### Get Voice Details

```
GET /voices/{voice_id}
```

**Response includes:**
- Voice metadata
- Default settings
- Fine-tuning status
- Preview audio URL

---

### User API

#### Get User Info

```
GET /user
```

**Response:**

```typescript
interface UserResponse {
  subscription: {
    tier: string;
    character_count: number;
    character_limit: number;
    can_extend_character_limit: boolean;
    allowed_to_extend_character_limit: boolean;
    next_character_count_reset_unix: number;
    voice_limit: number;
    max_voice_add_edits: number;
    voice_add_edit_counter: number;
    professional_voice_limit: number;
    can_extend_voice_limit: boolean;
    can_use_instant_voice_cloning: boolean;
    can_use_professional_voice_cloning: boolean;
    available_models: Array<{
      model_id: string;
      display_name: string;
    }>;
    status: string;
  };
  is_new_user: boolean;
  xi_api_key: string;
  can_use_delayed_payment_methods: boolean;
}
```

**Example:**

```typescript
async function checkQuota(): Promise<{
  remaining: number;
  limit: number;
  resetDate: Date;
}> {
  const response = await fetch("https://api.elevenlabs.io/v1/user", {
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
    },
  });

  const data: UserResponse = await response.json();

  return {
    remaining: data.subscription.character_limit - data.subscription.character_count,
    limit: data.subscription.character_limit,
    resetDate: new Date(data.subscription.next_character_count_reset_unix * 1000),
  };
}
```

---

## Models Reference

### Available Models

| Model ID | Name | Languages | Latency | Quality | Cost |
|----------|------|-----------|---------|---------|------|
| `eleven_multilingual_v2` | Multilingual v2 | 29 | Medium | Best | $0.30/1K |
| `eleven_turbo_v2_5` | Turbo v2.5 | 32 | Low | Excellent | $0.18/1K |
| `eleven_flash_v2_5` | Flash v2.5 | 32 | Lowest | Good | $0.08/1K |
| `eleven_monolingual_v1` | Monolingual v1 | 1 (EN) | Low | Good | $0.24/1K |
| `eleven_english_sts_v2` | Speech-to-Speech | 1 (EN) | Medium | Best | $0.30/1K |

### Model Selection Guide

```typescript
function selectModel(requirements: {
  language: string;
  priority: "quality" | "speed" | "cost";
  realtime: boolean;
}): string {
  // Real-time always uses turbo
  if (requirements.realtime) {
    return "eleven_turbo_v2_5";
  }

  // Non-English requires multilingual
  if (requirements.language !== "en") {
    return "eleven_multilingual_v2";
  }

  // Priority-based selection
  switch (requirements.priority) {
    case "quality":
      return "eleven_multilingual_v2";
    case "speed":
      return "eleven_turbo_v2_5";
    case "cost":
      return "eleven_flash_v2_5";
    default:
      return "eleven_turbo_v2_5";
  }
}
```

---

## Error Handling

### Error Response Format

```typescript
interface ElevenLabsError {
  detail: {
    status: string;
    message: string;
    additional_info?: Record<string, unknown>;
  };
}
```

### Common Error Codes

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | Bad Request | Invalid parameters | Check request body |
| 401 | Unauthorized | Invalid API key | Verify API key |
| 403 | Forbidden | Feature not allowed | Check subscription tier |
| 404 | Not Found | Invalid voice ID | Verify voice exists |
| 422 | Unprocessable | Validation failed | Check text/settings |
| 429 | Too Many Requests | Rate limited | Implement backoff |
| 500 | Server Error | ElevenLabs issue | Retry with backoff |

### Robust Error Handling

```typescript
class ElevenLabsError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

async function handleApiResponse(response: Response): Promise<Buffer> {
  const requestId = response.headers.get("x-request-id");

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    let errorCode = "UNKNOWN";

    try {
      const error = await response.json();
      errorMessage = error.detail?.message || errorMessage;
      errorCode = error.detail?.status || errorCode;
    } catch {
      // JSON parsing failed, use status text
      errorMessage = response.statusText;
    }

    throw new ElevenLabsError(
      response.status,
      errorCode,
      errorMessage,
      requestId || undefined
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateWithRetry(
  text: string,
  voiceId: string,
  maxRetries: number = 3
): Promise<Buffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
          }),
        }
      );

      return await handleApiResponse(response);
    } catch (error) {
      if (error instanceof ElevenLabsError) {
        // Don't retry client errors (4xx except 429)
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        // Retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(
            `Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}
```

---

## Rate Limiting

### Limits by Plan

| Plan | Requests/Second | Concurrent | Characters/Month |
|------|-----------------|------------|------------------|
| Free | 2 | 2 | 10,000 |
| Starter | 5 | 5 | 30,000 |
| Creator | 10 | 10 | 100,000 |
| Pro | 20 | 20 | 500,000 |
| Scale | 50 | 50 | 2,000,000 |
| Enterprise | Custom | Custom | Custom |

### Rate Limiter Implementation

```typescript
import pLimit from "p-limit";

class RateLimitedClient {
  private limiter: ReturnType<typeof pLimit>;
  private requestsPerSecond: number;
  private lastRequestTime: number = 0;

  constructor(requestsPerSecond: number = 10) {
    this.requestsPerSecond = requestsPerSecond;
    this.limiter = pLimit(requestsPerSecond);
  }

  async request<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter(async () => {
      // Ensure minimum delay between requests
      const now = Date.now();
      const minDelay = 1000 / this.requestsPerSecond;
      const elapsed = now - this.lastRequestTime;

      if (elapsed < minDelay) {
        await new Promise((r) => setTimeout(r, minDelay - elapsed));
      }

      this.lastRequestTime = Date.now();
      return fn();
    });
  }
}

// Usage
const client = new RateLimitedClient(10); // 10 req/sec

async function generateBatch(segments: string[]): Promise<Buffer[]> {
  return Promise.all(
    segments.map((text) =>
      client.request(() => generateSpeech(text, "21m00Tcm4TlvDq8ikWAM"))
    )
  );
}
```

---

## WebSocket API (Real-Time)

For ultra-low-latency applications, ElevenLabs offers WebSocket streaming.

```typescript
const WS_URL = "wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input";

interface WebSocketConfig {
  text: string;
  voice_settings?: VoiceSettings;
  generation_config?: {
    chunk_length_schedule?: number[];
  };
  xi_api_key: string;
  model_id: string;
  flush?: boolean;
}

async function streamRealTime(
  text: string,
  voiceId: string
): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_turbo_v2_5`
    );

    const chunks: Buffer[] = [];

    ws.onopen = () => {
      // Initialize connection
      ws.send(
        JSON.stringify({
          text: " ",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
          },
          xi_api_key: process.env.ELEVENLABS_API_KEY,
        })
      );

      // Send text
      ws.send(
        JSON.stringify({
          text: text,
          flush: true,
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.audio) {
        chunks.push(Buffer.from(data.audio, "base64"));
      }
      if (data.isFinal) {
        ws.close();
        resolve(chunks);
      }
    };

    ws.onerror = (error) => {
      reject(error);
    };
  });
}
```

---

## SDK Usage (Official)

```typescript
import { ElevenLabsClient } from "elevenlabs";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Generate speech
const audio = await client.generate({
  voice: "Rachel",
  text: "Hello, world!",
  model_id: "eleven_multilingual_v2",
});

// List voices
const voices = await client.voices.getAll();

// Get user info
const user = await client.user.get();

// Stream speech
const stream = await client.generate({
  voice: "Rachel",
  text: "Hello, world!",
  stream: true,
});

for await (const chunk of stream) {
  // Process chunk
}
```

---

## Best Practices

### Request Optimization

```typescript
// 1. Batch requests to reduce overhead
async function generateBatch(segments: NarrationSegment[]) {
  const client = new RateLimitedClient(10);
  return Promise.all(
    segments.map((seg) =>
      client.request(() => generateSpeech(seg.text, seg.voiceId))
    )
  );
}

// 2. Use context for consistent multi-segment audio
async function generateWithContext(segments: string[], voiceId: string) {
  const results: Buffer[] = [];
  const requestIds: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: segments[i],
          model_id: "eleven_multilingual_v2",
          previous_text: i > 0 ? segments[i - 1] : undefined,
          next_text: i < segments.length - 1 ? segments[i + 1] : undefined,
          previous_request_ids: requestIds.slice(-3),
        }),
      }
    );

    const requestId = response.headers.get("history-item-id");
    if (requestId) requestIds.push(requestId);

    results.push(Buffer.from(await response.arrayBuffer()));
  }

  return results;
}

// 3. Validate before sending
function validateText(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!text.trim()) {
    errors.push("Text cannot be empty");
  }

  if (text.length > 5000) {
    errors.push("Text exceeds 5000 character limit");
  }

  return { valid: errors.length === 0, errors };
}
```
