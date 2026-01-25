// src/lib/heygen.ts
// HeyGen API Service - Type-safe wrapper with error handling and polling

// ==================== TYPES ====================

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url: string;
  premium: boolean;
  default_voice_id?: string;
}

export interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: "male" | "female";
  preview_audio: string;
  support_pause: boolean;
  emotion_support: boolean;
}

export interface VideoGenerationRequest {
  script: string;
  avatarId: string;
  voiceId: string;
  options?: {
    style?: "normal" | "closeUp" | "circle";
    backgroundColor?: string;
    dimension?: { width: number; height: number };
    test?: boolean; // Watermarked, no credits used
    speed?: number; // 0.5-1.5, default 1.0
    pitch?: number; // -50 to 50, default 0
  };
}

export interface VideoStatus {
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

export interface QuotaInfo {
  remaining_quota: number;
  details?: {
    api: number;
  };
}

// ==================== API CLIENT ====================

const HEYGEN_API_BASE = "https://api.heygen.com";

function getApiKey(): string {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new Error(
      "HEYGEN_API_KEY environment variable not set. " +
        "Get your API key at: https://app.heygen.com/settings?nav=API"
    );
  }
  return apiKey;
}

interface HeyGenApiResponse<T> {
  error: { message: string; code: string } | null;
  data: T;
}

async function heygenFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(`${HEYGEN_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HeyGen API error (${response.status}): ${text}`);
  }

  const json = (await response.json()) as HeyGenApiResponse<T>;

  if (json.error) {
    throw new Error(`HeyGen API error: ${json.error.message}`);
  }

  return json.data;
}

// ==================== API METHODS ====================

/** List all available avatars */
export async function listAvatars(): Promise<HeyGenAvatar[]> {
  const data = await heygenFetch<{ avatars: HeyGenAvatar[] }>("/v2/avatars");
  return data.avatars;
}

/** List all available voices */
export async function listVoices(): Promise<HeyGenVoice[]> {
  const data = await heygenFetch<{ voices: HeyGenVoice[] }>("/v2/voices");
  return data.voices;
}

/** Generate a video - returns video_id for polling */
export async function generateVideo(
  request: VideoGenerationRequest
): Promise<string> {
  const { script, avatarId, voiceId, options = {} } = request;

  const {
    style = "normal",
    backgroundColor = "#1a1a2e",
    dimension = { width: 1280, height: 720 }, // 720p default for standard plans
    test = false,
    speed = 1.0,
    pitch = 0,
  } = options;

  const body = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: avatarId,
          avatar_style: style,
        },
        voice: {
          type: "text",
          input_text: script,
          voice_id: voiceId,
          speed,
          pitch,
        },
        background: {
          type: "color",
          value: backgroundColor,
        },
      },
    ],
    dimension,
    test,
  };

  const data = await heygenFetch<{ video_id: string }>("/v2/video/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.video_id;
}

/** Check video generation status */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  return heygenFetch<VideoStatus>(`/v1/video_status.get?video_id=${videoId}`);
}

/** Poll until video is ready (with timeout) */
export async function waitForVideo(
  videoId: string,
  options: {
    pollInterval?: number; // ms, default 30000 (30s)
    timeout?: number; // ms, default 900000 (15min)
    onProgress?: (status: VideoStatus, elapsedMs: number) => void;
  } = {}
): Promise<string> {
  const { pollInterval = 30000, timeout = 900000, onProgress } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await getVideoStatus(videoId);
    const elapsedMs = Date.now() - startTime;

    onProgress?.(status, elapsedMs);

    if (status.status === "completed" && status.video_url) {
      return status.video_url;
    }

    if (status.status === "failed") {
      const errorMsg = typeof status.error === 'object'
        ? JSON.stringify(status.error)
        : (status.error || "Unknown error");
      throw new Error(`Video generation failed: ${errorMsg}`);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `Video generation timed out after ${Math.round(timeout / 1000 / 60)} minutes`
  );
}

/** Get remaining API quota (quota / 60 = credits) */
export async function getQuota(): Promise<QuotaInfo> {
  return heygenFetch<QuotaInfo>("/v2/user/remaining_quota");
}

/** Download video to buffer */
export async function downloadVideo(videoUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  return response.arrayBuffer();
}

// ==================== HELPER FUNCTIONS ====================

/** Find an English voice matching the given gender */
export function findEnglishVoice(
  voices: HeyGenVoice[],
  gender: "male" | "female" = "male"
): HeyGenVoice | undefined {
  return voices.find(
    (v) =>
      v.gender === gender &&
      v.language.toLowerCase().includes("english")
  );
}

/** Find avatar by ID with fallback to first available */
export function findAvatar(
  avatars: HeyGenAvatar[],
  avatarId?: string
): HeyGenAvatar | undefined {
  if (avatarId) {
    const match = avatars.find((a) => a.avatar_id === avatarId);
    if (match) return match;
  }
  return avatars[0];
}
