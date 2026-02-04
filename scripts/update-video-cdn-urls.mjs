#!/usr/bin/env node
/**
 * Update data.js with videoCdn URLs from Sanity upload output.
 *
 * Prerequisites:
 *   1. Run orchestkit-demos/scripts/upload-to-sanity.mjs first
 *   2. This reads from orchestkit-demos/out/cdn-urls.json
 *
 * Usage:
 *   node scripts/update-video-cdn-urls.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CDN_URLS_FILE = path.join(ROOT, "orchestkit-demos", "out", "cdn-urls.json");
const DATA_JS_FILE = path.join(ROOT, "docs", "playgrounds", "data.js");

function main() {
  console.log("=== Update data.js with videoCdn URLs ===\n");

  // Read CDN URLs
  if (!fs.existsSync(CDN_URLS_FILE)) {
    console.error(`Error: ${CDN_URLS_FILE} not found.`);
    console.error("Run orchestkit-demos/scripts/upload-to-sanity.mjs first.");
    process.exit(1);
  }

  const cdnUrls = JSON.parse(fs.readFileSync(CDN_URLS_FILE, "utf8"));
  const videoCount = Object.values(cdnUrls).filter((v) => v.videoCdn).length;
  console.log(`Found ${videoCount} video URLs in cdn-urls.json\n`);

  // Read data.js
  let dataJs = fs.readFileSync(DATA_JS_FILE, "utf8");

  // Update each composition with videoCdn
  let updated = 0;
  for (const [compositionId, urls] of Object.entries(cdnUrls)) {
    if (!urls.videoCdn) continue;

    // Pattern: { id: "CompositionId", ... thumbnailCdn: "...", ...
    // We want to add videoCdn after thumbnailCdn or thumbnail
    const idPattern = new RegExp(
      `(\\{ id: "${compositionId}"[^}]*?)(thumbnail(?:Cdn)?:\\s*"[^"]*")`,
      "g"
    );

    const replacement = `$1$2, videoCdn: "${urls.videoCdn}"`;

    if (idPattern.test(dataJs)) {
      // Reset lastIndex after test
      idPattern.lastIndex = 0;

      // Check if videoCdn already exists for this composition
      if (dataJs.includes(`id: "${compositionId}"`) && !dataJs.includes(`"${compositionId}"`) || !dataJs.match(new RegExp(`id: "${compositionId}"[^}]*videoCdn`))) {
        dataJs = dataJs.replace(idPattern, replacement);
        console.log(`  [update] ${compositionId}`);
        updated++;
      } else {
        console.log(`  [skip] ${compositionId} (already has videoCdn)`);
      }
    } else {
      console.log(`  [warn] ${compositionId} not found in data.js`);
    }
  }

  // Write updated data.js
  fs.writeFileSync(DATA_JS_FILE, dataJs);

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated} compositions`);
  console.log(`Output:  ${DATA_JS_FILE}`);
}

main();
