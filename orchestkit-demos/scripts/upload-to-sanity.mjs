#!/usr/bin/env node
/**
 * Upload thumbnails + videos to Sanity CDN.
 *
 * Prerequisites:
 *   1. npm install --save-dev @sanity/client dotenv
 *   2. Create .env.local with SANITY_PROJECT_ID, SANITY_DATASET, SANITY_AUTH_TOKEN
 *
 * Usage:
 *   node scripts/upload-to-sanity.mjs
 *
 * Output:
 *   out/cdn-urls.json — mapping of composition IDs to CDN URLs
 */

import { createClient } from "@sanity/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const ROOT = path.resolve(import.meta.dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });

const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET || "production";
const TOKEN = process.env.SANITY_AUTH_TOKEN;

if (!PROJECT_ID || !TOKEN) {
  console.error(
    "Missing SANITY_PROJECT_ID or SANITY_AUTH_TOKEN in environment."
  );
  console.error("Create .env.local with these values.");
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token: TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

const THUMBNAILS_DIR = path.join(
  ROOT,
  "..",
  "docs",
  "playgrounds",
  "thumbnails"
);
const VIDEOS_DIR = path.join(ROOT, "out", "cdn-videos");
const OUTPUT_FILE = path.join(ROOT, "out", "cdn-urls.json");

async function uploadAsset(type, filePath, label) {
  const stream = fs.createReadStream(filePath);
  const filename = path.basename(filePath);
  const opts =
    type === "file" ? { contentType: "video/mp4", filename } : { filename };

  const asset = await client.assets.upload(type, stream, opts);
  console.log(`  ${label}: ${asset.url}`);
  return asset.url;
}

async function main() {
  console.log("=== Sanity CDN Upload ===");
  console.log(`Project: ${PROJECT_ID} / ${DATASET}`);
  console.log(`Thumbnails: ${THUMBNAILS_DIR}`);
  console.log(`Videos:     ${VIDEOS_DIR}`);
  console.log("");

  // Discover composition IDs from thumbnail files
  const thumbFiles = fs.existsSync(THUMBNAILS_DIR)
    ? fs
        .readdirSync(THUMBNAILS_DIR)
        .filter((f) => f.endsWith(".png") && !f.startsWith("_"))
    : [];

  const videoFiles = fs.existsSync(VIDEOS_DIR)
    ? fs.readdirSync(VIDEOS_DIR).filter((f) => f.endsWith(".mp4"))
    : [];

  const thumbMap = Object.fromEntries(
    thumbFiles.map((f) => [path.basename(f, ".png"), f])
  );
  const videoMap = Object.fromEntries(
    videoFiles.map((f) => [path.basename(f, ".mp4"), f])
  );

  // Merge all known composition IDs
  const allIds = [
    ...new Set([...Object.keys(thumbMap), ...Object.keys(videoMap)]),
  ].sort();

  console.log(
    `Found ${thumbFiles.length} thumbnails, ${videoFiles.length} videos`
  );
  console.log(`Unique compositions: ${allIds.length}`);
  console.log("");

  const results = {};
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of allIds) {
    console.log(`[${id}]`);
    const entry = {};

    // Upload thumbnail
    if (thumbMap[id]) {
      try {
        entry.thumbnailCdn = await uploadAsset(
          "image",
          path.join(THUMBNAILS_DIR, thumbMap[id]),
          "thumb"
        );
      } catch (err) {
        console.error(`  thumb FAILED: ${err.message}`);
        failed++;
      }
    }

    // Upload video
    if (videoMap[id]) {
      try {
        entry.videoCdn = await uploadAsset(
          "file",
          path.join(VIDEOS_DIR, videoMap[id]),
          "video"
        );
      } catch (err) {
        console.error(`  video FAILED: ${err.message}`);
        failed++;
      }
    }

    if (entry.thumbnailCdn || entry.videoCdn) {
      results[id] = entry;
      uploaded++;
    } else {
      skipped++;
    }
  }

  // Write output
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2) + "\n");

  console.log("");
  console.log("=== Upload Summary ===");
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Output:   ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
