#!/usr/bin/env node
/**
 * Prepare videos for Sanity CDN upload.
 *
 * This script maps rendered video files to their composition IDs
 * and copies them to out/cdn-videos/ with the correct names.
 *
 * Usage:
 *   node scripts/prepare-videos-for-upload.mjs
 *
 * Then run:
 *   node scripts/upload-to-sanity.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "out");
const CDN_VIDEOS_DIR = path.join(OUT_DIR, "cdn-videos");

// Manual mapping of video files to composition IDs
// Format: { "video-filename.mp4": "CompositionId" }
const VIDEO_MAPPINGS = {
  // Core skills - TriTerminalRace (main versions)
  "implement-demo-v5.mp4": "Implement",
  "implement-demo-v4.mp4": "Implement", // fallback
  "brainstorming-v3-scroll.mp4": "Brainstorming",
  "brainstorming-showcase.mp4": "BrainstormingShowcase",
  "hooks-async-demo.mp4": "HooksAsyncDemo",
  "speedrun-x-twitter.mp4": "SpeedrunDemo",
  "implement-phases.mp4": "ImplementPhases",
  "implement-summary-v2.mp4": "ImplementSkillPhaseDemo",
  "marketplace-v12-polished.mp4": "MarketplaceDemo",
  "marketplace-demo-v11b.mp4": "MarketplaceIntro",
};

// Discover all mp4 files in out/
function discoverVideos() {
  if (!fs.existsSync(OUT_DIR)) {
    console.log("No out/ directory found");
    return [];
  }

  return fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".mp4"));
}

// Create cdn-videos directory
function ensureCdnDir() {
  if (!fs.existsSync(CDN_VIDEOS_DIR)) {
    fs.mkdirSync(CDN_VIDEOS_DIR, { recursive: true });
    console.log(`Created ${CDN_VIDEOS_DIR}`);
  }
}

// Copy video with correct name
function copyVideo(srcFile, compositionId) {
  const srcPath = path.join(OUT_DIR, srcFile);
  const destPath = path.join(CDN_VIDEOS_DIR, `${compositionId}.mp4`);

  if (fs.existsSync(destPath)) {
    console.log(`  [skip] ${compositionId}.mp4 already exists`);
    return false;
  }

  fs.copyFileSync(srcPath, destPath);
  console.log(`  [copy] ${srcFile} -> ${compositionId}.mp4`);
  return true;
}

function main() {
  console.log("=== Prepare Videos for Upload ===\n");

  const videos = discoverVideos();
  console.log(`Found ${videos.length} video files in out/\n`);

  ensureCdnDir();

  let copied = 0;
  let skipped = 0;
  let unmapped = [];

  // Process mapped videos
  for (const [srcFile, compositionId] of Object.entries(VIDEO_MAPPINGS)) {
    if (videos.includes(srcFile)) {
      if (copyVideo(srcFile, compositionId)) {
        copied++;
      } else {
        skipped++;
      }
    } else {
      console.log(`  [warn] ${srcFile} not found`);
    }
  }

  // Report unmapped videos
  const mappedFiles = Object.keys(VIDEO_MAPPINGS);
  unmapped = videos.filter((v) => !mappedFiles.includes(v));

  console.log("\n=== Summary ===");
  console.log(`Copied:   ${copied}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Unmapped: ${unmapped.length}`);

  if (unmapped.length > 0) {
    console.log("\nUnmapped videos (add to VIDEO_MAPPINGS if needed):");
    unmapped.forEach((f) => console.log(`  - ${f}`));
  }

  console.log(
    "\nNext: Run 'node scripts/upload-to-sanity.mjs' to upload to CDN"
  );
}

main();
