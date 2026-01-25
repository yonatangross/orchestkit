#!/usr/bin/env npx tsx
// scripts/check-status.ts
// Check status of a HeyGen video generation job

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { getVideoStatus, downloadVideo } from "../src/lib/heygen";

async function main() {
  const metadataPath = path.join(__dirname, "../public/videos/avatar-metadata.json");

  // Check if metadata file exists
  if (!fs.existsSync(metadataPath)) {
    console.log("No pending video generation found.");
    console.log("Run 'npm run heygen:generate' to start a new video generation.");
    process.exit(0);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  console.log("============================================");
  console.log("   HeyGen Video Status Check");
  console.log("============================================\n");

  console.log(`Video ID: ${metadata.videoId}`);
  console.log(`Started: ${metadata.createdAt}`);

  if (metadata.status === "completed") {
    console.log(`\nStatus: COMPLETED`);
    console.log(`Video URL: ${metadata.videoUrl}`);
    console.log(`Local file: ${metadata.localPath}`);
    process.exit(0);
  }

  // Check current status
  console.log("\nChecking current status...");
  const status = await getVideoStatus(metadata.videoId);

  console.log(`Status: ${status.status.toUpperCase()}`);

  if (status.status === "completed" && status.video_url) {
    console.log(`\nVideo ready!`);
    console.log(`URL: ${status.video_url}`);

    // Download if not already downloaded
    if (!metadata.localPath || !fs.existsSync(metadata.localPath)) {
      console.log("\nDownloading video...");
      const videosDir = path.join(__dirname, "../public/videos");
      const videoPath = path.join(videosDir, "avatar-presenter.mp4");

      const buffer = await downloadVideo(status.video_url);
      fs.writeFileSync(videoPath, Buffer.from(buffer));

      const fileSizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
      console.log(`Saved to: ${videoPath}`);
      console.log(`File size: ${fileSizeMB} MB`);

      // Update metadata
      metadata.status = "completed";
      metadata.videoUrl = status.video_url;
      metadata.localPath = videoPath;
      metadata.completedAt = new Date().toISOString();
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
  } else if (status.status === "failed") {
    console.log(`\nVideo generation failed!`);
    console.log(`Error: ${status.error || "Unknown error"}`);
    metadata.status = "failed";
    metadata.error = status.error;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    process.exit(1);
  } else {
    const elapsed = Math.round((Date.now() - Date.parse(metadata.createdAt)) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    console.log(`\nElapsed time: ${minutes}m ${seconds}s`);
    console.log("Video is still processing. Check again in a few minutes.");
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
