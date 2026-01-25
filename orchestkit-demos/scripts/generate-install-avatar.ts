#!/usr/bin/env npx tsx
// scripts/generate-install-avatar.ts
// Generate HeyGen avatar video for the installation demo

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
  generateVideo,
  waitForVideo,
  getQuota,
  downloadVideo,
} from "../src/lib/heygen";

// Short, punchy script for installation demo (~20 seconds)
const SCRIPT = `
Hey there! <break time="0.3s"/>

Let me show you how easy it is to supercharge your development workflow.

<break time="0.5s"/>

One command installs 169 specialized skills, 35 AI agents, and 144 automation hooks.

<break time="0.5s"/>

Watch how fast this is.

<break time="0.3s"/>

That's it. You're ready to build production-grade applications with AI assistance.

<break time="0.5s"/>

Try it yourself!
`.trim();

async function main() {
  console.log("============================================");
  console.log("   HeyGen Install Avatar Generation");
  console.log("============================================\n");

  // Check quota
  console.log("Checking API quota...");
  const quota = await getQuota();
  const credits = Math.round(quota.remaining_quota / 60);
  console.log(`Available credits: ~${credits}\n`);

  if (credits < 1) {
    console.error("ERROR: Insufficient credits.");
    process.exit(1);
  }

  const avatarId = process.env.HEYGEN_DEFAULT_AVATAR_ID;
  const voiceId = process.env.HEYGEN_DEFAULT_VOICE_ID;

  if (!avatarId || !voiceId) {
    console.error("ERROR: Missing HEYGEN_DEFAULT_AVATAR_ID or HEYGEN_DEFAULT_VOICE_ID");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  Avatar: ${avatarId}`);
  console.log(`  Voice: ${voiceId}`);
  console.log(`  Script length: ${SCRIPT.length} chars\n`);

  // Create output directory
  const videosDir = path.join(__dirname, "../public/videos");
  fs.mkdirSync(videosDir, { recursive: true });

  // Generate
  console.log("Submitting to HeyGen API...");
  const startTime = Date.now();

  const videoId = await generateVideo({
    script: SCRIPT,
    avatarId,
    voiceId,
    options: {
      style: "normal",
      backgroundColor: "#0a0a0f",
      dimension: { width: 1280, height: 720 }, // 720p for standard plans
      test: false,
      speed: 1.05, // Slightly faster for energy
      pitch: 0,
    },
  });

  console.log(`Video ID: ${videoId}\n`);

  // Save metadata
  const metadataPath = path.join(videosDir, "install-avatar-metadata.json");
  const metadata: Record<string, unknown> = {
    videoId,
    avatarId,
    voiceId,
    script: SCRIPT,
    createdAt: new Date().toISOString(),
    status: "processing",
    purpose: "installation-demo",
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Poll
  console.log("Waiting for generation (10-15 min)...\n");

  const videoUrl = await waitForVideo(videoId, {
    pollInterval: 30000,
    timeout: 20 * 60 * 1000,
    onProgress: (status, elapsedMs) => {
      const min = Math.floor(elapsedMs / 60000);
      const sec = Math.floor((elapsedMs % 60000) / 1000);
      console.log(`  [${min}:${sec.toString().padStart(2, "0")}] ${status.status}`);
    },
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nVideo ready in ${elapsed}s!`);
  console.log(`URL: ${videoUrl}\n`);

  // Download
  console.log("Downloading...");
  const videoPath = path.join(videosDir, "install-avatar.mp4");
  const buffer = await downloadVideo(videoUrl);
  fs.writeFileSync(videoPath, Buffer.from(buffer));

  const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
  console.log(`Saved: ${videoPath}`);
  console.log(`Size: ${sizeMB} MB\n`);

  // Update metadata
  metadata.status = "completed";
  metadata.videoUrl = videoUrl;
  metadata.localPath = videoPath;
  metadata.completedAt = new Date().toISOString();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log("============================================");
  console.log("   Done!");
  console.log("============================================");
  console.log("\nNext: npm run dev → select InstallWithAvatarDemo");
  console.log("Then update defaultProps with avatarVideoUrl");
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
