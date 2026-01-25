#!/usr/bin/env npx tsx
// scripts/generate-avatar.ts
// Generate HeyGen avatar video for OrchestKit demo

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
  generateVideo,
  waitForVideo,
  getQuota,
  downloadVideo,
} from "../src/lib/heygen";

// OrchestKit demo script (~45 seconds of speech)
const SCRIPT = `
Welcome to OrchestKit — the AI-powered development toolkit that transforms how you build software.

<break time="0.5s"/>

With 169 specialized skills covering everything from API design to database optimization, you get expert-level guidance built right into your workflow.

<break time="0.5s"/>

Our 35 AI agents work as your specialized team — from backend architects to security auditors — each trained for specific tasks.

<break time="0.5s"/>

And with 144 automation hooks, quality gates and best practices are enforced automatically, catching issues before they become problems.

<break time="1s"/>

Get started today with a single command.
`.trim();

async function main() {
  console.log("============================================");
  console.log("   HeyGen Avatar Video Generation");
  console.log("============================================\n");

  // Check quota first
  console.log("Checking API quota...");
  const quota = await getQuota();
  const credits = Math.round(quota.remaining_quota / 60);
  console.log(`Available credits: ~${credits}\n`);

  if (credits < 1) {
    console.error("ERROR: Insufficient credits to generate video.");
    console.error("Please add credits at: https://app.heygen.com/settings");
    process.exit(1);
  }

  // Get avatar and voice from env
  const avatarId = process.env.HEYGEN_DEFAULT_AVATAR_ID;
  const voiceId = process.env.HEYGEN_DEFAULT_VOICE_ID;

  if (!avatarId || !voiceId) {
    console.error("ERROR: Missing HEYGEN_DEFAULT_AVATAR_ID or HEYGEN_DEFAULT_VOICE_ID in .env");
    console.error("Run 'npm run heygen:test' to find available avatars and voices.");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  Avatar ID: ${avatarId}`);
  console.log(`  Voice ID: ${voiceId}`);
  console.log(`  Script: ${SCRIPT.length} characters\n`);

  // Create output directory
  const videosDir = path.join(__dirname, "../public/videos");
  fs.mkdirSync(videosDir, { recursive: true });

  // Generate video
  console.log("Submitting to HeyGen API...");
  const startTime = Date.now();

  const videoId = await generateVideo({
    script: SCRIPT,
    avatarId,
    voiceId,
    options: {
      style: "normal",
      backgroundColor: "#0a0a0f", // Match OrchestKit dark theme
      dimension: { width: 1920, height: 1080 },
      test: false, // Set to true for testing (watermarked, no credits used)
      speed: 1.0,
      pitch: 0,
    },
  });

  console.log(`Video ID: ${videoId}\n`);

  // Save metadata
  const metadataPath = path.join(videosDir, "avatar-metadata.json");
  const metadata: Record<string, unknown> = {
    videoId,
    avatarId,
    voiceId,
    script: SCRIPT,
    createdAt: new Date().toISOString(),
    status: "processing",
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`Metadata saved to: ${metadataPath}\n`);

  // Poll for completion
  console.log("Waiting for video generation...");
  console.log("(This typically takes 10-15 minutes)\n");

  const videoUrl = await waitForVideo(videoId, {
    pollInterval: 30000, // 30 seconds
    timeout: 20 * 60 * 1000, // 20 minutes
    onProgress: (status, elapsedMs) => {
      const minutes = Math.floor(elapsedMs / 60000);
      const seconds = Math.floor((elapsedMs % 60000) / 1000);
      console.log(`  [${minutes}:${seconds.toString().padStart(2, "0")}] Status: ${status.status}`);
    },
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nVideo ready in ${elapsed} seconds!`);
  console.log(`URL: ${videoUrl}\n`);

  // Download video
  console.log("Downloading video...");
  const videoPath = path.join(videosDir, "avatar-presenter.mp4");
  const buffer = await downloadVideo(videoUrl);
  fs.writeFileSync(videoPath, Buffer.from(buffer));

  const fileSizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
  console.log(`Saved to: ${videoPath}`);
  console.log(`File size: ${fileSizeMB} MB\n`);

  // Update metadata
  metadata.status = "completed";
  metadata.videoUrl = videoUrl;
  metadata.localPath = videoPath;
  metadata.completedAt = new Date().toISOString();
  metadata.durationSeconds = elapsed;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log("============================================");
  console.log("   Video Generation Complete!");
  console.log("============================================");
  console.log("\nNext steps:");
  console.log("1. Preview: npm run dev");
  console.log("2. Render: npm run build");
}

main().catch((error) => {
  console.error("\n============================================");
  console.error("   Video Generation FAILED");
  console.error("============================================");
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
